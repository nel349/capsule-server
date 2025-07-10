// Constants for the CapsuleX program

// Program constants based on Helius fee analysis
pub const SOLANA_BASE_FEE: u64 = 5000; // 0.000005 SOL in lamports

// Fee structure (multipliers of base fee) - Service fees only, no gambling
pub const CAPSULE_CREATION_FEE: u64 = SOLANA_BASE_FEE * 10; // 0.00005 SOL
pub const SERVICE_FEE: u64 = SOLANA_BASE_FEE * 1; // 0.000005 SOL - Small service fee per guess
pub const PREMIUM_FEATURE_FEE: u64 = SOLANA_BASE_FEE * 5; // 0.000025 SOL
pub const BADGE_MINT_FEE: u64 = SOLANA_BASE_FEE * 5; // 0.000025 SOL
pub const TROPHY_MINT_FEE: u64 = SOLANA_BASE_FEE * 2; // 0.00001 SOL

// Points-based reward system (no monetary rewards)
pub const WINNER_POINTS: u64 = 100; // Points for correct guess
pub const PARTICIPATION_POINTS: u64 = 5; // Points for participating
pub const CREATOR_BONUS_POINTS: u64 = 50; // Points for creator when someone wins their game

// Game constraints
pub const MAX_GUESSES_PER_GAME: u32 = 100;
pub const MAX_CONTENT_HASH_LENGTH: usize = 64;
pub const MAX_GUESS_CONTENT_LENGTH: usize = 280; // Twitter length
pub const MAX_METADATA_URI_LENGTH: usize = 200;
pub const MAX_BADGE_TYPE_LENGTH: usize = 32;

// Content storage tiers
pub const MAX_ONCHAIN_CONTENT_LENGTH: usize = 280; // Twitter-sized content stored on-chain
pub const MAX_IPFS_HASH_LENGTH: usize = 64; // IPFS hash for larger content

// Time constraints
pub const MIN_REVEAL_DELAY: i64 = 1; // 1 second minimum (for testing)
pub const MAX_REVEAL_DELAY: i64 = 31536000; // 1 year maximum

// Account size constants
pub const CAPSULE_ACCOUNT_SIZE: usize = 8 + // discriminator
    32 + // creator
    32 + // nft_mint
    4 + 280 + // encrypted_content (String with max 280 chars for on-chain)
    1 + // content_storage (enum: OnChain vs IPFS)
    8 + // reveal_date
    8 + // created_at
    1 + // is_gamified
    1 + // is_revealed
    1 + // is_active
    1 + // bump
    64; // padding (increased since we removed key_vault field)

pub const GAME_ACCOUNT_SIZE: usize = 8 + // discriminator
    32 + // capsule_id
    32 + // creator
    4 + // max_guesses
    4 + // max_winners (new)
    4 + // current_guesses
    4 + // winners_found (new)
    4 + // total_participants
    1 + // is_active
    1 + // winner_found (backward compatibility)
    32 + // winner (optional, backward compatibility)
    4 + (32 * 10) + // winners: Vec<Pubkey> - reserve space for up to 10 winners
    1 + // bump
    128; // padding (increased for future expansion)

pub const GUESS_ACCOUNT_SIZE: usize = 8 + // discriminator
    32 + // game_id
    32 + // guesser
    280 + // guess_content
    8 + // timestamp
    1 + // is_paid
    1 + // is_correct
    1 + // is_anonymous
    31; // padding (reduced by 1 byte for is_anonymous)

pub const LEADERBOARD_ACCOUNT_SIZE: usize = 8 + // discriminator
    32 + // user
    8 + // total_points
    4 + // games_won
    4 + // games_played
    4 + // capsules_created
    8 + // total_rewards_earned
    32; // padding


// Seeds for PDAs
pub const CAPSULE_SEED: &[u8] = b"capsule";
pub const GAME_SEED: &[u8] = b"game";
pub const GUESS_SEED: &[u8] = b"guess";
pub const LEADERBOARD_SEED: &[u8] = b"leaderboard";
pub const VAULT_SEED: &[u8] = b"vault";
pub const CAPSULE_MINT_SEED: &[u8] = b"capsule_mint";
pub const BADGE_MINT_SEED: &[u8] = b"badge_mint";
pub const TROPHY_MINT_SEED: &[u8] = b"trophy_mint"; 