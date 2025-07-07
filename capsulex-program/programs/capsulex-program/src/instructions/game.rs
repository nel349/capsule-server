use anchor_lang::prelude::*;
use crate::{
    constants::*, 
    errors::CapsuleXError, 
    state::{Capsule, Game, Guess, ProgramVault, LeaderboardEntry}
};

#[derive(Accounts)]
#[instruction(capsule_id: Pubkey, max_guesses: u32)]
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
#[instruction(guess_content: String, is_anonymous: bool)]
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
#[instruction(decrypted_content: String, verification_window_hours: Option<u8>)]
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
pub struct CompleteGame<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        constraint = game.winner_found || game.current_guesses >= game.max_guesses @ CapsuleXError::GameNotEnded
    )]
    pub game: Account<'info, Game>,
    
    #[account(
        mut,
        seeds = [LEADERBOARD_SEED, game.creator.as_ref()],
        bump
    )]
    pub creator_leaderboard: Account<'info, LeaderboardEntry>,
    
    pub system_program: Program<'info, System>,
}

pub fn initialize_game(
    ctx: Context<InitializeGame>,
    capsule_id: Pubkey,
    max_guesses: u32,
) -> Result<()> {
    // Validate max guesses
    require!(
        max_guesses > 0 && max_guesses <= MAX_GUESSES_PER_GAME,
        CapsuleXError::InvalidFeeAmount
    );
    
    // Initialize game
    let game = &mut ctx.accounts.game;
    **game = Game::new(
        capsule_id,
        ctx.accounts.creator.key(),
        max_guesses,
        ctx.bumps.game,
    );
    
    emit!(GameInitialized {
        game_id: game.key(),
        capsule_id,
        creator: ctx.accounts.creator.key(),
        max_guesses,
    });
    
    Ok(())
}

pub fn submit_guess(
    ctx: Context<SubmitGuess>,
    guess_content: String,
    is_anonymous: bool,
) -> Result<()> {
    // Validate guess content length
    require!(
        guess_content.len() <= MAX_GUESS_CONTENT_LENGTH,
        CapsuleXError::GuessContentTooLong
    );
    
    let game = &mut ctx.accounts.game;
    
    // Check if game can accept more guesses
    require!(game.can_accept_guess(), CapsuleXError::MaxGuessesReached);
    
    // Charge small service fee (covers gas + platform costs)
    let service_fee_amount = SERVICE_FEE;
    
    // Transfer service fee to vault
    let transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
        &ctx.accounts.guesser.key(),
        &ctx.accounts.vault.key(),
        service_fee_amount,
    );
    
    anchor_lang::solana_program::program::invoke(
        &transfer_instruction,
        &[
            ctx.accounts.guesser.to_account_info(),
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;
    
    ctx.accounts.vault.add_fees(service_fee_amount);
    
    // Initialize guess
    let guess = &mut ctx.accounts.guess;
    **guess = Guess::new(
        game.key(),
        ctx.accounts.guesser.key(),
        guess_content.clone(),
        true, // All guesses are service-fee paid (no gambling)
        is_anonymous,
        ctx.bumps.guess,
    );
    
    // Update game
    game.add_guess();
    
    emit!(GuessSubmitted {
        guess_id: guess.key(),
        game_id: game.key(),
        guesser: ctx.accounts.guesser.key(),
        guess_content,
        is_paid: true, // Always true now (service fee)
        is_anonymous,
    });
    
    Ok(())
}

pub fn verify_guess(
    ctx: Context<VerifyGuess>,
    decrypted_content: String,
    verification_window_hours: Option<u8>,
) -> Result<()> {
    let guess = &mut ctx.accounts.guess;
    let game = &mut ctx.accounts.game;
    let capsule = &ctx.accounts.capsule;
    
    // Ensure the capsule has been revealed
    require!(capsule.is_revealed, CapsuleXError::CapsuleNotReady);
    
    // Check if we're within the verification window
    let clock = Clock::get()?;
    let window_hours = verification_window_hours.unwrap_or(1) as i64;
    let verification_deadline = capsule.reveal_date + (window_hours * 3600); // hours after reveal
    
    require!(
        clock.unix_timestamp <= verification_deadline,
        CapsuleXError::GameNotEnded
    );
    
    // Verify the guess against the decrypted content
    let is_correct = guess.guess_content.trim().to_lowercase() == decrypted_content.trim().to_lowercase();
    
    // Update leaderboard for participation
    let leaderboard = &mut ctx.accounts.leaderboard;
    leaderboard.add_game_played();
    leaderboard.add_points(PARTICIPATION_POINTS);
    
    if is_correct && !game.winner_found {
        // Mark guess as correct
        guess.mark_correct();
        
        // Set winner in game
        game.set_winner(guess.guesser);
        
        // Award winner points
        leaderboard.add_game_won(WINNER_POINTS);
        
        emit!(WinnerFound {
            game_id: game.key(),
            winner: guess.guesser,
            guess_id: guess.key(),
            winning_guess: guess.guess_content.clone(),
        });
        
        emit!(PointsAwarded {
            user: guess.guesser,
            game_id: game.key(),
            points: WINNER_POINTS,
            reason: "Winner".to_string(),
        });
    } else {
        emit!(PointsAwarded {
            user: guess.guesser,
            game_id: game.key(),
            points: PARTICIPATION_POINTS,
            reason: "Participation".to_string(),
        });
    }
    
    Ok(())
}

pub fn complete_game(ctx: Context<CompleteGame>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    
    // Ensure game has ended (winner found or max guesses reached)
    require!(
        game.winner_found || game.current_guesses >= game.max_guesses,
        CapsuleXError::GameNotEnded
    );
    
    // Award bonus points to capsule creator for engagement
    if game.total_participants > 0 {
        // Creator gets bonus points based on participation
        let creator_leaderboard = &mut ctx.accounts.creator_leaderboard;
        let bonus_points = CREATOR_BONUS_POINTS * (game.total_participants as u64);
        creator_leaderboard.add_points(bonus_points);
        
        emit!(PointsAwarded {
            user: game.creator,
            game_id: game.key(),
            points: bonus_points,
            reason: "Creator Engagement Bonus".to_string(),
        });
    }
    
    // End the game
    game.end_game();
    
    emit!(GameCompleted {
        game_id: game.key(),
        total_participants: game.total_participants,
        winner_found: game.winner_found,
        winner: game.winner,
    });
    
    Ok(())
}


#[event]
pub struct GameInitialized {
    pub game_id: Pubkey,
    pub capsule_id: Pubkey,
    pub creator: Pubkey,
    pub max_guesses: u32,
}

#[event]
pub struct GuessSubmitted {
    pub guess_id: Pubkey,
    pub game_id: Pubkey,
    pub guesser: Pubkey,
    pub guess_content: String,
    pub is_paid: bool,
    pub is_anonymous: bool,
}

#[event]
pub struct WinnerFound {
    pub game_id: Pubkey,
    pub winner: Pubkey,
    pub guess_id: Pubkey,
    pub winning_guess: String,
}

#[event]
pub struct PointsAwarded {
    pub user: Pubkey,
    pub game_id: Pubkey,
    pub points: u64,
    pub reason: String,
}

#[event]
pub struct GameCompleted {
    pub game_id: Pubkey,
    pub total_participants: u32,
    pub winner_found: bool,
    pub winner: Option<Pubkey>,
} 