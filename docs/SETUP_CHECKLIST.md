# CapsuleX Backend Setup Checklist

## Setup Prerequisites Checklist

### 1. **Database Setup (Supabase)** ✅ Decision: Use Supabase
- [ ] Create Supabase project
- [ ] Set up database schema (users, capsules, reveal_queue tables, privy_users)
- [ ] Configure Row Level Security (RLS) policies
- [ ] Get database connection strings
- [ ] Set up database migrations/scripts

### 1.5. **Authentication Setup** ✅ Decision: Dual Auth (Privy + Wallet)
- [ ] Set up Privy account for wallet abstraction
- [ ] Configure Privy for email/social login (prominent for normies)
- [ ] Set up Solana wallet connect (for crypto experts)
- [ ] Design onboarding flow prioritizing mainstream users

### 2. **External API Accounts & Keys**
#### Social Media Integration Setup
- [ ] **X/Twitter Developer Account**
  - [ ] Apply for Twitter API access (when implementing feature)
  - [ ] Create app for OAuth 2.0
  - [ ] Get API keys (client_id, client_secret)
  - [ ] Configure callback URLs
  - [ ] Design "setup page" for social connections after signup
- [ ] **Future Social Platforms**
  - [ ] Plan Farcaster integration architecture
  - [ ] Design extensible social media connection system
- **NOTE**: X required, others optional. Required before capsule creation if skipped during setup.

#### Solana Setup ✅ Decision: Devnet
- [ ] Choose network: **DEVNET**
- [ ] Get RPC endpoint URLs
- [ ] Deploy/adapt smart contract as needed for frontend requirements
- [ ] Get program ID (will change as we adapt)

#### Payment & Onramp Setup
- [ ] **Research Cultivest payment integration** (check existing Moonpay setup)
- [ ] **Moonpay Integration** (if used in Cultivest)
  - [ ] Set up Moonpay developer account
  - [ ] Configure API keys
  - [ ] Test SOL onramp functionality
- [ ] **Solana Pay Research**
  - [ ] Investigate Solana Pay onramp capabilities
  - [ ] Compare with Moonpay for user experience
- **NOTE**: Users need SOL for transaction fees, provide easy onramp

### 3. **Environment Configuration**
- [ ] Create `.env` file structure
- [ ] Define all required environment variables
- [ ] Set up development vs production configs
- [ ] Document environment setup for team

### 4. **Project Structure & Dependencies**
- [ ] Initialize Node.js project
- [ ] Set up TypeScript configuration
- [ ] Install required dependencies
- [ ] Configure build scripts
- [ ] Set up linting/formatting

### 5. **Deployment Setup** ✅ Correction: Backend only (Expo handles mobile)
- [ ] Configure Vercel project (backend deployment)
- [ ] Set up environment variables in Vercel
- [ ] Configure deployment scripts
- [ ] Set up staging environment
- **NOTE**: Mobile deployment handled by Expo separately

### 6. **Development Tools**
- [ ] Set up API testing (Postman/Thunder Client)
- [ ] Configure database management tools
- [ ] Set up logging/monitoring

## Environment Variables Required

```env
# Database
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Authentication
PRIVY_APP_ID=                # Privy application ID
PRIVY_APP_SECRET=            # Privy application secret

# Solana (Devnet)
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=           # Will be set when contract is deployed
SOLANA_WALLET_PRIVATE_KEY=   # For backend operations

# Twitter/X API (To be added when implementing)
TWITTER_CLIENT_ID=           # When we get API access
TWITTER_CLIENT_SECRET=       # When we get API access
TWITTER_BEARER_TOKEN=        # When we get API access

# Payment/Onramp (✅ Found in Cultivest)
MOONPAY_API_KEY=             # From Cultivest: production/sandbox API key
MOONPAY_SECRET_KEY=          # From Cultivest: for URL signing
MOONPAY_WEBHOOK_SECRET=      # From Cultivest: for webhook verification
MOONPAY_BASE_URL=            # From Cultivest: buy-sandbox.moonpay.com or buy.moonpay.com

# App Config
JWT_SECRET=                  # Random secure string
ENCRYPTION_KEY=              # For content encryption (client-side controlled)
NODE_ENV=development
PORT=3000
```

## Setup Priority Order

### **Day 1: Foundation**
1. [ ] Supabase database setup
2. [ ] Basic project structure
3. [ ] Environment configuration

### **Day 2: Core Backend**
4. [ ] Solana integration + basic API
5. [ ] Deploy/adapt smart contract for frontend needs

### **Day 3: Features**
6. [ ] X/Twitter integration placeholders ("not implemented yet")
7. [ ] Basic capsule CRUD operations

### **Day 4: Automation**
8. [ ] Scheduler system for reveals
9. [ ] Real X/Twitter integration (apply for API access)

### **Day 5: Polish**
10. [ ] Testing + deployment
11. [ ] API documentation

## Immediate Next Steps

**Start with these 3 tasks:**
1. **Supabase database setup**
2. **Basic project structure** 
3. **Environment configuration**

## Notes & Decisions Made

### ✅ **Confirmed Decisions**
- **Database**: Supabase (hosted PostgreSQL)
- **Authentication**: Dual system - Privy (prominent for normies) + Wallet Connect (crypto experts)
- **Solana Network**: Devnet for development/demo
- **Social Setup**: Separate setup page after signup, X required, others optional
- **Content**: Optional images/media, client-side encryption, user controls keys
- **Timing**: 1 hour to 1 year (prod), 5 seconds to 1 hour (testing)
- **SOL Onramp**: Moonpay integration, just-in-time checking, $20 minimum
- **Onramp UX**: "One-time setup for 2000+ capsules" messaging
- **X Integration**: Include CapsuleX signature/link in posts, simple retry logic
- **Editing**: Allow cancel/edit capsules before reveal
- **Smart Contract**: Will adapt/redeploy as needed for frontend requirements
- **Deployment**: Backend on Vercel, mobile via Expo
- **No Mocks**: Real integrations or placeholder messages

### 📝 **Error Handling & Edge Cases (TODO: Address Later)**
- [ ] **User loses wallet access before reveal** - How to handle?
- [ ] **User deletes X account before reveal** - Fallback strategy?
- [ ] **Smart contract call fails during reveal** - Recovery mechanism?
- [ ] **X API rate limiting/failures** - Extended retry logic needed?
- [ ] **Privy vs Wallet user data sync** - How to handle dual auth edge cases?

### ✅ **Research Complete - Findings from Cultivest**

#### **Moonpay Integration (Found in Cultivest)**
- **Frontend**: `@moonpay/react-native-moonpay-sdk": "^1.1.3"` in package.json
- **Backend**: Complete MoonPayService class in `utils/moonpay.ts`
- **Features**: 
  - URL signing with HMAC-SHA256
  - Multi-currency support (BTC, ALGO, SOL)
  - Webhook signature verification
  - Fee calculation (3.5% MoonPay + network fees)
  - Sandbox/Production environment switching
- **Environment Variables**: `MOONPAY_API_KEY`, `MOONPAY_SECRET_KEY`, `MOONPAY_WEBHOOK_SECRET`
- **Integration Pattern**: User clicks "Buy Bitcoin" → Opens MoonPay in WebBrowser → Webhook processes completion

#### **Multi-Chain Wallet Support (Found in Cultivest)**
- **Bitcoin**: Native Bitcoin addresses  
- **Algorand**: Native ALGO addresses
- **Solana**: Native SOL addresses
- **Pattern**: Backend creates wallets for all chains, frontend selects currency for MoonPay

#### **Deployment Pattern (Cultivest)**
- **Backend**: Express.js on Vercel with file-based routing (`+api.ts` suffix)
- **Mobile**: Expo with `expo-dev-client` for custom native modules
- **Database**: Supabase with proper RLS policies

### 🔍 **Still Need to Research**
- [ ] **Content storage strategy** - Review CapsuleX docs for on-chain vs off-chain decisions  
- [ ] **Privy integration** - Best practices for Solana + Privy

## Ready to Start?

**First Task**: Set up Supabase project and database schema.

Let me know when you're ready to begin with the Supabase setup!