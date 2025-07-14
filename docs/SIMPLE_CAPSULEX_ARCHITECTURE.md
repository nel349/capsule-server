# Simple CapsuleX Architecture Documentation

## Project Overview
**Simple CapsuleX** is a mobile-first time capsule application that allows users to schedule tweets for the future with blockchain-backed immutability. This is the non-gamified version focusing on core time-delayed social media posting functionality.

## Architecture Overview

### Mobile-First Strategy
- **Primary Platform**: React Native + Expo mobile app
- **Backend**: Node.js API serving mobile clients
- **Smart Contract**: Existing Solana Anchor program (already implemented)
- **External Integration**: X/Twitter API for automated posting

## Core User Flow

### Simple Happy Path
1. **User opens mobile app** → Connect Solana wallet
2. **Create time capsule** → Write content + set reveal date
3. **Content encrypted & stored** → Smart contract call + database entry
4. **Wait period** → Content sits encrypted until reveal date
5. **Automatic reveal** → Backend scheduler decrypts & posts to X
6. **Notification** → User notified their capsule revealed + X posted

## Backend Architecture (`capsulex-backend/`)

### File Structure (Following Cultivest Pattern)
```
capsulex-backend/
├── app/api/                          # API routes (Express.js routing)
│   ├── capsules/
│   │   ├── create.ts                 # POST: Create new time capsule
│   │   ├── reveal.ts                 # POST: Manual reveal (if needed)
│   │   ├── list.ts                   # GET: User's capsules + public timeline
│   │   └── status.ts                 # GET: Check capsule status
│   ├── auth/
│   │   ├── wallet.ts                 # POST: Wallet signature verification
│   │   └── x-connect.ts              # POST: Connect X/Twitter account
│   ├── scheduler/
│   │   └── process-reveals.ts        # Internal: Process pending reveals
│   └── hello.ts                      # Health check
├── utils/                            # Utility modules
│   ├── database.ts                   # Supabase client + queries
│   ├── solana.ts                     # Smart contract interaction
│   ├── x-api.ts                      # Twitter API integration
│   ├── encryption.ts                 # Content encryption/decryption
│   ├── scheduler.ts                  # Reveal scheduling logic
│   └── auth.ts                       # Wallet signature verification
├── services/                         # Business logic (if needed)
│   └── capsule.service.ts           # Capsule CRUD operations
├── types/                           # TypeScript definitions
│   ├── capsule.ts                   # Capsule-related types
│   ├── user.ts                      # User types
│   └── api.ts                       # API request/response types
├── scripts/                         # Database migrations & setup
│   ├── setup-database.ts           # Initial DB schema
│   └── add-x-integration.sql       # X account integration tables
├── package.json                    # Dependencies
├── index.ts                        # Express server entry point
└── vercel.json                     # Deployment config
```

### Technology Stack
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js with file-based routing
- **Database**: Supabase (PostgreSQL) 
- **Blockchain**: Solana Web3.js + existing Anchor program
- **Social API**: X/Twitter API v2
- **Encryption**: Node.js crypto module
- **Deployment**: Vercel (serverless functions)
- **Scheduling**: Vercel Cron + database polling

### Database Schema (Supabase)
```sql
-- Users table
users (
  user_id UUID PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  x_username TEXT,
  x_access_token TEXT ENCRYPTED,
  x_refresh_token TEXT ENCRYPTED,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Capsules table  
capsules (
  capsule_id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(user_id),
  content_encrypted TEXT NOT NULL,
  content_hash TEXT NOT NULL,           -- SHA256 for integrity
  reveal_date TIMESTAMP NOT NULL,
  revealed_at TIMESTAMP NULL,           -- When actually revealed
  posted_to_x BOOLEAN DEFAULT FALSE,
  x_post_id TEXT NULL,                 -- Twitter post ID
  on_chain_tx TEXT NOT NULL,           -- Solana transaction signature
  created_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'pending'        -- pending/revealed/posted/failed
);

-- Reveal processing queue
reveal_queue (
  queue_id UUID PRIMARY KEY,
  capsule_id UUID REFERENCES capsules(capsule_id),
  scheduled_for TIMESTAMP NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_attempt TIMESTAMP NULL,
  status TEXT DEFAULT 'pending',       -- pending/processing/completed/failed
  error_message TEXT NULL
);
```

## Mobile Architecture (`capsulex-mobile/`) - Future Phase

### File Structure (Expo + TypeScript)
```
capsulex-mobile/
├── app/                             # Expo Router pages
│   ├── (tabs)/                      # Tab navigation
│   │   ├── _layout.tsx              # Tab layout
│   │   ├── index.tsx                # Timeline/Feed
│   │   ├── create.tsx               # Create Capsule  
│   │   └── profile.tsx              # User Profile
│   ├── capsule/
│   │   └── [id].tsx                 # Individual capsule view
│   ├── _layout.tsx                  # Root layout
│   └── +not-found.tsx               # 404 page
├── components/                      # Reusable components
│   ├── CapsuleForm.tsx              # Create capsule form
│   ├── WalletConnect.tsx            # Solana wallet connection
│   ├── CountdownTimer.tsx           # Reveal countdown
│   ├── XAccountConnect.tsx          # Twitter account linking
│   └── CapsuleCard.tsx              # Timeline capsule display
├── utils/                           # Client utilities
│   ├── api.ts                       # Backend API client
│   ├── wallet.ts                    # Solana wallet integration
│   ├── storage.ts                   # AsyncStorage helpers
│   └── notifications.ts            # Push notifications
├── types/                           # Shared TypeScript types
│   ├── index.ts                     # Common types
│   ├── capsule.ts                   # Capsule types (shared with backend)
│   └── wallet.ts                    # Wallet types
├── hooks/                           # React hooks
│   ├── useWallet.ts                 # Wallet state management
│   ├── useCapsules.ts               # Capsule data fetching
│   └── useNotifications.ts         # Notification handling
└── package.json                    # Mobile dependencies
```

### Mobile Tech Stack
- **Framework**: React Native + Expo
- **Navigation**: Expo Router (file-based)
- **Wallet**: Solana Mobile wallet adapter
- **State**: React hooks + AsyncStorage
- **Notifications**: Expo Notifications
- **UI**: React Native + custom components

## API Endpoints

### Authentication
- `POST /api/v1/auth/wallet` - Verify wallet signature
- `POST /api/v1/auth/x-connect` - Connect X/Twitter account

### Capsules
- `POST /api/v1/capsules/create` - Create new time capsule
- `GET /api/v1/capsules/list` - Get user's capsules + public timeline
- `GET /api/v1/capsules/status/:id` - Check specific capsule status
- `POST /api/v1/capsules/reveal/:id` - Manual reveal (if needed)

### Internal/Cron
- `POST /api/v1/scheduler/process-reveals` - Process pending reveals (internal)

## Development Phases

### Phase 1: Backend Core (Current Focus)
**Timeline**: Days 1-5
- [ ] Setup Express.js backend with file-based routing
- [ ] Supabase database integration
- [ ] Smart contract integration (connect to existing Anchor program)
- [ ] Basic capsule CRUD operations
- [ ] X/Twitter API integration
- [ ] Reveal scheduling system

### Phase 2: Mobile App (Future)
**Timeline**: Days 6-10
- [ ] Expo app setup with routing
- [ ] Wallet connection + authentication
- [ ] Create capsule interface
- [ ] Timeline/feed interface
- [ ] Push notifications for reveals

### Phase 3: Integration & Polish
**Timeline**: Days 11-14
- [ ] Connect mobile ↔ backend ↔ smart contract
- [ ] End-to-end testing
- [ ] Demo preparation
- [ ] Error handling & edge cases

## Key Technical Decisions

### Content Storage Strategy
- **On-chain**: Only content hash (SHA256) for integrity verification
- **Off-chain**: Encrypted content in Supabase database
- **Encryption**: AES-256 with user-derived keys

### Reveal Mechanism
- **Automated**: Vercel Cron job polls database every minute
- **Trigger**: When `reveal_date <= NOW()` and `status = 'pending'`
- **Process**: Decrypt → Post to X → Update database → Send notification

### X/Twitter Integration
- **OAuth 2.0**: User connects account during onboarding
- **Posting**: Automated via X API v2 when capsule reveals
- **Verification**: Link between X post and CapsuleX for proof

### Error Handling
- **Retry Logic**: Failed X posts retry up to 3 times
- **Fallback**: If X API fails, capsule still reveals (user can manually post)
- **Monitoring**: Failed operations logged for manual intervention

## Security Considerations

### Wallet Security
- **Signature Verification**: All API calls require valid wallet signature
- **No Private Keys**: Backend never stores private keys
- **Session Management**: JWT tokens for API authentication

### Content Protection
- **Encryption**: All content encrypted before database storage
- **Access Control**: Users can only access their own capsules
- **Integrity**: SHA256 hashes prevent content tampering

### X Integration Security
- **Token Encryption**: X tokens encrypted at rest
- **Scope Limiting**: Minimal required permissions for posting
- **Revocation**: Users can disconnect X accounts anytime

## Deployment Strategy

### Backend Deployment
- **Platform**: Vercel (serverless functions)
- **Database**: Supabase (hosted PostgreSQL)
- **Environment**: Production + staging environments
- **Monitoring**: Vercel Analytics + Supabase logs

### Mobile Deployment
- **Distribution**: Expo Go (development) → App Store/Play Store (production)
- **Updates**: Expo OTA updates for quick iterations
- **Testing**: Expo dev client for testing with production backend

## Success Metrics for Hackathon

### Core Functionality
- [ ] Create capsule via mobile app
- [ ] Automatic reveal at scheduled time
- [ ] Successful X/Twitter posting
- [ ] Public timeline showing revealed capsules

### Demo Flow
1. Show mobile app → Create capsule (5 minutes from now)
2. Show backend → Capsule stored encrypted
3. Wait for reveal → Show automatic X posting
4. Show timeline → Revealed capsule visible to others

## Next Steps

**Immediate (Backend Focus)**:
1. Setup Express.js backend with Cultivest-style file routing
2. Integrate with existing Solana smart contract
3. Implement basic capsule creation and storage
4. Add X/Twitter API integration
5. Build reveal scheduling system

**Future (Mobile Integration)**:
6. Create Expo mobile app
7. Connect mobile frontend to backend
8. Add wallet integration
9. Implement push notifications
10. Polish UI/UX for demo

---

This architecture leverages proven patterns from the Cultivest project while focusing on the core time capsule functionality needed for the hackathon demo.