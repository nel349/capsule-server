use anchor_lang::prelude::*;

// Program modules
pub mod instructions;
pub mod state;
pub mod errors;
pub mod constants;

// Re-export for easier access
pub use instructions::*;
pub use state::*;
pub use errors::*;
pub use constants::*;

// Program ID - Replace with your actual program ID
declare_id!("J1r7tHjxEuCcSYVrikUKxzyeeccuC3QbyHjUbY8Pw7uH");

#[program]
pub mod capsulex {
    use super::*;

    // Time Capsule Instructions
    pub fn create_capsule(
        ctx: Context<CreateCapsule>,
        content_hash: String,
        reveal_date: i64,
        is_gamified: bool,
    ) -> Result<()> {
        instructions::create_capsule(ctx, content_hash, reveal_date, is_gamified)
    }

    pub fn reveal_capsule(
        ctx: Context<RevealCapsule>,
    ) -> Result<()> {
        instructions::reveal_capsule(ctx)
    }

    pub fn mint_capsule_nft(
        ctx: Context<MintCapsuleNft>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        instructions::mint_capsule_nft(ctx, name, symbol, uri)
    }

    // Game Instructions
    pub fn initialize_game(
        ctx: Context<InitializeGame>,
        capsule_id: Pubkey,
        max_guesses: u32,
        guess_fee: u64,
    ) -> Result<()> {
        instructions::initialize_game(ctx, capsule_id, max_guesses, guess_fee)
    }

    pub fn submit_guess(
        ctx: Context<SubmitGuess>,
        guess_content: String,
        is_paid: bool,
    ) -> Result<()> {
        instructions::submit_guess(ctx, guess_content, is_paid)
    }

    pub fn verify_guess(
        ctx: Context<VerifyGuess>,
        guess_id: Pubkey,
    ) -> Result<()> {
        instructions::verify_guess(ctx, guess_id)
    }

    pub fn distribute_rewards(
        ctx: Context<DistributeRewards>,
    ) -> Result<()> {
        instructions::distribute_rewards(ctx)
    }

    // NFT Badge Instructions
    pub fn mint_winner_badge(
        ctx: Context<MintWinnerBadge>,
        badge_type: String,
        metadata_uri: String,
    ) -> Result<()> {
        instructions::mint_winner_badge(ctx, badge_type, metadata_uri)
    }

    // Program Initialization
    pub fn initialize_program(
        ctx: Context<InitializeProgram>,
    ) -> Result<()> {
        instructions::initialize_program(ctx)
    }

    // Leaderboard Instructions
    pub fn initialize_leaderboard(
        ctx: Context<InitializeLeaderboard>,
        user: Pubkey,
    ) -> Result<()> {
        instructions::initialize_leaderboard(ctx, user)
    }

    pub fn update_leaderboard(
        ctx: Context<UpdateLeaderboard>,
        user: Pubkey,
        points: u64,
    ) -> Result<()> {
        instructions::update_leaderboard(ctx, user, points)
    }

    pub fn mint_trophy_nft(
        ctx: Context<MintTrophyNft>,
        trophy_type: String,
        metadata_uri: String,
    ) -> Result<()> {
        instructions::mint_trophy_nft(ctx, trophy_type, metadata_uri)
    }
} 