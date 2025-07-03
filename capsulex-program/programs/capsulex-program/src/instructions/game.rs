use anchor_lang::prelude::*;
use crate::{
    constants::*, 
    errors::CapsuleXError, 
    state::{Capsule, Game, Guess, ProgramVault, LeaderboardEntry}
};

#[derive(Accounts)]
#[instruction(capsule_id: Pubkey, max_guesses: u32, guess_fee: u64)]
pub struct InitializeGame<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        constraint = capsule.creator == creator.key() @ CapsuleXError::UnauthorizedCreator,
        constraint = capsule.is_gamified @ CapsuleXError::CapsuleNotGamified,
        constraint = capsule.is_active @ CapsuleXError::CapsuleNotActive
    )]
    pub capsule: Account<'info, Capsule>,
    
    #[account(
        init,
        payer = creator,
        space = Game::LEN,
        seeds = [GAME_SEED, capsule.key().as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(guess_content: String, is_paid: bool)]
pub struct SubmitGuess<'info> {
    #[account(mut)]
    pub guesser: Signer<'info>,
    
    #[account(
        mut,
        constraint = game.can_accept_guess() @ CapsuleXError::GameNotActive
    )]
    pub game: Account<'info, Game>,
    
    #[account(
        init,
        payer = guesser,
        space = Guess::LEN,
        seeds = [GUESS_SEED, game.key().as_ref(), guesser.key().as_ref(), &game.current_guesses.to_le_bytes()],
        bump
    )]
    pub guess: Account<'info, Guess>,
    
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: Account<'info, ProgramVault>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(guess_id: Pubkey)]
pub struct VerifyGuess<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        constraint = guess.game_id == game.key() @ CapsuleXError::InvalidGuessId
    )]
    pub guess: Account<'info, Guess>,
    
    #[account(
        mut,
        constraint = game.is_active @ CapsuleXError::GameNotActive,
        constraint = !game.winner_found @ CapsuleXError::WinnerAlreadyFound
    )]
    pub game: Account<'info, Game>,
    
    #[account(
        constraint = capsule.key() == game.capsule_id,
        constraint = capsule.is_active @ CapsuleXError::CapsuleNotActive
    )]
    pub capsule: Account<'info, Capsule>,
    
    #[account(
        mut,
        seeds = [LEADERBOARD_SEED, guess.guesser.as_ref()],
        bump
    )]
    pub leaderboard: Account<'info, LeaderboardEntry>,
}

#[derive(Accounts)]
pub struct DistributeRewards<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        constraint = game.winner_found @ CapsuleXError::GameNotEnded,
        constraint = game.total_fees_collected > 0 @ CapsuleXError::NoFeesToDistribute
    )]
    pub game: Account<'info, Game>,
    
    #[account(
        constraint = capsule.key() == game.capsule_id,
        constraint = capsule.creator == creator.key()
    )]
    pub capsule: Account<'info, Capsule>,
    
    /// CHECK: This is the creator account for reward distribution
    #[account(mut)]
    pub creator: AccountInfo<'info>,
    
    /// CHECK: This is the winner account for reward distribution
    #[account(mut)]
    pub winner: AccountInfo<'info>,
    
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: Account<'info, ProgramVault>,
    
    pub system_program: Program<'info, System>,
}

pub fn initialize_game(
    ctx: Context<InitializeGame>,
    capsule_id: Pubkey,
    max_guesses: u32,
    guess_fee: u64,
) -> Result<()> {
    // Validate max guesses
    require!(
        max_guesses > 0 && max_guesses <= MAX_GUESSES_PER_GAME,
        CapsuleXError::InvalidFeeAmount
    );
    
    // Validate guess fee
    require!(
        guess_fee >= GUESSING_FEE,
        CapsuleXError::InvalidFeeAmount
    );
    
    // Initialize game
    let game = &mut ctx.accounts.game;
    **game = Game::new(
        capsule_id,
        ctx.accounts.creator.key(),
        max_guesses,
        guess_fee,
        ctx.bumps.game,
    );
    
    emit!(GameInitialized {
        game_id: game.key(),
        capsule_id,
        creator: ctx.accounts.creator.key(),
        max_guesses,
        guess_fee,
    });
    
    Ok(())
}

pub fn submit_guess(
    ctx: Context<SubmitGuess>,
    guess_content: String,
    is_paid: bool,
) -> Result<()> {
    // Validate guess content length
    require!(
        guess_content.len() <= MAX_GUESS_CONTENT_LENGTH,
        CapsuleXError::GuessContentTooLong
    );
    
    let game = &mut ctx.accounts.game;
    
    // Check if game can accept more guesses
    require!(game.can_accept_guess(), CapsuleXError::MaxGuessesReached);
    
    // Handle paid guess
    if is_paid {
        let fee_amount = game.guess_fee;
        
        // Transfer guess fee to vault
        let transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.guesser.key(),
            &ctx.accounts.vault.key(),
            fee_amount,
        );
        
        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                ctx.accounts.guesser.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        
        ctx.accounts.vault.add_fees(fee_amount);
    }
    
    // Initialize guess
    let guess = &mut ctx.accounts.guess;
    **guess = Guess::new(
        game.key(),
        ctx.accounts.guesser.key(),
        guess_content.clone(),
        is_paid,
        ctx.bumps.guess,
    );
    
    // Update game
    game.add_guess(is_paid);
    
    emit!(GuessSubmitted {
        guess_id: guess.key(),
        game_id: game.key(),
        guesser: ctx.accounts.guesser.key(),
        guess_content,
        is_paid,
    });
    
    Ok(())
}

pub fn verify_guess(
    ctx: Context<VerifyGuess>,
    _guess_id: Pubkey,
) -> Result<()> {
    let guess = &mut ctx.accounts.guess;
    let game = &mut ctx.accounts.game;
    let capsule = &ctx.accounts.capsule;
    
    // Only paid guesses can win
    require!(guess.is_paid, CapsuleXError::OnlyPaidGuessesEligible);
    
    // This is a simplified verification - in practice, you'd implement
    // proper content comparison logic based on your encryption scheme
    let is_correct = verify_guess_content(&guess.guess_content, &capsule.content_hash);
    
    if is_correct {
        // Mark guess as correct
        guess.mark_correct();
        
        // Set winner in game
        game.set_winner(guess.guesser);
        
        // Update leaderboard
        let leaderboard = &mut ctx.accounts.leaderboard;
        leaderboard.add_game_played();
        
        emit!(WinnerFound {
            game_id: game.key(),
            winner: guess.guesser,
            guess_id: guess.key(),
            winning_guess: guess.guess_content.clone(),
        });
    }
    
    Ok(())
}

pub fn distribute_rewards(ctx: Context<DistributeRewards>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let vault = &mut ctx.accounts.vault;
    
    let total_fees = game.total_fees_collected;
    
    // Calculate reward amounts
    let winner_reward = total_fees
        .checked_mul(WINNER_REWARD_PERCENTAGE as u64)
        .unwrap()
        .checked_div(100)
        .unwrap();
    
    let creator_reward = total_fees
        .checked_mul(CREATOR_REWARD_PERCENTAGE as u64)
        .unwrap()
        .checked_div(100)
        .unwrap();
    
    // Transfer rewards to winner
    if let Some(winner_key) = game.winner {
        require!(
            winner_key == ctx.accounts.winner.key(),
            CapsuleXError::InvalidAccountOwner
        );
        
        let winner_transfer = anchor_lang::solana_program::system_instruction::transfer(
            &vault.key(),
            &ctx.accounts.winner.key(),
            winner_reward,
        );
        
        let vault_seeds = &[VAULT_SEED, &[vault.bump]];
        let vault_signer = &[&vault_seeds[..]];
        
        anchor_lang::solana_program::program::invoke_signed(
            &winner_transfer,
            &[
                vault.to_account_info(),
                ctx.accounts.winner.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            vault_signer,
        )?;
    }
    
    // Transfer rewards to creator
    let creator_transfer = anchor_lang::solana_program::system_instruction::transfer(
        &vault.key(),
        &ctx.accounts.creator.key(),
        creator_reward,
    );
    
    let vault_seeds = &[VAULT_SEED, &[vault.bump]];
    let vault_signer = &[&vault_seeds[..]];
    
    anchor_lang::solana_program::program::invoke_signed(
        &creator_transfer,
        &[
            vault.to_account_info(),
            ctx.accounts.creator.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        vault_signer,
    )?;
    
    // Update vault
    vault.add_rewards_distributed(winner_reward + creator_reward);
    
    // End game
    game.end_game();
    
    emit!(RewardsDistributed {
        game_id: game.key(),
        winner_reward,
        creator_reward,
        total_distributed: winner_reward + creator_reward,
    });
    
    Ok(())
}

// Helper function to verify guess content
// This is a simplified implementation - you'd implement proper verification logic
fn verify_guess_content(guess: &str, content_hash: &str) -> bool {
    // In a real implementation, you'd:
    // 1. Decrypt the content using the capsule's decryption key
    // 2. Compare the decrypted content with the guess
    // 3. Return true if they match
    
    // For demo purposes, we'll do a simple hash comparison
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    guess.hash(&mut hasher);
    let guess_hash = hasher.finish().to_string();
    
    guess_hash == *content_hash
}

#[event]
pub struct GameInitialized {
    pub game_id: Pubkey,
    pub capsule_id: Pubkey,
    pub creator: Pubkey,
    pub max_guesses: u32,
    pub guess_fee: u64,
}

#[event]
pub struct GuessSubmitted {
    pub guess_id: Pubkey,
    pub game_id: Pubkey,
    pub guesser: Pubkey,
    pub guess_content: String,
    pub is_paid: bool,
}

#[event]
pub struct WinnerFound {
    pub game_id: Pubkey,
    pub winner: Pubkey,
    pub guess_id: Pubkey,
    pub winning_guess: String,
}

#[event]
pub struct RewardsDistributed {
    pub game_id: Pubkey,
    pub winner_reward: u64,
    pub creator_reward: u64,
    pub total_distributed: u64,
} 