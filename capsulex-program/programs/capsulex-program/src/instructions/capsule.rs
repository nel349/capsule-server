use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};
use crate::{
    constants::*, 
    errors::CapsuleXError, 
    state::{Capsule, ProgramVault, KeyVault, ContentStorage}
};

#[derive(Accounts)]
#[instruction(encrypted_content: String, content_storage: ContentStorage, reveal_date: i64, is_gamified: bool)]
pub struct CreateCapsule<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        init,
        payer = creator,
        space = Capsule::LEN,
        seeds = [CAPSULE_SEED, creator.key().as_ref(), &reveal_date.to_le_bytes()],
        bump
    )]
    pub capsule: Account<'info, Capsule>,
    
    #[account(
        init,
        payer = creator,
        space = KeyVault::LEN,
        seeds = [KEY_VAULT_SEED, capsule.key().as_ref()],
        bump
    )]
    pub key_vault: Account<'info, KeyVault>,
    
    #[account(
        init,
        payer = creator,
        mint::decimals = 0,
        mint::authority = capsule,
        seeds = [b"capsule_mint", capsule.key().as_ref()],
        bump
    )]
    pub nft_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: Account<'info, ProgramVault>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(reveal_date: i64)]
pub struct RevealCapsule<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        mut,
        seeds = [CAPSULE_SEED, creator.key().as_ref(), &reveal_date.to_le_bytes()],
        bump = capsule.bump,
        constraint = capsule.creator == creator.key() @ CapsuleXError::UnauthorizedCreator,
        constraint = capsule.can_reveal() @ CapsuleXError::CapsuleNotReady
    )]
    pub capsule: Account<'info, Capsule>,
    
    #[account(
        mut,
        seeds = [KEY_VAULT_SEED, capsule.key().as_ref()],
        bump = key_vault.bump,
        constraint = key_vault.can_retrieve() @ CapsuleXError::KeyNotReady
    )]
    pub key_vault: Account<'info, KeyVault>,
}

pub fn create_capsule(
    ctx: Context<CreateCapsule>,
    encrypted_content: String,
    content_storage: ContentStorage,
    reveal_date: i64,
    is_gamified: bool,
) -> Result<()> {
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;
    
    // Validate content based on storage type
    match content_storage {
        ContentStorage::OnChain => {
            require!(
                encrypted_content.len() <= MAX_ONCHAIN_CONTENT_LENGTH,
                CapsuleXError::ContentHashTooLong
            );
        },
        ContentStorage::IPFS => {
            require!(
                encrypted_content.starts_with("Qm") && (46..=59).contains(&encrypted_content.len()),
                CapsuleXError::ContentHashTooLong
            );
        }
    }
    
    // Validate reveal date
    require!(
        reveal_date >= current_time + MIN_REVEAL_DELAY && 
        reveal_date <= current_time + MAX_REVEAL_DELAY,
        CapsuleXError::InvalidRevealDate
    );
    
    // Generate random encryption key (32 bytes for AES-256)
    let mut encryption_key = [0u8; 32];
    let key_seed = [
        ctx.accounts.creator.key().as_ref(),
        &reveal_date.to_le_bytes(),
        b"encryption_key",
    ].concat();
    anchor_lang::solana_program::keccak::hash(&key_seed).to_bytes()[0..32].copy_from_slice(&mut encryption_key);
    
    // Calculate fee based on storage type
    let fee_amount = match content_storage {
        ContentStorage::OnChain => CAPSULE_CREATION_FEE * 2, // 2x fee for on-chain storage
        ContentStorage::IPFS => CAPSULE_CREATION_FEE, // Standard fee for IPFS storage
    };
    
    let transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
        &ctx.accounts.creator.key(),
        &ctx.accounts.vault.key(),
        fee_amount,
    );
    
    anchor_lang::solana_program::program::invoke(
        &transfer_instruction,
        &[
            ctx.accounts.creator.to_account_info(),
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;
    
    // Update vault
    ctx.accounts.vault.add_fees(fee_amount);
    
    // Initialize key vault
    let key_vault = &mut ctx.accounts.key_vault;
    **key_vault = KeyVault::new(
        ctx.accounts.capsule.key(),
        encryption_key,
        reveal_date,
        ctx.accounts.creator.key(),
        ctx.bumps.key_vault,
    );
    
    // Initialize capsule
    let capsule = &mut ctx.accounts.capsule;
    **capsule = Capsule::new(
        ctx.accounts.creator.key(),
        ctx.accounts.nft_mint.key(),
        encrypted_content,
        content_storage,
        reveal_date,
        is_gamified,
        ctx.accounts.key_vault.key(),
        ctx.bumps.capsule,
    );
    
    emit!(CapsuleCreated {
        capsule_id: capsule.key(),
        creator: ctx.accounts.creator.key(),
        nft_mint: ctx.accounts.nft_mint.key(),
        reveal_date,
        is_gamified,
        content_storage: capsule.content_storage.clone(),
        fee_amount,
    });
    
    Ok(())
}

pub fn reveal_capsule(ctx: Context<RevealCapsule>, reveal_date: i64) -> Result<()> {
    let capsule = &mut ctx.accounts.capsule;
    let key_vault = &mut ctx.accounts.key_vault;
    
    // Check if capsule can be revealed
    require!(capsule.can_reveal(), CapsuleXError::CapsuleNotReady);
    require!(!capsule.is_revealed, CapsuleXError::CapsuleAlreadyRevealed);
    require!(key_vault.can_retrieve(), CapsuleXError::KeyNotReady);
    
    // Mark key as retrieved
    key_vault.mark_retrieved();
    
    // Reveal the capsule
    capsule.reveal();
    
    emit!(CapsuleRevealed {
        capsule_id: capsule.key(),
        creator: capsule.creator,
        reveal_time: Clock::get()?.unix_timestamp,
        encryption_key: key_vault.encryption_key,
    });
    
    Ok(())
}

#[event]
pub struct CapsuleCreated {
    pub capsule_id: Pubkey,
    pub creator: Pubkey,
    pub nft_mint: Pubkey,
    pub reveal_date: i64,
    pub is_gamified: bool,
    pub content_storage: ContentStorage,
    pub fee_amount: u64,
}

#[event]
pub struct CapsuleRevealed {
    pub capsule_id: Pubkey,
    pub creator: Pubkey,
    pub reveal_time: i64,
    pub encryption_key: [u8; 32],
} 