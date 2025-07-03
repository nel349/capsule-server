use anchor_lang::prelude::*;
use crate::{
    constants::*, 
    errors::CapsuleXError, 
    state::{LeaderboardEntry, ProgramVault}
};

#[derive(Accounts)]
#[instruction(user: Pubkey, points: u64)]
pub struct UpdateLeaderboard<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// CHECK: This is the user whose leaderboard entry is being updated
    pub user: AccountInfo<'info>,
    
    #[account(
        init_if_needed,
        payer = authority,
        space = LeaderboardEntry::LEN,
        seeds = [LEADERBOARD_SEED, user.key().as_ref()],
        bump
    )]
    pub leaderboard: Account<'info, LeaderboardEntry>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(user: Pubkey)]
pub struct InitializeLeaderboard<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// CHECK: This is the user for whom we're creating a leaderboard entry
    pub user: AccountInfo<'info>,
    
    #[account(
        init,
        payer = authority,
        space = LeaderboardEntry::LEN,
        seeds = [LEADERBOARD_SEED, user.key().as_ref()],
        bump
    )]
    pub leaderboard: Account<'info, LeaderboardEntry>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetLeaderboard<'info> {
    #[account(
        seeds = [LEADERBOARD_SEED, user.key().as_ref()],
        bump
    )]
    pub leaderboard: Account<'info, LeaderboardEntry>,
    
    /// CHECK: This is the user whose leaderboard entry we're querying
    pub user: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct InitializeProgram<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = ProgramVault::LEN,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: Account<'info, ProgramVault>,
    
    pub system_program: Program<'info, System>,
}

pub fn update_leaderboard(
    ctx: Context<UpdateLeaderboard>,
    user: Pubkey,
    points: u64,
) -> Result<()> {
    let leaderboard = &mut ctx.accounts.leaderboard;
    
    // Initialize leaderboard if it's new
    if leaderboard.user == Pubkey::default() {
        **leaderboard = LeaderboardEntry::new(user, ctx.bumps.leaderboard);
    }
    
    // Validate user matches
    require!(
        leaderboard.user == user,
        CapsuleXError::InvalidAccountOwner
    );
    
    // Add points
    leaderboard.add_points(points);
    
    emit!(LeaderboardUpdated {
        user,
        points_added: points,
        total_points: leaderboard.total_points,
    });
    
    Ok(())
}

pub fn initialize_leaderboard(
    ctx: Context<InitializeLeaderboard>,
    user: Pubkey,
) -> Result<()> {
    let leaderboard = &mut ctx.accounts.leaderboard;
    
    // Initialize leaderboard entry
    **leaderboard = LeaderboardEntry::new(user, ctx.bumps.leaderboard);
    
    emit!(LeaderboardInitialized {
        user,
        leaderboard_id: leaderboard.key(),
    });
    
    Ok(())
}

pub fn initialize_program(
    ctx: Context<InitializeProgram>,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    
    // Initialize program vault
    **vault = ProgramVault::new(ctx.accounts.authority.key(), ctx.bumps.vault);
    
    emit!(ProgramInitialized {
        authority: ctx.accounts.authority.key(),
        vault: vault.key(),
    });
    
    Ok(())
}

// Helper function to update leaderboard when a user wins a game
pub fn update_leaderboard_game_won(
    leaderboard: &mut LeaderboardEntry,
    reward_amount: u64,
) -> Result<()> {
    leaderboard.add_game_won(reward_amount);
    Ok(())
}

// Helper function to update leaderboard when a user plays a game
pub fn update_leaderboard_game_played(
    leaderboard: &mut LeaderboardEntry,
) -> Result<()> {
    leaderboard.add_game_played();
    Ok(())
}

// Helper function to update leaderboard when a user creates a capsule
pub fn update_leaderboard_capsule_created(
    leaderboard: &mut LeaderboardEntry,
) -> Result<()> {
    leaderboard.add_capsule_created();
    Ok(())
}

#[event]
pub struct LeaderboardUpdated {
    pub user: Pubkey,
    pub points_added: u64,
    pub total_points: u64,
}

#[event]
pub struct LeaderboardInitialized {
    pub user: Pubkey,
    pub leaderboard_id: Pubkey,
}

#[event]
pub struct ProgramInitialized {
    pub authority: Pubkey,
    pub vault: Pubkey,
} 