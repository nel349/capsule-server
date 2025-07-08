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
        encrypted_content: String,
        content_storage: ContentStorage,
        reveal_date: i64,
        is_gamified: bool,
    ) -> Result<()> {
        instructions::create_capsule(ctx, encrypted_content, content_storage, reveal_date, is_gamified)
    }

    pub fn reveal_capsule(
        ctx: Context<RevealCapsule>,
        reveal_date: i64,
    ) -> Result<()> {
        instructions::reveal_capsule(ctx, reveal_date)
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
    ) -> Result<()> {
        instructions::initialize_game(ctx, capsule_id, max_guesses)
    }

    pub fn submit_guess(
        ctx: Context<SubmitGuess>,
        guess_content: String,
        is_anonymous: bool,
    ) -> Result<()> {
        instructions::submit_guess(ctx, guess_content, is_anonymous)
    }

    pub fn verify_guess(
        ctx: Context<VerifyGuess>,
        decrypted_content: String,
        verification_window_hours: Option<u8>,
    ) -> Result<()> {
        instructions::verify_guess(ctx, decrypted_content, verification_window_hours)
    }

    pub fn complete_game(
        ctx: Context<CompleteGame>,
    ) -> Result<()> {
        instructions::complete_game(ctx)
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