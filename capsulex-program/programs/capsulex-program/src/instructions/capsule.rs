use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};
use anchor_lang::solana_program::rent::Rent;
use crate::{
    constants::*, 
    errors::CapsuleXError, 
    state::{Capsule, ContentStorage, ProgramVault, Game}
};

// Light on-chain validation helpers (avoid expensive char iteration)
fn is_valid_sha256_length(hash: &str) -> bool {
    hash.len() == 64  // Just check length, client validates hex format
}

fn is_valid_ipfs_cid_format(cid: &str) -> bool {
    cid.len() >= 46 && cid.len() <= 59 && cid.starts_with("Qm")
}

fn is_valid_url_format(url: &str) -> bool {
    url.len() >= 12 && url.len() <= 500 && url.starts_with("https://")
}

#[derive(Accounts)]
#[instruction(encrypted_content: String, content_storage: ContentStorage, content_integrity_hash: String, reveal_date: i64, is_gamified: bool)]
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
        mint::decimals = 0,
        mint::authority = capsule,
        seeds = [CAPSULE_MINT_SEED, capsule.key().as_ref()],
        bump
    )]
    pub nft_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: Account<'info, ProgramVault>,
    
    // Game account - only initialized when is_gamified = true
    /// CHECK: This account is only used when is_gamified = true. We validate this in the instruction logic.
    #[account(mut)]
    pub game: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(reveal_date: i64)]
pub struct RevealCapsule<'info> {
    #[account(mut)]
    pub revealer: Signer<'info>,
    
    #[account(
        mut,
        seeds = [CAPSULE_SEED, capsule.creator.as_ref(), &reveal_date.to_le_bytes()],
        bump = capsule.bump,
        constraint = capsule.creator == revealer.key() || 
                     revealer.key() == crate::constants::APP_AUTHORITY @ CapsuleXError::UnauthorizedRevealer
    )]
    pub capsule: Account<'info, Capsule>,
}

pub fn create_capsule(
    ctx: Context<CreateCapsule>,
    encrypted_content: String,
    content_storage: ContentStorage,
    content_integrity_hash: String,
    reveal_date: i64,
    is_gamified: bool,
) -> Result<()> {
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;
    
    // Validate content based on storage type
    match &content_storage {
        ContentStorage::Text => {
            require!(
                encrypted_content.len() <= MAX_ONCHAIN_CONTENT_LENGTH,
                CapsuleXError::ContentHashTooLong
            );
        },
        ContentStorage::Document { cid } => {
            require!(is_valid_ipfs_cid_format(cid), CapsuleXError::InvalidCID);
        },
        ContentStorage::SocialArchive { original_url, archived_cid, platform, content_hash, .. } => {
            require!(is_valid_url_format(original_url), CapsuleXError::InvalidURL);
            require!(is_valid_ipfs_cid_format(archived_cid), CapsuleXError::InvalidCID);
            require!(platform.len() <= 20, CapsuleXError::UnsupportedPlatform);  // Basic length check
            require!(is_valid_sha256_length(content_hash), CapsuleXError::InvalidContentHash);
        },
        ContentStorage::MediaBundle { primary_cid, attachments, manifest_cid, total_size_bytes } => {
            require!(is_valid_ipfs_cid_format(primary_cid), CapsuleXError::InvalidCID);
            require!(is_valid_ipfs_cid_format(manifest_cid), CapsuleXError::InvalidCID);
            require!(attachments.len() <= 50, CapsuleXError::TooManyAttachments);
            // Skip individual attachment validation to save compute (client validates)
            require!(*total_size_bytes <= 1_000_000_000, CapsuleXError::ContentTooLarge);
        },
        ContentStorage::ExternalWithBackup { original_url, backup_cid, verification_hash } => {
            require!(is_valid_url_format(original_url), CapsuleXError::InvalidURL);
            require!(is_valid_ipfs_cid_format(backup_cid), CapsuleXError::InvalidCID);
            require!(is_valid_sha256_length(verification_hash), CapsuleXError::InvalidContentHash);
        }
    }
    
    // Validate content integrity hash (length only - client validates hex format)
    require!(
        is_valid_sha256_length(&content_integrity_hash),
        CapsuleXError::InvalidContentHash
    );
    
    // Validate reveal date
    require!(
        reveal_date >= current_time + MIN_REVEAL_DELAY && 
        reveal_date <= current_time + MAX_REVEAL_DELAY,
        CapsuleXError::InvalidRevealDate
    );
    
    // Collect capsule creation fee
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
    
    ctx.accounts.vault.add_fees(fee_amount);
    
    // Initialize capsule (content is already encrypted on device)
    let capsule = &mut ctx.accounts.capsule;
    **capsule = Capsule::new(
        ctx.accounts.creator.key(),
        ctx.accounts.nft_mint.key(),
        encrypted_content,
        content_storage,
        content_integrity_hash,
        reveal_date,
        is_gamified,
        ctx.bumps.capsule,
    );
    
    // If gamified, initialize the game account
    if is_gamified {
        // Find the game PDA and bump
        let (expected_game_key, game_bump) = Pubkey::find_program_address(
            &[
                GAME_SEED,
                &capsule.key().to_bytes(),
            ],
            ctx.program_id,
        );
        
        require!(
            ctx.accounts.game.key() == expected_game_key,
            CapsuleXError::InvalidGameAccount
        );
        
        // Initialize the game account
        let game_account_info = ctx.accounts.game.to_account_info();
        let rent = Rent::get()?;
        let game_space = Game::LEN;
        let lamports_required = rent.minimum_balance(game_space);
        
        // Create the game account
        anchor_lang::solana_program::program::invoke_signed(
            &anchor_lang::solana_program::system_instruction::create_account(
                &ctx.accounts.creator.key(),
                &game_account_info.key(),
                lamports_required,
                game_space as u64,
                ctx.program_id,
            ),
            &[
                ctx.accounts.creator.to_account_info(),
                game_account_info.clone(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[&[
                GAME_SEED,
                &capsule.key().to_bytes(),
                &[game_bump],
            ]],
        )?;
        
        // Initialize the game data
        let mut game_data = game_account_info.try_borrow_mut_data()?;
        let game = Game::new(
            capsule.key(),
            ctx.accounts.creator.key(),
            50, // max_guesses
            3,  // max_winners
            game_bump,
        );
        
        // Serialize the game data
        game.try_serialize(&mut game_data.as_mut())?;
    }
    
    emit!(CapsuleCreated {
        capsule_id: capsule.key(),
        creator: ctx.accounts.creator.key(),
        nft_mint: ctx.accounts.nft_mint.key(),
        reveal_date,
        is_gamified,
        content_storage: capsule.content_storage.clone(),
        fee_amount, // Actual fee collected
    });
    
    Ok(())
}

pub fn reveal_capsule(ctx: Context<RevealCapsule>, _reveal_date: i64) -> Result<()> {
    let capsule = &mut ctx.accounts.capsule;
    
    // Check if already revealed
    require!(!capsule.is_revealed, CapsuleXError::CapsuleAlreadyRevealed);
    
    // Check if capsule can be revealed (time check)
    require!(capsule.can_reveal(), CapsuleXError::CapsuleNotReady);
    
    // Reveal the capsule (no key management needed - done on device)
    capsule.reveal();
    
    emit!(CapsuleRevealed {
        capsule_id: capsule.key(),
        creator: capsule.creator,
        revealer: ctx.accounts.revealer.key(),
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
    pub content_storage: ContentStorage,
    pub fee_amount: u64,
}

#[event]
pub struct CapsuleRevealed {
    pub capsule_id: Pubkey,
    pub creator: Pubkey,
    pub revealer: Pubkey,
    pub reveal_time: i64,
} 