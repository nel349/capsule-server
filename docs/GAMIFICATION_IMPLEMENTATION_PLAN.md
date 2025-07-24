# CapsuleX Gamification Implementation Plan

## Project Status: **PLANNING PHASE**
**Start Date**: 2025-01-23  
**Target MVP Date**: TBD

---

## **Phase 1: MVP Core Functionality (Week 1)**
**Goal**: Enable Create → Discover → Join game flow

### **1.1 GET `/api/games/:capsule_id`** 
- **Purpose**: Game details for verification and display
- **Used By**: Create confirmation, Game details view
- **Status**: ❌ **NOT STARTED**
- **Implementation**: 
  - [ ] Create `/routes/games.ts` 
  - [ ] Add endpoint with SolanaService.getGameData()
  - [ ] Handle error cases (game not found, blockchain issues)
  - [ ] Add response formatting
- **Dependencies**: SolanaService.getGameData() ✅ (already implemented)

### **1.2 GET `/api/games/active`**
- **Purpose**: List games available to join
- **Used By**: Game discovery screen
- **Status**: ❌ **NOT STARTED**  
- **Implementation**:
  - [ ] Add endpoint with pagination
  - [ ] Filter out completed games
  - [ ] Add `exclude_creator` parameter
  - [ ] Sort by reveal_date or activity
- **Dependencies**: SolanaService.getGamesForCapsule() ✅ + filtering logic

### **1.3 GET `/api/games/:capsule_id/guesses`**
- **Purpose**: Show game activity (public guesses only)
- **Used By**: Game details screen
- **Status**: ❌ **NOT STARTED**
- **Implementation**:
  - [ ] Add endpoint with pagination
  - [ ] Filter anonymous guesses (hide guesser identity)
  - [ ] Show guess counts and activity stats
  - [ ] Handle pre-reveal state (don't show correctness)
- **Dependencies**: SolanaService.getGuessData() ✅ + query multiple guesses

**Week 1 Milestone**: Users can create gamified capsules, see confirmation, discover active games, and view game details before joining.

---

## **Phase 2: User Experience (Week 2)**
**Goal**: Enable tracking participation and personal stats

### **2.1 GET `/api/games/my-participation`**
- **Purpose**: Games where user has submitted guesses
- **Used By**: My games screen
- **Status**: ❌ **NOT STARTED**
- **Implementation**:
  - [ ] Query games by user's wallet address
  - [ ] Include game status and user's guess count
  - [ ] Show reveal dates and time remaining
  - [ ] Filter by status (active, completed, won)
- **Dependencies**: Cross-reference user guesses with games

### **2.2 GET `/api/leaderboard/user/:wallet_address`**
- **Purpose**: Personal stats and ranking
- **Used By**: Profile screen, post-game results
- **Status**: ❌ **NOT STARTED**
- **Implementation**:
  - [ ] Use SolanaService.getLeaderboardData()
  - [ ] Add rank calculation (require global data)
  - [ ] Format points, games played/won, win rate
  - [ ] Handle new users (no leaderboard entry yet)
- **Dependencies**: SolanaService.getLeaderboardData() ✅

**Week 2 Milestone**: Users can track their game participation and see personal performance stats.

---

## **Phase 3: Competition & Results (Week 3)**
**Goal**: Full competitive experience with rankings

### **3.1 GET `/api/leaderboard/global`**
- **Purpose**: Global rankings for competition
- **Used By**: Leaderboard screen
- **Status**: ❌ **NOT STARTED**
- **Implementation**:
  - [ ] Query all leaderboard entries
  - [ ] Sort by total points, games won, etc.
  - [ ] Add pagination and rank calculation
  - [ ] Include win rates and percentiles
- **Dependencies**: Query multiple leaderboard entries

### **3.2 GET `/api/games/:capsule_id/results`**
- **Purpose**: Complete game results after resolution
- **Used By**: Game results screen
- **Status**: ❌ **NOT STARTED**  
- **Implementation**:
  - [ ] Show all guesses with correctness revealed
  - [ ] Display winners and points earned
  - [ ] Include game completion analytics
  - [ ] Only available after game completion
- **Dependencies**: Game must be completed and verified

**Week 3 Milestone**: Full competitive gaming experience with leaderboards and detailed results.

---

## **Technical Architecture**

### **New Files to Create**
- `backend-api/src/routes/games.ts` - Game-related endpoints
- `backend-api/src/routes/leaderboard.ts` - Leaderboard endpoints  
- `backend-api/src/utils/gameHelpers.ts` - Game data formatting utilities
- `backend-api/src/types/game.ts` - Game-related TypeScript types

### **Existing Files to Modify**
- `backend-api/src/app.ts` - Register new routes
- `backend-api/src/services/solana.ts` - May need additional helper methods

### **Error Handling Strategy**
- **Blockchain Unavailable**: Return cached data or graceful error
- **Game Not Found**: Return 404 with helpful message
- **Invalid Wallet**: Return 400 with validation error
- **Permissions**: Verify user can access requested data

### **Performance Considerations**
- **Caching**: Consider Redis for leaderboard data
- **Pagination**: All list endpoints must support pagination
- **Batch Queries**: Optimize multiple blockchain calls
- **Rate Limiting**: Protect expensive endpoints

---

## **Mobile App Integration Plan**

### **New Screens Needed**
1. **GameDiscoveryScreen** - Browse active games (Phase 1)
2. **GameDetailsScreen** - View game + submit guesses (Phase 1)  
3. **MyGamesScreen** - Track participation (Phase 2)
4. **LeaderboardScreen** - Rankings and competition (Phase 3)
5. **GameResultsScreen** - Post-game results (Phase 3)

### **Existing Screens to Modify**
- **CreateCapsuleScreen** - Add gamification toggle + confirmation
- **ProfileScreen** - Show leaderboard stats and game history
- **HubScreen** - May need gamified capsule indicators

---

## **Testing Strategy**

### **Unit Tests**
- [ ] Route handlers with mocked SolanaService
- [ ] Error handling for various blockchain states
- [ ] Data formatting and pagination logic
- [ ] Input validation and sanitization

### **Integration Tests**  
- [ ] End-to-end API calls with test blockchain
- [ ] Game creation → discovery → participation flow
- [ ] Leaderboard updates after game completion
- [ ] Performance with large datasets

### **User Acceptance Tests**
- [ ] Complete game flows from mobile app
- [ ] Error scenarios (network issues, invalid data)
- [ ] Edge cases (empty games, tied winners, etc.)

---

## **Success Metrics**

### **Technical Metrics**
- API response times < 500ms for single game queries
- API response times < 2s for list endpoints
- 99.9% uptime for game-related endpoints
- Proper error handling with meaningful messages

### **User Experience Metrics**
- Game creation → first participation time
- Discovery → joining conversion rate  
- User retention in ongoing games
- Leaderboard engagement time

---

## **Risk Assessment**

### **High Risk**
- **Blockchain Performance**: Solana RPC latency could affect UX
- **Data Consistency**: Ensuring blockchain and API data sync
- **Complex Queries**: Multiple blockchain calls for list endpoints

### **Medium Risk**  
- **User Adoption**: Gamification may not engage users as expected
- **Scalability**: Large number of games could impact performance
- **Edge Cases**: Complex game states and timing issues

### **Mitigation Strategies**
- Implement robust caching and fallback mechanisms
- Extensive testing with various game states and data sizes
- Monitor performance and user engagement closely
- Have rollback plan if gamification negatively impacts core features

---

## **Next Steps**

1. **✅ COMPLETED**: Requirements analysis and flow mapping
2. **📋 CURRENT**: Create implementation plan and tracking (this document)
3. **🔄 NEXT**: Begin Phase 1 implementation
   - Set up project structure (`routes/games.ts`, etc.)
   - Implement `GET /api/games/:capsule_id` endpoint
   - Test with existing Solana service integration
   - Add error handling and response formatting

---

**Last Updated**: 2025-01-23  
**Next Review**: After Phase 1 completion