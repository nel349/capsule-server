// Constants for the CapsuleX program

// Program constants based on Helius fee analysis
pub const SOLANA_BASE_FEE: u64 = 5000; // 0.000005 SOL in lamports

// Fee structure (multipliers of base fee)
pub const CAPSULE_CREATION_FEE: u64 = SOLANA_BASE_FEE * 10; // 0.00005 SOL
pub const GUESSING_FEE: u64 = SOLANA_BASE_FEE * 2; // 0.00001 SOL
pub const PREMIUM_FEATURE_FEE: u64 = SOLANA_BASE_FEE * 5; // 0.000025 SOL
pub const BADGE_MINT_FEE: u64 = SOLANA_BASE_FEE * 5; // 0.000025 SOL
pub const TROPHY_MINT_FEE: u64 = SOLANA_BASE_FEE * 2; // 0.00001 SOL

// Reward distribution percentages
pub const WINNER_REWARD_PERCENTAGE: u8 = 50; // 50% to winner
pub const CREATOR_REWARD_PERCENTAGE: u8 = 20; // 20% to creator
pub const APP_FEE_PERCENTAGE: u8 = 30; // 30% to app

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
    32 + // key_vault
    1 + // bump
    32; // padding

pub const GAME_ACCOUNT_SIZE: usize = 8 + // discriminator
    32 + // capsule_id
    32 + // creator
    4 + // max_guesses
    4 + // current_guesses
    8 + // guess_fee
    8 + // total_fees_collected
    1 + // is_active
    1 + // winner_found
    32 + // winner (optional)
    32; // padding

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

pub const KEY_VAULT_ACCOUNT_SIZE: usize = 8 + // discriminator
    32 + // capsule_id
    32 + // encryption_key (256-bit AES key)
    8 + // reveal_date
    32 + // creator
    1 + // is_retrieved
    1 + // bump
    32; // padding

// Seeds for PDAs
pub const CAPSULE_SEED: &[u8] = b"capsule";
pub const GAME_SEED: &[u8] = b"game";
pub const GUESS_SEED: &[u8] = b"guess";
pub const LEADERBOARD_SEED: &[u8] = b"leaderboard";
pub const VAULT_SEED: &[u8] = b"vault";
pub const KEY_VAULT_SEED: &[u8] = b"key_vault";
pub const BADGE_MINT_SEED: &[u8] = b"badge_mint";
pub const TROPHY_MINT_SEED: &[u8] = b"trophy_mint"; 