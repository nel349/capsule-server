# Updated CapsuleX Happy Path Flow

## Refined User Flow Based on Feedback

### 1. **User Arrives at CapsuleX**
- **Landing page**: "Schedule tweets for the future, guaranteed by blockchain"
- **CTA**: "Create Your First Time Capsule"
- **Focus**: Getting user ready for "aha moment" - understanding entertainment value and how the product works

### 2. **Authentication** ✅ **Decision: Dual System**
- **Option A (Prominent)**: Email/Social login via **Privy** 
  - Target: Mainstream users ("normies")
  - Handles wallet abstraction and custody
  - Easier onboarding experience
- **Option B**: Direct Solana wallet connect (Phantom, Solflare)
  - Target: Crypto experts
  - Full self-custody control

### 3. **Social Media Setup Page** ✅ **IMPLEMENTED**
- **Required Connections**:
  - ✅ **X/Twitter** (OAuth 2.0 with PKCE flow complete)
    - Backend: Token exchange endpoint `/api/social/twitter/exchange-token`
    - Frontend: Profile settings with Twitter connect/reconnect
    - Scopes: `tweet.read`, `tweet.write`, `users.read`, `media.write`, `offline.access`
- **Optional Connections**:
  - 🔮 **Farcaster** (future integration)
  - 🔮 **Other social media** (extensible system)
- **Mock Mode**: ✅ Development/demo toggle in Profile settings
- **Flow**: Users can connect Twitter in Profile tab, required before posting

### 4. **Create Capsule Flow** ✅ **WITH SOL ONRAMP**
**UI Form Fields**:
- Tweet content (280 char limit)
- ✅ **Optional**: Add image/media
- Reveal date/time picker
  - **Production**: 1 hour to 1 year
  - **Testing**: 5 seconds to 1 hour
- ✅ **Preview**: Shows exactly how tweet will look when posted

**SOL Balance Flow** ✅ **JUST-IN-TIME**:
- User clicks "Create Capsule" button
- **Check SOL balance** (≥0.00005 SOL required)
- If insufficient → **Show Moonpay onramp modal**:
  - "🚀 Fuel Your Time Capsules"
  - "One-time $20 SOL setup"
  - "Good for 2000+ time capsules"
  - [Buy SOL] → Moonpay WebBrowser flow
- If sufficient → Proceed with creation

**Backend Process**:
- ✅ **Client-side encryption** (saves compute power, user controls keys)
- Call `createCapsule` smart contract function
- ✅ **Charge SOL fee immediately** (0.00005 SOL ≈ $0.008)
- Store in database: `{content_encrypted, reveal_date, user_wallet, on_chain_tx}`
- **Content Storage**: Check existing docs for on-chain vs off-chain strategy

### 5. **Confirmation State**
- "Capsule created! Your tweet will be revealed on [DATE]"
- Show transaction ID, countdown timer
- Social proof: "Share that you created a time capsule" (without revealing content)

### 6. **Waiting Period**
**Public Timeline**:
- Other users can see "Someone scheduled a tweet for [DATE]" (without content)
- Countdown timers for upcoming reveals
- ✅ **No in-app social features** - users interact on the actual X post after reveal

### 7. **Reveal Time** ✅ **BACKEND READY**
**Automated Process**:
- Scheduler detects reveal_date has passed
- Calls smart contract `revealCapsule`
- Decrypts content
- **Critical**: Posts to user's connected X account
  - ✅ **Backend API**: `/api/social/post-tweet` with media support
  - ✅ **X API v2 Integration**: Media upload + tweet posting
  - ✅ **Mock Mode Available**: For development/demos
- ✅ **Include CapsuleX signature/link** in X post for verification
- ✅ **Simple retry logic** for X API failures
- Updates database: `revealed_at`, `posted_to_x`, `x_post_id`

**User Experience**:
- Email/push notification: "Your capsule just revealed!"
- Link to both the X post and CapsuleX reveal page

### 8. **Post-Reveal**
- Public reveal page showing the tweet + proof of when it was created
- ✅ **Link between X post and CapsuleX** for verification
- Social interaction happens on X, not in-app

## Key Technical Decisions

### **Authentication Architecture**
```
User Registration
├── Privy (Email/Social) - PROMINENT
│   ├── Creates embedded wallet
│   ├── Handles custody
│   └── Maps to Solana address
└── Direct Wallet Connect - Available
    ├── Phantom/Solflare
    └── Self-custody
```

### **User Flow After Auth**
```
1. Authentication (Privy OR Wallet)
2. Social Setup Page
   ├── Connect X/Twitter (REQUIRED)
   ├── Connect Farcaster (Optional, future)
   └── Other social (Optional, future)
3. Ready to create capsules
```

### **Payment & Onramp Strategy** ✅ **FINALIZED**
- ✅ **SOL fees charged upfront** 
- ✅ **Moonpay integration** (adapted from Cultivest)
- ✅ **Just-in-time onramp**: Check SOL balance when user tries to create capsule
- ✅ **$20 minimum purchase** = 2000+ capsules (Moonpay limit)
- ✅ **UX messaging**: "One-time setup for unlimited future posting"
- ✅ **Fallback**: "I already have SOL" option for existing users

### **Content & Encryption**
- ✅ **Client-side encryption** (user controls keys)
- ✅ **Optional images/media**
- ✅ **Content storage strategy**: Review existing docs
- ✅ **Allow cancel/edit** before reveal

### **Error Handling Considerations**
- ✅ **Simple X API retry logic**
- 📝 **User loses wallet access** (edge case for later)
- 📝 **User deletes X account** (edge case for later)
- 📝 **Smart contract failures** (edge case for later)

## Database Schema Updates Required

### Database Schema Updates ✅ **IMPLEMENTED**
```sql
-- Enhanced users table ✅ DEPLOYED
users (
  user_id UUID PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  auth_type TEXT NOT NULL,              -- 'privy' | 'wallet'
  privy_user_id TEXT UNIQUE,            -- If Privy user
  email TEXT,                           -- If Privy user
  name TEXT,                            -- Display name
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Social connections ✅ DEPLOYED WITH ENHANCEMENTS
social_connections (
  connection_id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(user_id),
  platform TEXT NOT NULL,              -- 'twitter', 'farcaster', etc.
  platform_user_id TEXT NOT NULL,
  platform_username TEXT,
  access_token TEXT ENCRYPTED,
  refresh_token TEXT ENCRYPTED,
  expires_at TIMESTAMP,                 -- ✅ Token expiration tracking
  is_active BOOLEAN DEFAULT TRUE,
  connected_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced capsules table (Ready for implementation)
capsules (
  capsule_id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(user_id),
  content_encrypted TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  has_media BOOLEAN DEFAULT FALSE,      -- Track if images/media included
  media_urls TEXT[],                    -- Array of media URLs
  reveal_date TIMESTAMP NOT NULL,
  revealed_at TIMESTAMP NULL,
  posted_to_social BOOLEAN DEFAULT FALSE,
  social_post_id TEXT NULL,
  social_platform TEXT DEFAULT 'twitter',
  on_chain_tx TEXT NOT NULL,
  can_edit BOOLEAN DEFAULT TRUE,        -- Allow edit before reveal
  created_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'pending'
);
```

## Research Tasks Before Development

### 🔍 **Immediate Research Required**
1. **Check Cultivest Moonpay integration** - How is onramp handled?
2. **Review content storage docs** - On-chain vs off-chain strategy?
3. **Solana Pay research** - Does it handle fiat onramp?
4. **Privy integration** - Best practices for Solana + Privy

### 📋 **Implementation Status**
1. ✅ **Supabase + enhanced schema** (users, social_connections deployed)
2. 🔮 **Privy account setup** + Solana configuration (future)
3. ✅ **Project structure** with wallet-first auth architecture  
4. ✅ **Environment variables** configured
5. ✅ **X/Twitter developer account** + OAuth setup complete
6. ✅ **Backend APIs** for social media integration
7. ✅ **Mock mode** for development and demos

## 🎯 **Current Hackathon-Ready Features**
- ✅ Wallet authentication (Phantom, Solflare)
- ✅ Twitter OAuth integration with media support
- ✅ Backend API for tweet posting (`/api/social/post-tweet`)
- ✅ Mock mode for demo without X API limits
- ✅ Profile settings with social connections
- ✅ Centralized API configuration
- 🔄 **Ready for capsule creation integration**

## 🚀 **Next Priority: Capsule Integration**
1. **Connect tweet posting to capsule reveal process**
2. **Test end-to-end flow**: Create capsule → Reveal → Post to Twitter  
3. **Polish for Solana Mobile Hackathon demo**

**Status: Ready for production demo with mock Twitter mode! 🎭**