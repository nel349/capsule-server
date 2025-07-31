# CapsuleX V2 Technical Specification: Creator Economy & Bond System

## Program Architecture

### Account Structures

#### BondedGameCapsule Account (Enhanced with Creator Revenue)
```rust
// Size calculation: ~400 bytes total with creator revenue tracking
#[account]
pub struct BondedGameCapsule {
    // Account discriminator (8 bytes)
    
    // Core capsule data (from V1)
    pub creator: Pubkey,                     // 32 bytes - Creator's wallet
    pub reveal_date: i64,                    // 8 bytes - When capsule can be revealed
    pub is_revealed: bool,                   // 1 byte - Has capsule been revealed
    pub is_gamified: bool,                   // 1 byte - Is this a game capsule
    pub content_hash: String,                // 32 bytes - SHA256 of encrypted content
    pub bump: u8,                           // 1 byte - PDA bump seed
    
    // Bond system fields
    pub max_guesses: u32,                   // 4 bytes - Creator-set maximum guesses
    pub current_max_guesses: u32,           // 4 bytes - Dynamic limit based on bond
    pub current_guesses: u32,               // 4 bytes - Current number of guesses
    pub deposited_bond: u64,                // 8 bytes - Total bond deposited
    pub remaining_bond: u64,                // 8 bytes - Current bond balance
    pub bond_account: Pubkey,               // 32 bytes - PDA holding bond funds
    
    // NEW: Creator Revenue System
    pub guess_submission_fee: u64,          // 8 bytes - Lamports per guess (e.g., 3000)
    pub creator_revenue_share_bps: u16,     // 2 bytes - Basis points (2500 = 25%)
    pub total_guess_fees_collected: u64,    // 8 bytes - Total fees from all guesses
    pub creator_earnings_accumulated: u64,  // 8 bytes - Creator's share earned
    pub creator_earnings_claimed: u64,      // 8 bytes - Amount creator withdrew
    
    // Bond management & validation
    pub validation_cost_per_guess: u64,     // 8 bytes - Cost to validate one guess
    pub validation_deadline: i64,           // 8 bytes - Creator validation deadline
    pub creator_validated: bool,            // 1 byte - Did creator validate on time
    pub validation_costs_used: u64,         // 8 bytes - Bond used for validation
    pub player_refunds_issued: u64,         // 8 bytes - Bond used for refunds
    
    // Dynamic adjustments
    pub bond_adjustments: u8,               // 1 byte - Number of adjustments made
    pub last_adjustment: i64,               // 8 bytes - Timestamp of last adjustment
    
    // Player protection
    pub protection_level: PlayerProtectionLevel, // 1 byte - Protection level enum
    
    // Reserved for future use
    pub reserved: [u8; 32],                 // 32 bytes - Future expansion
}

impl BondedGameCapsule {
    pub const LEN: usize = 8 + 32 + 8 + 1 + 1 + 32 + 1 + 4 + 4 + 4 + 8 + 8 + 32 + 8 + 2 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 8 + 1 + 8 + 1 + 32;
    // Total: ~400 bytes
}

#### CreatorEarnings Account (NEW - Cross-Capsule Revenue Tracking)
```rust
#[account]
pub struct CreatorEarnings {
    pub creator: Pubkey,                    // 32 bytes - Creator wallet
    pub total_earned: u64,                  // 8 bytes - Lifetime earnings
    pub total_claimed: u64,                 // 8 bytes - Total withdrawn
    pub available_balance: u64,             // 8 bytes - Available to withdraw
    pub last_claim: i64,                    // 8 bytes - Last withdrawal timestamp
    pub capsule_count: u32,                 // 4 bytes - Number of capsules created
    pub total_guesses_received: u64,        // 8 bytes - Total guesses across all capsules
    pub average_earnings_per_game: u64,     // 8 bytes - Performance metric
    pub best_performing_capsule: Pubkey,    // 32 bytes - Highest earning capsule
    pub creator_tier: CreatorTier,          // 1 byte - Free, Pro, Enterprise
    pub tier_upgraded_at: i64,              // 8 bytes - When tier was upgraded
    pub bump: u8,                          // 1 byte - PDA bump seed
}

impl CreatorEarnings {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 8 + 8 + 4 + 8 + 8 + 32 + 1 + 8 + 1;
    // Total: 132 bytes
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum CreatorTier {
    Free,        // Basic features, 20% revenue share
    Pro,         // Premium features, 30% revenue share  
    Enterprise,  // Advanced features, 35% revenue share
}
```

#### BondAccount (PDA)
```rust
#[account]
pub struct BondAccount {
    pub capsule: Pubkey,                    // 32 bytes - Associated capsule
    pub creator: Pubkey,                    // 32 bytes - Creator who deposited bond
    pub initial_amount: u64,                // 8 bytes - Original bond amount
    pub current_balance: u64,               // 8 bytes - Current balance
    pub created_at: i64,                    // 8 bytes - Creation timestamp
    pub bump: u8,                          // 1 byte - PDA bump seed
}

impl BondAccount {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1;
    // Total: 97 bytes
}
```

### PDA Derivation Seeds

```rust
// Bond Account PDA
pub const BOND_SEED: &[u8] = b"bond";
// Seeds: [BOND_SEED, capsule_pubkey, creator_pubkey]

// Enhanced Capsule PDA (maintains V1 compatibility)
pub const CAPSULE_SEED: &[u8] = b"capsule_v2";
// Seeds: [CAPSULE_SEED, creator_pubkey, &reveal_date.to_le_bytes()]

// Game PDA (unchanged from V1)
pub const GAME_SEED: &[u8] = b"game";
// Seeds: [GAME_SEED, capsule_pubkey]

// Guess PDA (unchanged from V1) 
pub const GUESS_SEED: &[u8] = b"guess";
// Seeds: [GUESS_SEED, game_pubkey, guesser_pubkey, &guess_index.to_le_bytes()]
```

### Instruction Specifications

#### CreateBondedCapsule
```rust
#[derive(Accounts)]
#[instruction(
    encrypted_content: String,
    content_storage: ContentStorage,
    content_integrity_hash: String,
    reveal_date: i64,
    is_gamified: bool,
    max_guesses: u32,
    protection_level: PlayerProtectionLevel,
    bond_amount: u64
)]
pub struct CreateBondedCapsule<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        init,
        payer = creator,
        space = BondedGameCapsule::LEN,
        seeds = [CAPSULE_SEED, creator.key().as_ref(), &reveal_date.to_le_bytes()],
        bump
    )]
    pub capsule: Account<'info, BondedGameCapsule>,
    
    #[account(
        init,
        payer = creator,
        space = BondAccount::LEN,
        seeds = [BOND_SEED, capsule.key().as_ref(), creator.key().as_ref()],
        bump
    )]
    pub bond_account: Account<'info, BondAccount>,
    
    // Standard capsule accounts (NFT mint, vault, etc.)
    #[account(
        init,
        payer = creator,
        mint::decimals = 0,
        mint::authority = capsule,
        seeds = [CAPSULE_MINT_SEED, capsule.key().as_ref()],
        bump
    )]
    pub nft_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: Account<'info, ProgramVault>,
    
    // Game account (if gamified)
    /// CHECK: Only used when is_gamified = true
    #[account(mut)]
    pub game: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

// Instruction data validation
pub fn create_bonded_capsule(
    ctx: Context<CreateBondedCapsule>,
    encrypted_content: String,
    content_storage: ContentStorage,
    content_integrity_hash: String,
    reveal_date: i64,
    is_gamified: bool,
    max_guesses: u32,
    protection_level: PlayerProtectionLevel,
    bond_amount: u64,
) -> Result<()> {
    // Validation checks
    require!(is_gamified, CapsuleXError::BondOnlyForGames);
    require!(max_guesses > 0 && max_guesses <= 10000, CapsuleXError::InvalidGuessLimit);
    
    let required_bond = calculate_required_bond(max_guesses, protection_level);
    require!(bond_amount >= required_bond, CapsuleXError::InsufficientBond);
    
    let clock = Clock::get()?;
    require!(reveal_date > clock.unix_timestamp, CapsuleXError::InvalidRevealDate);
    
    // Initialize accounts...
    Ok(())
}
```

#### SubmitGuessWithBondCheck
```rust
#[derive(Accounts)]
pub struct SubmitGuessWithBondCheck<'info> {
    #[account(mut)]
    pub guesser: Signer<'info>,
    
    #[account(
        mut,
        constraint = capsule.is_gamified @ CapsuleXError::NotGameCapsule,
        constraint = !capsule.is_revealed @ CapsuleXError::CapsuleAlreadyRevealed
    )]
    pub capsule: Account<'info, BondedGameCapsule>,
    
    #[account(
        mut,
        seeds = [GAME_SEED, capsule.key().as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,
    
    #[account(
        init,
        payer = guesser,
        space = Guess::LEN,
        seeds = [
            GUESS_SEED,
            game.key().as_ref(),
            guesser.key().as_ref(),
            &game.current_guesses.to_le_bytes()
        ],
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

pub fn submit_guess_with_bond_check(
    ctx: Context<SubmitGuessWithBondCheck>,
    guess_content: String,
    is_anonymous: bool,
) -> Result<()> {
    let capsule = &mut ctx.accounts.capsule;
    let game = &mut ctx.accounts.game;
    
    // Bond-specific validations
    require!(
        capsule.current_guesses < capsule.current_max_guesses,
        CapsuleXError::MaxGuessesReached
    );
    
    // Check bond can cover potential costs
    let cost_per_guess = calculate_cost_per_guess(capsule);
    let required_bond_balance = cost_per_guess;
    
    if capsule.remaining_bond < required_bond_balance {
        // Auto-adjust max guesses
        let affordable_guesses = capsule.remaining_bond / cost_per_guess;
        let new_max = std::cmp::max(affordable_guesses as u32, capsule.current_guesses + 1);
        
        if new_max <= capsule.current_guesses {
            return Err(CapsuleXError::InsufficientBondBalance.into());
        }
        
        capsule.current_max_guesses = new_max;
        capsule.bond_adjustments += 1;
        capsule.last_adjustment = Clock::get()?.unix_timestamp;
        
        emit!(BondAdjusted {
            capsule: capsule.key(),
            old_max: capsule.max_guesses,
            new_max,
            remaining_bond: capsule.remaining_bond,
        });
    }
    
    // Standard guess submission logic (from V1)
    let guess = &mut ctx.accounts.guess;
    guess.game = game.key();
    guess.guesser = ctx.accounts.guesser.key();
    guess.guess_content = guess_content;
    guess.is_anonymous = is_anonymous;
    guess.submitted_at = Clock::get()?.unix_timestamp;
    guess.is_correct = false; // To be determined during validation
    guess.bump = *ctx.bumps.get("guess").unwrap();
    
    // Update counters
    game.current_guesses += 1;
    capsule.current_guesses += 1;
    
    // Collect guess submission fee
    let vault = &mut ctx.accounts.vault;
    vault.total_fees_collected += capsule.guess_submission_cost;
    
    emit!(GuessSubmitted {
        capsule: capsule.key(),
        game: game.key(),
        guess: guess.key(),
        guesser: ctx.accounts.guesser.key(),
        guess_number: game.current_guesses,
        bond_adjusted: capsule.bond_adjustments > 0,
    });
    
    Ok(())
}
```

#### ProcessBondRefund
```rust
#[derive(Accounts)]
pub struct ProcessBondRefund<'info> {
    /// CHECK: Can be creator or authorized processor
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        constraint = capsule.creator == authority.key() || 
                     authority.key() == crate::constants::BOND_PROCESSOR_AUTHORITY @ CapsuleXError::UnauthorizedBondProcessor
    )]
    pub capsule: Account<'info, BondedGameCapsule>,
    
    #[account(
        mut,
        seeds = [BOND_SEED, capsule.key().as_ref(), capsule.creator.as_ref()],
        bump
    )]
    pub bond_account: Account<'info, BondAccount>,
    
    /// CHECK: Creator's wallet for refund
    #[account(mut)]
    pub creator: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn process_bond_refund(ctx: Context<ProcessBondRefund>) -> Result<()> {
    let capsule = &mut ctx.accounts.capsule;
    let bond_account = &mut ctx.accounts.bond_account;
    let clock = Clock::get()?;
    
    // Validation checks
    require!(
        clock.unix_timestamp > capsule.validation_deadline,
        CapsuleXError::ValidationStillActive
    );
    
    require!(
        bond_account.current_balance > 0,
        CapsuleXError::BondAlreadyProcessed
    );
    
    let current_balance = bond_account.current_balance;
    
    if capsule.creator_validated {
        // Full refund scenario
        let refund_amount = current_balance;
        
        // Transfer from bond account to creator
        **bond_account.to_account_info().try_borrow_mut_lamports()? -= refund_amount;
        **ctx.accounts.creator.to_account_info().try_borrow_mut_lamports()? += refund_amount;
        
        bond_account.current_balance = 0;
        
        emit!(BondRefunded {
            capsule: capsule.key(),
            creator: capsule.creator,
            amount: refund_amount,
            reason: BondRefundReason::CreatorValidated,
        });
        
    } else {
        // Abandonment scenario - calculate costs and penalties
        let guesses_count = capsule.current_guesses;
        let validation_costs = guesses_count as u64 * capsule.validation_cost_per_guess;
        
        let refund_costs = match capsule.protection_level {
            PlayerProtectionLevel::None => 0,
            PlayerProtectionLevel::Partial => {
                (guesses_count as u64 * capsule.guess_submission_cost) / 2
            },
            PlayerProtectionLevel::Full => {
                guesses_count as u64 * capsule.guess_submission_cost
            },
        };
        
        let total_costs = validation_costs + refund_costs;
        
        // Apply abandonment penalty (10% of original bond, max 0.001 SOL)
        let penalty = std::cmp::min(
            capsule.deposited_bond / 10,
            1_000_000, // 0.001 SOL in lamports
        );
        
        let total_deductions = total_costs + penalty;
        let refund_amount = if current_balance > total_deductions {
            current_balance - total_deductions
        } else {
            0
        };
        
        // Update tracking
        capsule.validation_costs_used = validation_costs;
        capsule.player_refunds_issued = refund_costs;
        
        // Transfer refund (may be 0)
        if refund_amount > 0 {
            **bond_account.to_account_info().try_borrow_mut_lamports()? -= refund_amount;
            **ctx.accounts.creator.to_account_info().try_borrow_mut_lamports()? += refund_amount;
        }
        
        // Leave remaining balance for community validation and player refunds
        bond_account.current_balance = current_balance - refund_amount;
        
        emit!(BondPenalized {
            capsule: capsule.key(),
            creator: capsule.creator,
            total_costs,
            penalty,
            refund_amount,
            reason: BondRefundReason::CreatorAbandoned,
        });
    }
    
    Ok(())
}
```

### Helper Functions

```rust
pub fn calculate_required_bond(
    max_guesses: u32,
    protection_level: PlayerProtectionLevel,
) -> u64 {
    let validation_cost_per_guess = 3_000; // ~$0.003 in lamports at $180/SOL
    let guess_submission_cost = 3_000;     // ~$0.003 in lamports
    
    let validation_reserve = max_guesses as u64 * validation_cost_per_guess;
    
    let refund_reserve = match protection_level {
        PlayerProtectionLevel::None => 0,
        PlayerProtectionLevel::Partial => {
            (max_guesses as u64 * guess_submission_cost) / 2
        },
        PlayerProtectionLevel::Full => {
            max_guesses as u64 * guess_submission_cost
        },
    };
    
    validation_reserve + refund_reserve
}

pub fn calculate_cost_per_guess(capsule: &BondedGameCapsule) -> u64 {
    let validation_cost = capsule.validation_cost_per_guess;
    
    let refund_reserve = match capsule.protection_level {
        PlayerProtectionLevel::None => 0,
        PlayerProtectionLevel::Partial => capsule.guess_submission_cost / 2,
        PlayerProtectionLevel::Full => capsule.guess_submission_cost,
    };
    
    validation_cost + refund_reserve
}
```

### Event Definitions

```rust
#[event]
pub struct BondedCapsuleCreated {
    pub capsule: Pubkey,
    pub creator: Pubkey,
    pub max_guesses: u32,
    pub bond_amount: u64,
    pub protection_level: PlayerProtectionLevel,
    pub required_bond: u64,
}

#[event]
pub struct BondAdjusted {
    pub capsule: Pubkey,
    pub old_max: u32,
    pub new_max: u32,
    pub remaining_bond: u64,
    pub adjustment_number: u8,
}

#[event]
pub struct BondRefunded {
    pub capsule: Pubkey,
    pub creator: Pubkey,
    pub amount: u64,
    pub reason: BondRefundReason,
}

#[event]
pub struct BondPenalized {
    pub capsule: Pubkey,
    pub creator: Pubkey,
    pub total_costs: u64,
    pub penalty: u64,
    pub refund_amount: u64,
    pub reason: BondRefundReason,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum BondRefundReason {
    CreatorValidated,
    CreatorAbandoned,
    SystemProcessed,
}
```

### Error Definitions

```rust
#[error_code]
pub enum CapsuleXV2Error {
    #[msg("Bond system only available for gamified capsules")]
    BondOnlyForGames,
    
    #[msg("Invalid guess limit: must be between 1 and 10000")]
    InvalidGuessLimit,
    
    #[msg("Insufficient bond amount deposited")]
    InsufficientBond,
    
    #[msg("Insufficient bond balance for operation")]
    InsufficientBondBalance,
    
    #[msg("Maximum guesses reached for this capsule")]
    MaxGuessesReached,
    
    #[msg("Validation period is still active")]
    ValidationStillActive,
    
    #[msg("Bond has already been processed")]
    BondAlreadyProcessed,
    
    #[msg("Unauthorized bond processor")]
    UnauthorizedBondProcessor,
    
    #[msg("Invalid reveal date: must be in the future")]
    InvalidRevealDate,
    
    #[msg("Bond adjustment failed")]
    BondAdjustmentFailed,
}
```

## Integration with Existing Systems

### Backend Service Integration

#### Database Schema Changes
```sql
-- Add V2 specific columns to existing capsules table
ALTER TABLE capsules ADD COLUMN program_version VARCHAR(10) DEFAULT 'v1';
ALTER TABLE capsules ADD COLUMN max_guesses INTEGER;
ALTER TABLE capsules ADD COLUMN current_max_guesses INTEGER; 
ALTER TABLE capsules ADD COLUMN deposited_bond BIGINT;
ALTER TABLE capsules ADD COLUMN remaining_bond BIGINT;
ALTER TABLE capsules ADD COLUMN bond_account VARCHAR(44);
ALTER TABLE capsules ADD COLUMN protection_level VARCHAR(20) DEFAULT 'None';
ALTER TABLE capsules ADD COLUMN creator_validated BOOLEAN DEFAULT FALSE;
ALTER TABLE capsules ADD COLUMN validation_deadline TIMESTAMP;
ALTER TABLE capsules ADD COLUMN validation_costs_used BIGINT DEFAULT 0;
ALTER TABLE capsules ADD COLUMN player_refunds_issued BIGINT DEFAULT 0;
ALTER TABLE capsules ADD COLUMN bond_adjustments INTEGER DEFAULT 0;

-- Create bond events tracking table
CREATE TABLE bond_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capsule_id UUID REFERENCES capsules(capsule_id),
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    transaction_signature VARCHAR(88),
    created_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_bond_events_capsule (capsule_id),
    INDEX idx_bond_events_type (event_type),
    INDEX idx_bond_events_created (created_at)
);

-- Create player refund tracking table
CREATE TABLE player_refunds (
    refund_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capsule_id UUID REFERENCES capsules(capsule_id),
    player_wallet VARCHAR(44) NOT NULL,
    guess_id UUID,
    refund_amount BIGINT NOT NULL,
    refund_reason VARCHAR(100),
    transaction_signature VARCHAR(88),
    processed_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_player_refunds_capsule (capsule_id),
    INDEX idx_player_refunds_player (player_wallet),
    INDEX idx_player_refunds_processed (processed_at)
);

-- Add bond monitoring table for automated processing
CREATE TABLE bond_monitoring (
    monitor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capsule_id UUID REFERENCES capsules(capsule_id) UNIQUE,
    validation_deadline TIMESTAMP NOT NULL,
    creator_notified_at TIMESTAMP,
    community_validation_scheduled BOOLEAN DEFAULT FALSE,
    bond_processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_bond_monitoring_deadline (validation_deadline),
    INDEX idx_bond_monitoring_processed (bond_processed)
);
```

#### API Endpoint Updates
```typescript
// Enhanced capsule creation endpoint
POST /api/v2/capsules
{
  // Standard capsule fields
  "content": "...",
  "reveal_date": "2025-12-31T23:59:59Z",
  "is_gamified": true,
  
  // V2 bond system fields
  "max_guesses": 100,
  "protection_level": "Full", // "None", "Partial", "Full"
  "bond_amount": 600000, // lamports
  "auto_validate_complex": true // Enable semantic oracle fallback
}

// Bond status endpoint
GET /api/v2/capsules/{id}/bond-status
{
  "capsule_id": "uuid",
  "bond_account": "pubkey",
  "deposited_bond": 600000,
  "remaining_bond": 450000,
  "max_guesses": 100,
  "current_max_guesses": 85,
  "current_guesses": 60,
  "validation_deadline": "2025-08-01T12:00:00Z",
  "creator_validated": false,
  "protection_level": "Full",
  "bond_adjustments": 2,
  "estimated_costs": {
    "validation": 180000,
    "player_refunds": 180000,
    "total": 360000
  }
}

// Bond adjustment endpoint
POST /api/v2/capsules/{id}/adjust-bond
{
  "additional_amount": 300000, // lamports to add
  "new_max_guesses": 150 // optional: increase guess limit
}

// Community validation trigger
POST /api/v2/capsules/{id}/trigger-community-validation
{
  "reason": "creator_abandoned",
  "semantic_threshold": 0.8,
  "validation_budget": 300000
}
```

### Frontend Integration

#### Enhanced Capsule Creation UI
```typescript
interface V2CapsuleCreationParams {
  // Standard fields
  content: string;
  reveal_date: Date;
  is_gamified: boolean;
  
  // V2 bond system
  max_guesses: number;
  protection_level: 'None' | 'Partial' | 'Full';
  bond_amount?: number; // Auto-calculated if not provided
  
  // Advanced options
  semantic_threshold?: number;
  auto_validate_timeout?: number; // hours
  community_validators?: string[]; // preferred validators
}

// Bond calculator component
function BondCalculator({ maxGuesses, protectionLevel }: {
  maxGuesses: number;
  protectionLevel: 'None' | 'Partial' | 'Full';
}) {
  const costs = calculateBondCosts(maxGuesses, protectionLevel);
  
  return (
    <div className="bond-calculator">
      <h3>Bond Requirement</h3>
      <div>Validation Reserve: ${costs.validation.toFixed(3)}</div>
      <div>Player Refund Reserve: ${costs.refunds.toFixed(3)}</div>
      <div>Total Bond Required: ${costs.total.toFixed(3)}</div>
      
      <div className="scenarios">
        <h4>Scenarios:</h4>
        <div>✅ You validate on time → Get ${costs.total.toFixed(3)} back</div>
        <div>⚠️ You abandon → Lose up to ${costs.total.toFixed(3)}</div>
        <div>📊 Popular game (max guesses) → ${costs.worstCase.toFixed(3)} cost</div>
      </div>
    </div>
  );
}
```

#### Bond Monitoring Dashboard
```typescript
function BondDashboard({ capsuleId }: { capsuleId: string }) {
  const bondStatus = useBondStatus(capsuleId);
  const timeRemaining = useTimeUntilDeadline(bondStatus.validation_deadline);
  
  return (
    <div className="bond-dashboard">
      <h2>Game Validation Status</h2>
      
      <div className="bond-overview">
        <div>Deposited Bond: {formatSOL(bondStatus.deposited_bond)}</div>
        <div>Remaining: {formatSOL(bondStatus.remaining_bond)}</div>
        <div>Max Guesses: {bondStatus.current_max_guesses}/{bondStatus.max_guesses}</div>
        <div>Current Guesses: {bondStatus.current_guesses}</div>
      </div>
      
      {!bondStatus.creator_validated && timeRemaining > 0 && (
        <div className="validation-warning">
          <h3>⏰ Action Required!</h3>
          <div>Validate guesses within {formatTime(timeRemaining)} to keep your bond</div>
          <button onClick={() => navigateToValidation(capsuleId)}>
            Validate Guesses Now
          </button>
        </div>
      )}
      
      {bondStatus.bond_adjustments > 0 && (
        <div className="bond-adjustments">
          <h3>📊 Bond Adjustments</h3>
          <div>Your max guesses were reduced {bondStatus.bond_adjustments} times due to bond balance</div>
          <button onClick={() => topUpBond(capsuleId)}>
            Top Up Bond
          </button>
        </div>
      )}
    </div>
  );
}
```

### Testing Strategy

#### Unit Tests
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_bond_calculation() {
        // Test various scenarios
        assert_eq!(calculate_required_bond(10, PlayerProtectionLevel::None), 30_000);
        assert_eq!(calculate_required_bond(10, PlayerProtectionLevel::Partial), 45_000);
        assert_eq!(calculate_required_bond(10, PlayerProtectionLevel::Full), 60_000);
        
        assert_eq!(calculate_required_bond(100, PlayerProtectionLevel::Full), 600_000);
        assert_eq!(calculate_required_bond(1000, PlayerProtectionLevel::Full), 6_000_000);
    }
    
    #[test]
    fn test_bond_adjustment() {
        let mut capsule = create_test_capsule(100, 600_000);
        
        // Simulate bond usage
        capsule.remaining_bond = 300_000; // Half used
        
        let cost_per_guess = calculate_cost_per_guess(&capsule);
        let affordable_guesses = capsule.remaining_bond / cost_per_guess;
        
        assert_eq!(affordable_guesses, 50); // Should afford 50 more guesses
    }
    
    #[test]
    fn test_refund_scenarios() {
        // Test creator validation scenario
        let capsule = create_test_capsule(100, 600_000);
        let refund = calculate_creator_refund(&capsule, true, 0);
        assert_eq!(refund, 600_000); // Full refund
        
        // Test abandonment scenario
        let refund = calculate_creator_refund(&capsule, false, 50);
        assert_eq!(refund, 240_000); // 600k - (50 * 6k validation+refund) - penalty
    }
}
```

#### Integration Tests
```typescript
describe('V2 Bond System Integration', () => {
  test('should create bonded capsule with correct bond', async () => {
    const params = {
      max_guesses: 10,
      protection_level: 'Full',
      bond_amount: 60_000 // 10 * (3k + 3k)
    };
    
    const result = await createBondedCapsule(params);
    expect(result.success).toBe(true);
    expect(result.bond_account).toBeDefined();
  });
  
  test('should auto-adjust max guesses when bond runs low', async () => {
    const capsule = await createTestCapsule({ max_guesses: 100 });
    
    // Submit 80 guesses
    for (let i = 0; i < 80; i++) {
      await submitGuess(capsule.id, `guess ${i}`);
    }
    
    const status = await getBondStatus(capsule.id);
    expect(status.current_max_guesses).toBeLessThan(100);
  });
  
  test('should process abandonment correctly', async () => {
    const capsule = await createTestCapsule({ max_guesses: 10 });
    
    // Submit 5 guesses
    for (let i = 0; i < 5; i++) {
      await submitGuess(capsule.id, `guess ${i}`);
    }
    
    // Fast-forward past validation deadline
    await fastForward(25 * 60 * 60 * 1000); // 25 hours
    
    // Process abandonment
    const result = await processAbandonment(capsule.id);
    
    expect(result.players_refunded).toBe(5);
    expect(result.validation_completed).toBe(true);
    expect(result.creator_refund).toBeLessThan(capsule.deposited_bond);
  });
});
```

## Performance Considerations

### Compute Unit Analysis
```rust
// Estimated compute units for V2 instructions:

// create_bonded_capsule: ~15,000 CU
// - Account initialization: 5,000 CU
// - Bond transfer: 3,000 CU  
// - Validation logic: 2,000 CU
// - Event emission: 1,000 CU
// - Buffer: 4,000 CU

// submit_guess_with_bond_check: ~8,000 CU
// - Bond balance check: 1,000 CU
// - Auto-adjustment logic: 2,000 CU
// - Standard guess submission: 4,000 CU
// - Buffer: 1,000 CU

// process_bond_refund: ~12,000 CU
// - Cost calculations: 2,000 CU
// - Balance transfers: 5,000 CU
// - Account updates: 3,000 CU
// - Event emission: 1,000 CU
// - Buffer: 1,000 CU
```

### Optimization Strategies
1. **Batch Operations**: Process multiple refunds in single transaction
2. **Lazy Updates**: Only update bond balance when necessary
3. **Efficient Storage**: Pack data structures to minimize account size
4. **Compute Budgets**: Set appropriate compute unit limits for each instruction

## Security Audit Checklist

### Economic Security
- [ ] Bond calculations prevent integer overflow/underflow
- [ ] Creator cannot withdraw bond before deadline
- [ ] Player refunds are prioritized over creator refunds
- [ ] Community validation costs are properly accounted

### Access Control
- [ ] Only authorized entities can process bond refunds
- [ ] Creators cannot manipulate their own bond balances
- [ ] Players cannot submit guesses beyond current limits
- [ ] Bond adjustments are atomic and consistent

### Data Integrity
- [ ] Bond balances always match actual SOL in PDAs
- [ ] Guess counts are accurately tracked
- [ ] Event emissions provide complete audit trail
- [ ] State transitions are validated at each step

### Edge Cases
- [ ] Handle zero-guess scenarios gracefully
- [ ] Prevent double-refunding of players
- [ ] Handle partial bond depletion correctly
- [ ] Manage concurrent guess submissions safely

---

This technical specification provides the complete implementation details for the V2 Creator Bond System, ensuring robust, secure, and economically sound gamified time capsules.