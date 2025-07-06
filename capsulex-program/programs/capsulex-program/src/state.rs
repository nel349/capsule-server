use anchor_lang::prelude::*;
use crate::constants::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ContentStorage {
    OnChain,  // Content stored directly in encrypted_content field
    IPFS,     // IPFS hash stored in encrypted_content field, actual content on IPFS
}

#[account]
pub struct Capsule {
    pub creator: Pubkey,
    pub nft_mint: Pubkey,
    pub encrypted_content: String, // Either encrypted content OR IPFS hash
    pub content_storage: ContentStorage, // OnChain or IPFS
    pub reveal_date: i64,
    pub created_at: i64,
    pub is_gamified: bool,
    pub is_revealed: bool,
    pub is_active: bool,
    pub key_vault: Pubkey, // Reference to time-locked key storage
    pub bump: u8,
}

impl Capsule {
    pub const LEN: usize = CAPSULE_ACCOUNT_SIZE;
    
    pub fn new(
        creator: Pubkey,
        nft_mint: Pubkey,
        encrypted_content: String,
        content_storage: ContentStorage,
        reveal_date: i64,
        is_gamified: bool,
        key_vault: Pubkey,
        bump: u8,
    ) -> Self {
        let clock = Clock::get().unwrap();
        
        Self {
            creator,
            nft_mint,
            encrypted_content,
            content_storage,
            reveal_date,
            created_at: clock.unix_timestamp,
            is_gamified,
            is_revealed: false,
            is_active: true,
            key_vault,
            bump,
        }
    }
    
    pub fn can_reveal(&self) -> bool {
        let clock = Clock::get().unwrap();
        clock.unix_timestamp >= self.reveal_date && self.is_active
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
    pub current_guesses: u32,
    pub guess_fee: u64,
    pub total_fees_collected: u64,
    pub is_active: bool,
    pub winner_found: bool,
    pub winner: Option<Pubkey>,
    pub bump: u8,
}

impl Game {
    pub const LEN: usize = GAME_ACCOUNT_SIZE;
    
    pub fn new(
        capsule_id: Pubkey,
        creator: Pubkey,
        max_guesses: u32,
        guess_fee: u64,
        bump: u8,
    ) -> Self {
        Self {
            capsule_id,
            creator,
            max_guesses,
            current_guesses: 0,
            guess_fee,
            total_fees_collected: 0,
            is_active: true,
            winner_found: false,
            winner: None,
            bump,
        }
    }
    
    pub fn can_accept_guess(&self) -> bool {
        self.is_active && !self.winner_found && self.current_guesses < self.max_guesses
    }
    
    pub fn add_guess(&mut self, is_paid: bool) {
        self.current_guesses += 1;
        if is_paid {
            self.total_fees_collected += self.guess_fee;
        }
    }
    
    pub fn set_winner(&mut self, winner: Pubkey) {
        self.winner = Some(winner);
        self.winner_found = true;
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
    }
    
    pub fn add_game_played(&mut self) {
        self.games_played += 1;
    }
    
    pub fn add_game_won(&mut self, reward_amount: u64) {
        self.games_won += 1;
        self.total_rewards_earned += reward_amount;
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

#[account]
pub struct KeyVault {
    pub capsule_id: Pubkey,
    pub encryption_key: [u8; 32], // AES-256 key
    pub reveal_date: i64,
    pub creator: Pubkey,
    pub is_retrieved: bool,
    pub bump: u8,
}

impl KeyVault {
    pub const LEN: usize = KEY_VAULT_ACCOUNT_SIZE;
    
    pub fn new(
        capsule_id: Pubkey,
        encryption_key: [u8; 32],
        reveal_date: i64,
        creator: Pubkey,
        bump: u8,
    ) -> Self {
        Self {
            capsule_id,
            encryption_key,
            reveal_date,
            creator,
            is_retrieved: false,
            bump,
        }
    }
    
    pub fn can_retrieve(&self) -> bool {
        let clock = Clock::get().unwrap();
        clock.unix_timestamp >= self.reveal_date && !self.is_retrieved
    }
    
    pub fn mark_retrieved(&mut self) {
        self.is_retrieved = true;
    }
} 