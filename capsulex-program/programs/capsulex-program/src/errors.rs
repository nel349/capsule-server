use anchor_lang::prelude::*;

#[error_code]
pub enum CapsuleXError {
    #[msg("Invalid reveal date. Must be between 1 hour and 1 year from now.")]
    InvalidRevealDate,
    
    #[msg("Content hash is too long. Maximum length is 64 characters.")]
    ContentHashTooLong,
    
    #[msg("Capsule is not yet ready to be revealed.")]
    CapsuleNotReady,
    
    #[msg("Capsule has already been revealed.")]
    CapsuleAlreadyRevealed,
    
    #[msg("Capsule is not active.")]
    CapsuleNotActive,
    
    #[msg("Only the capsule creator can perform this action.")]
    UnauthorizedCreator,
    
    #[msg("Game is not active.")]
    GameNotActive,
    
    #[msg("Maximum number of guesses reached for this game.")]
    MaxGuessesReached,
    
    #[msg("Guess content is too long. Maximum length is 280 characters.")]
    GuessContentTooLong,
    
    #[msg("Insufficient funds for paid guess.")]
    InsufficientFunds,
    
    #[msg("Winner has already been found for this game.")]
    WinnerAlreadyFound,
    
    #[msg("Guess is not correct.")]
    IncorrectGuess,
    
    #[msg("Rewards have already been distributed.")]
    RewardsAlreadyDistributed,
    
    #[msg("No fees collected to distribute.")]
    NoFeesToDistribute,
    
    #[msg("Metadata URI is too long. Maximum length is 200 characters.")]
    MetadataUriTooLong,
    
    #[msg("Badge type is too long. Maximum length is 32 characters.")]
    BadgeTypeTooLong,
    
    #[msg("Invalid fee amount.")]
    InvalidFeeAmount,
    
    #[msg("Arithmetic overflow occurred.")]
    ArithmeticOverflow,
    
    #[msg("Invalid percentage. Must be between 0 and 100.")]
    InvalidPercentage,
    
    #[msg("Game has not ended yet.")]
    GameNotEnded,
    
    #[msg("User is not eligible for this reward.")]
    NotEligibleForReward,
    
    #[msg("NFT mint failed.")]
    NftMintFailed,
    
    #[msg("Token account creation failed.")]
    TokenAccountCreationFailed,
    
    #[msg("Invalid account owner.")]
    InvalidAccountOwner,
    
    #[msg("Account is not initialized.")]
    AccountNotInitialized,
    
    #[msg("Invalid program authority.")]
    InvalidProgramAuthority,
    
    #[msg("Clock not available.")]
    ClockNotAvailable,
    
    #[msg("Invalid system program.")]
    InvalidSystemProgram,
    
    #[msg("Invalid token program.")]
    InvalidTokenProgram,
    
    #[msg("Invalid associated token program.")]
    InvalidAssociatedTokenProgram,
    
    #[msg("Invalid metadata program.")]
    InvalidMetadataProgram,
    
    #[msg("Capsule is not gamified.")]
    CapsuleNotGamified,
    
    #[msg("Only paid guesses are eligible for rewards.")]
    OnlyPaidGuessesEligible,
    
    #[msg("Invalid guess ID.")]
    InvalidGuessId,
    
    #[msg("User already has a leaderboard entry.")]
    LeaderboardEntryExists,
    
    #[msg("Leaderboard entry not found.")]
    LeaderboardEntryNotFound,
} 