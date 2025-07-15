# CapsuleX Backend API Roadmap

## 🎯 **CURRENT STATUS**

### ✅ **SOLANA PROGRAM - COMPLETE (100%)**
- Time capsule creation, revealing, NFT minting
- 5 content storage types (Text, Document, SocialArchive, MediaBundle, ExternalWithBackup)
- Semantic guessing games with Oracle verification  
- Leaderboard and points system
- NFT badge/trophy minting for achievements
- Multi-winner games with configurable parameters

### ✅ **BASIC BACKEND API - FOUNDATION (20%)**
- Authentication (Wallet + Privy + JWT)
- Basic capsule CRUD operations
- Social media connections
- SOL transaction tracking
- Database schema and utilities

### ❌ **MISSING BACKEND API - CRITICAL GAPS (80%)**

---

## 🚀 **BACKEND API DEVELOPMENT ROADMAP**

### **PHASE 1: GAME SYSTEM INTEGRATION** 🎮
**Priority: CRITICAL | Timeline: 3-4 days**

#### **Game Management APIs**
- [ ] `POST /api/games/create` - Initialize game from capsule
- [ ] `GET /api/games/active` - List active games (paginated)
- [ ] `GET /api/games/:id` - Get game details and progress
- [ ] `GET /api/games/user/:wallet` - Get user's created games
- [ ] `PATCH /api/games/:id/status` - Update game status (admin)

#### **Game Interaction APIs**
- [ ] `POST /api/games/:id/guess` - Submit paid guess with Solana transaction
- [ ] `GET /api/games/:id/guesses` - Get game guess history
- [ ] `GET /api/games/:id/winners` - Get game winners
- [ ] `POST /api/games/:id/hint` - Request hint (if implemented)

#### **Semantic Verification Integration**
- [ ] `POST /api/semantic/verify` - Trigger semantic verification with Oracle
- [ ] `GET /api/semantic/status/:request_id` - Check verification status
- [ ] `POST /api/games/:id/complete` - Complete game with verified results

#### **Database Schema Additions**
```sql
-- Add to existing schema
CREATE TABLE games (
  game_id UUID PRIMARY KEY,
  capsule_id UUID REFERENCES capsules(capsule_id),
  creator_user_id UUID REFERENCES users(user_id),
  max_winners INTEGER DEFAULT 3,
  max_guesses INTEGER DEFAULT 100,
  entry_fee_sol DECIMAL(10,9) DEFAULT 0.001,
  status TEXT DEFAULT 'active', -- active, completed, expired
  winners_count INTEGER DEFAULT 0,
  total_guesses INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);

CREATE TABLE game_guesses (
  guess_id UUID PRIMARY KEY,
  game_id UUID REFERENCES games(game_id),
  user_id UUID REFERENCES users(user_id),
  guess_text TEXT NOT NULL,
  is_winner BOOLEAN DEFAULT FALSE,
  semantic_score DECIMAL(5,4),
  solana_tx_signature TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### **PHASE 2: LEADERBOARD & ACHIEVEMENTS** 🏆
**Priority: HIGH | Timeline: 2-3 days**

#### **Leaderboard APIs**
- [ ] `GET /api/leaderboard/global` - Global points leaderboard
- [ ] `GET /api/leaderboard/creators` - Top capsule creators
- [ ] `GET /api/leaderboard/guessers` - Top game participants
- [ ] `GET /api/leaderboard/user/:wallet` - Individual user stats

#### **Achievement System APIs**
- [ ] `GET /api/achievements/user/:wallet` - User's achievements
- [ ] `POST /api/achievements/unlock` - Unlock achievement (internal)
- [ ] `GET /api/achievements/progress/:wallet` - Achievement progress
- [ ] `GET /api/achievements/available` - All available achievements

#### **Points & Statistics APIs**
- [ ] `POST /api/points/award` - Award points (internal)
- [ ] `GET /api/stats/user/:wallet` - Comprehensive user statistics
- [ ] `GET /api/stats/platform` - Platform-wide statistics
- [ ] `PATCH /api/leaderboard/sync` - Sync with Solana program state

#### **Database Schema Additions**
```sql
CREATE TABLE leaderboards (
  user_id UUID REFERENCES users(user_id),
  total_points INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  games_participated INTEGER DEFAULT 0,
  capsules_created INTEGER DEFAULT 0,
  nfts_earned INTEGER DEFAULT 0,
  rank_global INTEGER,
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id)
);

CREATE TABLE achievements (
  achievement_id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  points_required INTEGER,
  badge_type TEXT, -- bronze, silver, gold, special
  nft_reward BOOLEAN DEFAULT FALSE
);

CREATE TABLE user_achievements (
  user_id UUID REFERENCES users(user_id),
  achievement_id UUID REFERENCES achievements(achievement_id),
  unlocked_at TIMESTAMP DEFAULT NOW(),
  nft_mint_address TEXT,
  PRIMARY KEY (user_id, achievement_id)
);
```

---

### **PHASE 3: NFT INTEGRATION** 🖼️
**Priority: HIGH | Timeline: 2-3 days**

#### **NFT Management APIs**
- [ ] `GET /api/nfts/user/:wallet` - User's NFT collection
- [ ] `POST /api/nfts/mint-capsule` - Mint capsule ownership NFT
- [ ] `POST /api/nfts/mint-badge` - Mint winner badge NFT
- [ ] `POST /api/nfts/mint-trophy` - Mint achievement trophy NFT
- [ ] `GET /api/nfts/metadata/:mint` - Get NFT metadata

#### **NFT Marketplace Integration**
- [ ] `GET /api/nfts/marketplace` - List tradeable NFTs
- [ ] `POST /api/nfts/transfer` - Transfer NFT (if allowed)
- [ ] `GET /api/nfts/history/:mint` - NFT transaction history

#### **Database Schema Additions**
```sql
CREATE TABLE nfts (
  nft_id UUID PRIMARY KEY,
  owner_user_id UUID REFERENCES users(user_id),
  mint_address TEXT UNIQUE NOT NULL,
  nft_type TEXT NOT NULL, -- capsule, badge, trophy
  related_capsule_id UUID REFERENCES capsules(capsule_id),
  related_game_id UUID REFERENCES games(game_id),
  metadata_uri TEXT,
  minted_at TIMESTAMP DEFAULT NOW()
);
```

---

### **PHASE 4: CONTENT DISCOVERY** 🔍
**Priority: MEDIUM | Timeline: 2-3 days**

#### **Discovery APIs**
- [ ] `GET /api/discover/trending` - Trending capsules and games
- [ ] `GET /api/discover/recent` - Recently created content
- [ ] `GET /api/discover/featured` - Curated featured content
- [ ] `GET /api/discover/categories` - Content by category/type

#### **Search APIs**
- [ ] `GET /api/search/capsules` - Search capsules by content/metadata
- [ ] `GET /api/search/games` - Search active games
- [ ] `GET /api/search/users` - Search users by wallet/name
- [ ] `GET /api/search/global` - Global search across all content

#### **Feed APIs**
- [ ] `GET /api/feed/timeline/:wallet` - Personalized user timeline
- [ ] `GET /api/feed/following/:wallet` - Following-based feed
- [ ] `GET /api/feed/explore` - Explore feed for discovery

---

### **PHASE 5: AUTOMATION & SCHEDULING** ⏰
**Priority: MEDIUM | Timeline: 2-3 days**

#### **Scheduler APIs**
- [ ] `POST /api/scheduler/reveal` - Schedule capsule auto-reveal
- [ ] `POST /api/scheduler/games` - Schedule game processing
- [ ] `GET /api/scheduler/status` - Scheduler health check
- [ ] `POST /api/scheduler/social-post` - Schedule social media posts

#### **Background Jobs**
- [ ] **Capsule Revealer** - Auto-reveal capsules at specified times
- [ ] **Game Processor** - Auto-complete expired games
- [ ] **Leaderboard Updater** - Sync leaderboard with Solana state
- [ ] **NFT Minter** - Auto-mint achievement NFTs
- [ ] **Social Poster** - Auto-post to X/Twitter

#### **Notification System**
- [ ] `POST /api/notifications/send` - Send push notification
- [ ] `GET /api/notifications/user/:wallet` - Get user notifications
- [ ] `PATCH /api/notifications/read` - Mark notifications as read

---

### **PHASE 6: SOCIAL INTEGRATION** 📱
**Priority: MEDIUM | Timeline: 3-4 days**

#### **Enhanced Social APIs**
- [ ] `POST /api/social/post` - Auto-post to X/Twitter
- [ ] `GET /api/social/verify-post` - Verify social media posts
- [ ] `POST /api/social/schedule` - Schedule social posts
- [ ] `GET /api/social/analytics` - Social engagement analytics

#### **Social Verification**
- [ ] `POST /api/social/verify-content` - Verify social media content for SocialArchive
- [ ] `GET /api/social/oauth/twitter` - Twitter OAuth flow
- [ ] `POST /api/social/webhook/twitter` - Twitter webhook handler

---

### **PHASE 7: ADVANCED FEATURES** 🚀
**Priority: LOW | Timeline: 4-5 days**

#### **Analytics & Monitoring**
- [ ] `GET /api/analytics/platform` - Platform analytics dashboard
- [ ] `GET /api/analytics/user/:wallet` - User behavior analytics
- [ ] `GET /api/analytics/revenue` - Revenue and fee analytics

#### **Admin & Moderation**
- [ ] `GET /api/admin/users` - User management (admin only)
- [ ] `POST /api/admin/moderate` - Content moderation
- [ ] `GET /api/admin/reports` - Content reports and issues

#### **API Optimization**
- [ ] **Rate Limiting** - Implement per-user API rate limits
- [ ] **Caching** - Redis caching for expensive queries
- [ ] **Pagination** - Consistent pagination across all list endpoints
- [ ] **WebSockets** - Real-time updates for games and leaderboards

---

## 🛠️ **IMPLEMENTATION PRIORITIES**

### **Week 1: Core Game Functionality**
- **Days 1-3**: Game System Integration (Phase 1)
- **Days 4-5**: Leaderboard & Achievements (Phase 2)

### **Week 2: NFTs & Discovery**  
- **Days 6-8**: NFT Integration (Phase 3)
- **Days 9-10**: Content Discovery (Phase 4)

### **Week 3: Automation & Social**
- **Days 11-13**: Automation & Scheduling (Phase 5)
- **Days 14-16**: Social Integration (Phase 6)

### **Week 4: Polish & Advanced Features**
- **Days 17-21**: Advanced Features & Optimization (Phase 7)

---

## 📊 **SUCCESS METRICS**

### **Technical Metrics**
- [ ] API response times < 200ms for 95th percentile
- [ ] 99.9% uptime for critical game endpoints
- [ ] All endpoints have proper error handling and validation
- [ ] Comprehensive test coverage (>80%)

### **Feature Completeness**
- [ ] All Solana program functionality exposed via APIs
- [ ] Real-time game interactions working smoothly
- [ ] Automated background processing reliable
- [ ] Social media integration functional

### **Frontend Readiness**
- [ ] All APIs documented with OpenAPI/Swagger
- [ ] Example requests/responses provided
- [ ] WebSocket events defined for real-time features
- [ ] Authentication flow clearly documented

---

## 🎯 **NEXT IMMEDIATE ACTIONS**

1. **Start with Phase 1** - Game System Integration is the highest priority
2. **Set up semantic service integration** - Required for game verification
3. **Implement game database tables** - Foundation for game functionality
4. **Create game management endpoints** - Enable game creation and management
5. **Build guess submission system** - Core game interaction functionality

The Solana program is incredibly sophisticated and complete. The backend API needs to catch up to expose all this functionality to the frontend effectively.