use anchor_lang::prelude::*;
use crate::constants::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ContentStorage {
    // Plain text content (< 280 chars)
    Text,
    
    // Large text/files stored on IPFS
    Document { cid: String },
    
    // Preserved social media content with verification
    SocialArchive {
        original_url: String,
        archived_cid: String,
        platform: String,          // "x.com", "instagram", "tiktok", etc
        capture_timestamp: i64,
        content_hash: String,      // SHA256 for integrity verification
    },
    
    // Multi-media bundles (photos, videos, mixed content)
    MediaBundle {
        primary_cid: String,       // Main content CID
        attachments: Vec<String>,  // Additional media CIDs
        manifest_cid: String,      // Metadata manifest CID
        total_size_bytes: u64,     // For storage cost calculation
    },
    
    // External references with backup (links + archive)
    ExternalWithBackup {
        original_url: String,
        backup_cid: String,        // Archived version on IPFS
        verification_hash: String,
    }
}

#[account]
pub struct Capsule {
    pub creator: Pubkey,
    pub nft_mint: Pubkey,
    pub encrypted_content: String, // Encrypted content or reference based on storage type
    pub content_storage: ContentStorage, // Storage type and metadata
    pub content_integrity_hash: String, // SHA256 of original content for verification
    pub reveal_date: i64,
    pub created_at: i64,
    pub is_gamified: bool,
    pub is_revealed: bool,
    pub is_active: bool,
    pub bump: u8,
}

impl Capsule {
    pub const LEN: usize = CAPSULE_ACCOUNT_SIZE;
    
    pub fn new(
        creator: Pubkey,
        nft_mint: Pubkey,
        encrypted_content: String,
        content_storage: ContentStorage,
        content_integrity_hash: String,
        reveal_date: i64,
        is_gamified: bool,
        bump: u8,
    ) -> Self {
        let clock = Clock::get().unwrap();
        
        Self {
            creator,
            nft_mint,
            encrypted_content,
            content_storage,
            content_integrity_hash,
            reveal_date,
            created_at: clock.unix_timestamp,
            is_gamified,
            is_revealed: false,
            is_active: true,
            bump,
        }
    }
    
    pub fn can_reveal(&self) -> bool {
        let clock = Clock::get().unwrap();
        // Allow reveals up to 10 seconds before reveal_date to account for simulation timing
        (clock.unix_timestamp + 10) >= self.reveal_date && self.is_active
    }
    
    pub fn reveal(&mut self) {
        self.is_revealed = true;
    }
}

#[account]
pub struct Game {
    pub capsule_id: Pubkey,
    pub creator: Pubkey,
    pub max_guesses: u32,
    pub max_winners: u32,
    pub current_guesses: u32,
    pub winners_found: u32,
    pub total_participants: u32, // Track total participants for points
    pub is_active: bool,
    pub winner_found: bool, // Keep for backward compatibility
    pub winner: Option<Pubkey>, // Keep for backward compatibility (first winner)
    pub winners: Vec<Pubkey>, // All winners
    pub bump: u8,
}

impl Game {
    pub const LEN: usize = GAME_ACCOUNT_SIZE;
    
    pub fn new(
        capsule_id: Pubkey,
        creator: Pubkey,
        max_guesses: u32,
        max_winners: u32,
        bump: u8,
    ) -> Self {
        Self {
            capsule_id,
            creator,
            max_guesses,
            max_winners,
            current_guesses: 0,
            winners_found: 0,
            total_participants: 0,
            is_active: true,
            winner_found: false,
            winner: None,
            winners: Vec::new(),
            bump,
        }
    }
    
    pub fn can_accept_guess(&self) -> bool {
        self.is_active && self.winners_found < self.max_winners && self.current_guesses < self.max_guesses
    }
    
    pub fn add_guess(&mut self) {
        self.current_guesses += 1;
        self.total_participants += 1;
    }
    
    pub fn set_winner(&mut self, winner: Pubkey) {
        // Add to winners list
        self.winners.push(winner);
        self.winners_found += 1;
        
        // Update backward compatibility fields
        if self.winner.is_none() {
            self.winner = Some(winner);
        }
        self.winner_found = true;
    }
    
    pub fn should_end_game(&self) -> bool {
        self.winners_found >= self.max_winners || self.current_guesses >= self.max_guesses
    }
    
    pub fn end_game(&mut self) {
        self.is_active = false;
    }
}

#[account]
pub struct Guess {
    pub game_id: Pubkey,
    pub guesser: Pubkey,
    pub guess_content: String,
    pub timestamp: i64,
    pub is_paid: bool,
    pub is_correct: bool,
    pub is_anonymous: bool,
    pub bump: u8,
}

impl Guess {
    pub const LEN: usize = GUESS_ACCOUNT_SIZE;
    
    pub fn new(
        game_id: Pubkey,
        guesser: Pubkey,
        guess_content: String,
        is_paid: bool,
        is_anonymous: bool,
        bump: u8,
    ) -> Self {
        let clock = Clock::get().unwrap();
        
        Self {
            game_id,
            guesser,
            guess_content,
            timestamp: clock.unix_timestamp,
            is_paid,
            is_correct: false,
            is_anonymous,
            bump,
        }
    }
    
    pub fn mark_correct(&mut self) {
        self.is_correct = true;
    }
}

#[account]
pub struct LeaderboardEntry {
    pub user: Pubkey,
    pub total_points: u64,
    pub games_won: u32,
    pub games_played: u32,
    pub capsules_created: u32,
    pub total_rewards_earned: u64,
    pub bump: u8,
}

impl LeaderboardEntry {
    pub const LEN: usize = LEADERBOARD_ACCOUNT_SIZE;
    
    pub fn new(user: Pubkey, bump: u8) -> Self {
        Self {
            user,
            total_points: 0,
            games_won: 0,
            games_played: 0,
            capsules_created: 0,
            total_rewards_earned: 0,
            bump,
        }
    }
    
    pub fn add_points(&mut self, points: u64) {
        self.total_points += points;
        self.total_rewards_earned += points;
    }
    
    pub fn add_game_played(&mut self) {
        self.games_played += 1;
    }
    
    pub fn add_game_won(&mut self, points: u64) {
        self.games_won += 1;
        self.total_points += points;
        self.total_rewards_earned += points;
    }
    
    pub fn add_capsule_created(&mut self) {
        self.capsules_created += 1;
    }
}

#[account]
pub struct ProgramVault {
    pub authority: Pubkey,
    pub total_fees_collected: u64,
    pub total_rewards_distributed: u64,
    pub bump: u8,
}

impl ProgramVault {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 1;
    
    pub fn new(authority: Pubkey, bump: u8) -> Self {
        Self {
            authority,
            total_fees_collected: 0,
            total_rewards_distributed: 0,
            bump,
        }
    }
    
    pub fn add_fees(&mut self, amount: u64) {
        self.total_fees_collected += amount;
    }
    
    pub fn add_rewards_distributed(&mut self, amount: u64) {
        self.total_rewards_distributed += amount;
    }
}

 