# CapsuleX Anchor Program - Complete Implementation Summary

## Overview
This document provides a complete overview of the CapsuleX Anchor program structure, clarifying exactly where and why SPL tokens are used in your time capsule and gamified guessing game project.

## SPL Token Usage Clarification

### ✅ **WHERE SPL Tokens ARE Used:**
1. **Time Capsule NFTs**: Each capsule is minted as an NFT using `anchor-spl`
2. **Winner Badge NFTs**: Game winners receive NFT badges as rewards
3. **Trophy NFTs**: Achievement-based NFTs for leaderboard milestones

### ❌ **WHERE SPL Tokens are NOT Used:**
1. **Payment Currency**: Service fees use SOL, rewards are points-based
2. **Custom Tokens**: No custom fungible tokens are created
3. **Game Economics**: Points-based reward system (no gambling)

## Program Architecture

### Core Account Structures
```rust
// Time capsule with NFT mint reference
pub struct Capsule {
    pub creator: Pubkey,
    pub nft_mint: Pubkey,        // SPL Token mint for NFT
    pub content_hash: String,
    pub reveal_date: i64,
    pub is_gamified: bool,
    // ... other fields
}

// Game state with points-based rewards
pub struct Game {
    pub capsule_id: Pubkey,
    pub max_guesses: u32,
    pub total_participants: u32,  // Participants for points calculation
    pub winner: Option<Pubkey>,
    // ... other fields
}
```

### Fee Structure (Service Fees Only)
- **Base Fee**: 0.000005 SOL (5000 lamports)
- **Capsule Creation**: 0.00005 SOL (10x base)
- **Service Fee per Guess**: 0.000005 SOL (1x base) - covers gas + platform costs
- **Premium Features**: 0.000025 SOL (5x base)

### Reward Distribution (Points-Based)
- **100 points** to game winner (correct guess)
- **5 points** to all participants
- **50 points per participant** to capsule creator (engagement bonus)
- **No monetary gambling** - entertainment only

### Hybrid Storage Validation Update (2024-06)
- The program now supports both on-chain and IPFS storage for encrypted capsule content.
- **OnChain:** Content (encrypted) must be ≤280 characters.
- **IPFS:** Content must start with 'Qm' and be between 46 and 59 characters (supports IPFS v0/v1 CIDs).
- This makes the program compatible with current and future IPFS hash formats.

#### Test Suite Update
- The test for IPFS storage now uses a valid mock IPFS hash: `"Qm" + "a".repeat(44)` (46 chars).
- This ensures the test passes and matches the program's validation logic.

## Key Instructions

### 1. Time Capsule Operations
```rust
// Create capsule with NFT mint
pub fn create_capsule(
    ctx: Context<CreateCapsule>,
    content_hash: String,
    reveal_date: i64,
    is_gamified: bool,
) -> Result<()>

// Mint capsule as NFT (uses anchor-spl)
pub fn mint_capsule_nft(
    ctx: Context<MintCapsuleNft>,
    name: String,
    symbol: String,
    uri: String,
) -> Result<()>
```

### 2. Game Operations
```rust
// Initialize game with participant limits only
pub fn initialize_game(
    ctx: Context<InitializeGame>,
    capsule_id: Pubkey,
    max_guesses: u32,  // No gambling fees
) -> Result<()>

// Submit guess with small service fee
pub fn submit_guess(
    ctx: Context<SubmitGuess>,
    guess_content: String,
    is_anonymous: bool,  // User privacy control
) -> Result<()>

// Complete game and award points
pub fn complete_game(
    ctx: Context<CompleteGame>,
) -> Result<()>
```

### 3. NFT Operations (anchor-spl usage)
```rust
// Mint winner badge NFT
pub fn mint_winner_badge(
    ctx: Context<MintWinnerBadge>,
    badge_type: String,
    metadata_uri: String,
) -> Result<()>

// Mint trophy NFT
pub fn mint_trophy_nft(
    ctx: Context<MintTrophyNft>,
    trophy_type: String,
    metadata_uri: String,
) -> Result<()>
```

## Dependencies (Cargo.toml)
```toml
[dependencies]
anchor-lang = "0.31.0"
anchor-spl = "0.31.0"    # ONLY for NFT minting
solana-program = "1.18.0"

[features]
idl-build = [
    "anchor-lang/idl-build",
    "anchor-spl/idl-build",  # Required for NFT operations
]
```

## Program Flow

### 1. Time Capsule Creation
1. User pays 0.00005 SOL creation fee
2. Program creates `Capsule` account
3. Program creates NFT `Mint` account (using anchor-spl)
4. Content stored on IPFS, hash stored in capsule
5. Optional: Initialize guessing game

### 2. Guessing Game Flow
1. Creator initializes game with participant limits
2. Users submit guesses (small service fee covers gas + platform costs)
3. Program verifies correct guesses after capsule reveal
4. Points awarded: 100 to winner, 5 to all participants, 50 per participant to creator
5. Winner receives NFT badge (using anchor-spl)

### 3. Achievement System
1. User stats tracked in `LeaderboardEntry`
2. Achievements unlock trophy NFT eligibility
3. Trophies minted as NFTs (using anchor-spl)

## Security Features
- PDA-based account generation
- Time-based reveal validation
- Authorization checks for all operations
- Overflow protection for arithmetic
- Comprehensive error handling

## Integration Points
- **IPFS/Filecoin**: Content storage (off-chain)
- **X API**: Social sharing and hints (off-chain)
- **ElevenLabs**: AI audio generation (off-chain)
- **Solana Mobile SDK**: TEEPIN/SKR integration (mobile)
- **React Native**: Mobile app interface (client)

## File Structure
```
programs/capsulex/
├── Cargo.toml                 # Dependencies and features
├── src/
│   ├── lib.rs                 # Program entry point
│   ├── state.rs               # Account structures
│   ├── constants.rs           # Fees and limits
│   ├── errors.rs              # Custom errors
│   └── instructions/
│       ├── mod.rs             # Module exports
│       ├── capsule.rs         # Time capsule logic
│       ├── game.rs            # Guessing game logic
│       ├── nft.rs             # NFT minting (anchor-spl)
│       └── leaderboard.rs     # Stats and initialization
├── README.md                  # Program documentation
└── Anchor.toml               # Anchor configuration
```

## Summary

Your CapsuleX project uses SPL tokens **exclusively for NFT functionality** (capsules, badges, trophies) through the `anchor-spl` crate. The core game economics use a **points-based reward system** with minimal service fees (no gambling), making it legally compliant and focused on entertainment. This design perfectly balances functionality with legal safety - you get engaging gameplay without gambling concerns.

The program is now complete and ready for integration with your React Native mobile app and off-chain services (IPFS, X API, ElevenLabs, etc.). 

### Testing & Debugging
- Tests now cover both on-chain and IPFS storage types.
- IPFS hash validation is flexible for v0/v1 CIDs.
- Mock hashes in tests must be 46-59 chars and start with 'Qm'. 