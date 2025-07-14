use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo};
use anchor_spl::associated_token::AssociatedToken;
use crate::{
    constants::*, 
    errors::CapsuleXError, 
    state::{Capsule, Game, ProgramVault, LeaderboardEntry}
};

#[derive(Accounts)]
#[instruction(name: String, symbol: String, uri: String)]
pub struct MintCapsuleNft<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        mut,
        constraint = capsule.creator == creator.key() @ CapsuleXError::UnauthorizedCreator,
        constraint = capsule.is_active @ CapsuleXError::CapsuleNotActive
    )]
    pub capsule: Account<'info, Capsule>,
    
    #[account(
        mut,
        constraint = nft_mint.key() == capsule.nft_mint
    )]
    pub nft_mint: Account<'info, Mint>,
    
    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = nft_mint,
        associated_token::authority = creator
    )]
    pub creator_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: Account<'info, ProgramVault>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(badge_type: String, metadata_uri: String)]
pub struct MintWinnerBadge<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// CHECK: This is the winner who will receive the badge
    #[account(mut)]
    pub winner: AccountInfo<'info>,
    
    #[account(
        constraint = game.winner_found @ CapsuleXError::GameNotEnded,
        constraint = game.winner == Some(winner.key()) @ CapsuleXError::NotEligibleForReward
    )]
    pub game: Account<'info, Game>,
    
    #[account(
        init,
        payer = authority,
        mint::decimals = 0,
        mint::authority = authority,
        seeds = [BADGE_MINT_SEED, game.key().as_ref(), winner.key().as_ref()],
        bump
    )]
    pub badge_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = authority,
        associated_token::mint = badge_mint,
        associated_token::authority = winner
    )]
    pub winner_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: Account<'info, ProgramVault>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(trophy_type: String, metadata_uri: String)]
pub struct MintTrophyNft<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// CHECK: This is the user who will receive the trophy
    #[account(mut)]
    pub user: AccountInfo<'info>,
    
    #[account(
        constraint = leaderboard.user == user.key() @ CapsuleXError::InvalidAccountOwner
    )]
    pub leaderboard: Account<'info, LeaderboardEntry>,
    
    #[account(
        init,
        payer = authority,
        mint::decimals = 0,
        mint::authority = authority,
        seeds = [TROPHY_MINT_SEED, user.key().as_ref(), trophy_type.as_bytes()],
        bump
    )]
    pub trophy_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = authority,
        associated_token::mint = trophy_mint,
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: Account<'info, ProgramVault>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn mint_capsule_nft(
    ctx: Context<MintCapsuleNft>,
    name: String,
    symbol: String,
    uri: String,
) -> Result<()> {
    // Validate metadata URI length
    require!(
        uri.len() <= MAX_METADATA_URI_LENGTH,
        CapsuleXError::MetadataUriTooLong
    );
    
    // Mint 1 NFT to the creator
    let capsule = &ctx.accounts.capsule;
    let bump_seed = [capsule.bump];
    let seeds = &[
        CAPSULE_SEED,
        capsule.creator.as_ref(),
        &capsule.reveal_date.to_le_bytes(), // ✅ Fixed: use reveal_date like CreateCapsule
        &bump_seed,
    ];
    let signer_seeds = &[&seeds[..]];
    
    let mint_to_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.nft_mint.to_account_info(),
            to: ctx.accounts.creator_token_account.to_account_info(),
            authority: ctx.accounts.capsule.to_account_info(),
        },
        signer_seeds,
    );
    
    token::mint_to(mint_to_ctx, 1)?;
    
    emit!(CapsuleNftMinted {
        capsule_id: capsule.key(),
        nft_mint: ctx.accounts.nft_mint.key(),
        creator: ctx.accounts.creator.key(),
        name,
        symbol,
        uri,
    });
    
    Ok(())
}

pub fn mint_winner_badge(
    ctx: Context<MintWinnerBadge>,
    badge_type: String,
    metadata_uri: String,
) -> Result<()> {
    // Validate badge type length
    require!(
        badge_type.len() <= MAX_BADGE_TYPE_LENGTH,
        CapsuleXError::BadgeTypeTooLong
    );
    
    // Validate metadata URI length
    require!(
        metadata_uri.len() <= MAX_METADATA_URI_LENGTH,
        CapsuleXError::MetadataUriTooLong
    );
    
    // Collect badge minting fee
    let fee_amount = BADGE_MINT_FEE;
    
    let transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
        &ctx.accounts.authority.key(),
        &ctx.accounts.vault.key(),
        fee_amount,
    );
    
    anchor_lang::solana_program::program::invoke(
        &transfer_instruction,
        &[
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;
    
    ctx.accounts.vault.add_fees(fee_amount);
    
    // Mint 1 badge NFT to the winner
    let mint_to_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.badge_mint.to_account_info(),
            to: ctx.accounts.winner_token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        },
    );
    
    token::mint_to(mint_to_ctx, 1)?;
    
    emit!(WinnerBadgeMinted {
        game_id: ctx.accounts.game.key(),
        winner: ctx.accounts.winner.key(),
        badge_mint: ctx.accounts.badge_mint.key(),
        badge_type,
        metadata_uri,
    });
    
    Ok(())
}

pub fn mint_trophy_nft(
    ctx: Context<MintTrophyNft>,
    trophy_type: String,
    metadata_uri: String,
) -> Result<()> {
    // Validate trophy type length
    require!(
        trophy_type.len() <= MAX_BADGE_TYPE_LENGTH,
        CapsuleXError::BadgeTypeTooLong
    );
    
    // Validate metadata URI length
    require!(
        metadata_uri.len() <= MAX_METADATA_URI_LENGTH,
        CapsuleXError::MetadataUriTooLong
    );
    
    let leaderboard = &ctx.accounts.leaderboard;
    
    // Check eligibility based on trophy type
    let eligible = match trophy_type.as_str() {
        "winner" => leaderboard.games_won >= 1,
        "veteran" => leaderboard.games_played >= 10,
        "creator" => leaderboard.capsules_created >= 5,
        "champion" => leaderboard.games_won >= 10,
        _ => false,
    };
    
    require!(eligible, CapsuleXError::NotEligibleForReward);
    
    // Collect trophy minting fee
    let fee_amount = TROPHY_MINT_FEE;
    
    let transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
        &ctx.accounts.authority.key(),
        &ctx.accounts.vault.key(),
        fee_amount,
    );
    
    anchor_lang::solana_program::program::invoke(
        &transfer_instruction,
        &[
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;
    
    ctx.accounts.vault.add_fees(fee_amount);
    
    // Mint 1 trophy NFT to the user
    let mint_to_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.trophy_mint.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        },
    );
    
    token::mint_to(mint_to_ctx, 1)?;
    
    emit!(TrophyNftMinted {
        user: ctx.accounts.user.key(),
        trophy_mint: ctx.accounts.trophy_mint.key(),
        trophy_type,
        metadata_uri,
    });
    
    Ok(())
}

#[event]
pub struct CapsuleNftMinted {
    pub capsule_id: Pubkey,
    pub nft_mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
}

#[event]
pub struct WinnerBadgeMinted {
    pub game_id: Pubkey,
    pub winner: Pubkey,
    pub badge_mint: Pubkey,
    pub badge_type: String,
    pub metadata_uri: String,
}

#[event]
pub struct TrophyNftMinted {
    pub user: Pubkey,
    pub trophy_mint: Pubkey,
    pub trophy_type: String,
    pub metadata_uri: String,
} 