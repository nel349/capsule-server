use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};
use crate::{
    constants::*, 
    errors::CapsuleXError, 
    state::{Capsule, ProgramVault}
};

#[derive(Accounts)]
#[instruction(content_hash: String, reveal_date: i64, is_gamified: bool)]
pub struct CreateCapsule<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        init,
        payer = creator,
        space = Capsule::LEN,
        seeds = [CAPSULE_SEED, creator.key().as_ref(), content_hash.as_bytes()],
        bump
    )]
    pub capsule: Account<'info, Capsule>,
    
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
pub struct RevealCapsule<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        mut,
        seeds = [CAPSULE_SEED, creator.key().as_ref(), capsule.content_hash.as_bytes()],
        bump = capsule.bump,
        constraint = capsule.creator == creator.key() @ CapsuleXError::UnauthorizedCreator,
        constraint = capsule.can_reveal() @ CapsuleXError::CapsuleNotReady
    )]
    pub capsule: Account<'info, Capsule>,
}

pub fn create_capsule(
    ctx: Context<CreateCapsule>,
    content_hash: String,
    reveal_date: i64,
    is_gamified: bool,
) -> Result<()> {
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;
    
    // Validate content hash length
    require!(
        content_hash.len() <= MAX_CONTENT_HASH_LENGTH,
        CapsuleXError::ContentHashTooLong
    );
    
    // Validate reveal date
    require!(
        reveal_date >= current_time + MIN_REVEAL_DELAY && 
        reveal_date <= current_time + MAX_REVEAL_DELAY,
        CapsuleXError::InvalidRevealDate
    );
    
    // Transfer creation fee to vault
    let fee_amount = CAPSULE_CREATION_FEE;
    
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
    
    // Initialize capsule
    let capsule = &mut ctx.accounts.capsule;
    **capsule = Capsule::new(
        ctx.accounts.creator.key(),
        ctx.accounts.nft_mint.key(),
        content_hash,
        reveal_date,
        is_gamified,
        ctx.bumps.capsule,
    );
    
    emit!(CapsuleCreated {
        capsule_id: capsule.key(),
        creator: ctx.accounts.creator.key(),
        nft_mint: ctx.accounts.nft_mint.key(),
        reveal_date,
        is_gamified,
    });
    
    Ok(())
}

pub fn reveal_capsule(ctx: Context<RevealCapsule>) -> Result<()> {
    let capsule = &mut ctx.accounts.capsule;
    
    // Check if capsule can be revealed
    require!(capsule.can_reveal(), CapsuleXError::CapsuleNotReady);
    require!(!capsule.is_revealed, CapsuleXError::CapsuleAlreadyRevealed);
    
    // Reveal the capsule
    capsule.reveal();
    
    emit!(CapsuleRevealed {
        capsule_id: capsule.key(),
        creator: capsule.creator,
        reveal_time: Clock::get()?.unix_timestamp,
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
}

#[event]
pub struct CapsuleRevealed {
    pub capsule_id: Pubkey,
    pub creator: Pubkey,
    pub reveal_time: i64,
} 