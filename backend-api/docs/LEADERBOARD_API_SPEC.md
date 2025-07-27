# Leaderboard API Endpoints

This document defines the API endpoints required for the leaderboard system.

## Endpoints Required

### 1. Global Leaderboard
```
GET /api/leaderboard/global
```

**Query Parameters:**
- `timeframe` (optional): 'all-time' | 'weekly' | 'monthly' (default: 'all-time')
- `limit` (optional): number of entries to return (default: 50)
- `offset` (optional): pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "wallet_address": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
      "display_name": "CryptoBuilder",
      "total_points": 1250,
      "games_won": 15,
      "games_participated": 32,
      "win_rate": 0.46875,
      "badge_count": 8,
      "is_current_user": false
    }
  ]
}
```

### 2. User Stats
```
GET /api/leaderboard/user/:wallet_address
```

**Response:**
```json
{
  "success": true,
  "data": {
    "wallet_address": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
    "total_points": 1250,
    "global_rank": 1,
    "games_won": 15,
    "games_participated": 32,
    "win_rate": 0.46875,
    "badge_count": 8,
    "recent_achievements": [
      {
        "type": "win",
        "game_id": "capsule_123",
        "points_earned": 100,
        "timestamp": "2025-01-15T10:30:00Z"
      },
      {
        "type": "participation",
        "game_id": "capsule_124",
        "points_earned": 5,
        "timestamp": "2025-01-14T15:20:00Z"
      }
    ]
  }
}
```

### 3. Game-Specific Leaderboard
```
GET /api/leaderboard/game/:capsule_id
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "wallet_address": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
      "display_name": "CryptoBuilder",
      "points_earned": 100,
      "is_winner": true,
      "guess_content": "A vacation photo",
      "submitted_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

## Discovery Endpoints

### 4. Active Games Discovery
```
GET /api/capsules/games/active
```

**Query Parameters:**
- `limit` (optional): number of games to return (default: 20)
- `sort` (optional): 'newest' | 'ending_soon' | 'most_popular' (default: 'newest')

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "capsule_id": "cap_123",
      "content_hint": "Something I captured during my travels",
      "reveal_date": "2025-01-20T15:00:00Z",
      "current_participants": 12,
      "max_participants": 50,
      "current_guesses": 8,
      "max_guesses": 100,
      "prize_pool": 500,
      "time_remaining": "2d 4h 30m",
      "is_user_participating": false,
      "created_by": {
        "wallet_address": "creator_wallet",
        "display_name": "TravelPhotog"
      }
    }
  ]
}
```

### 5. Trending Games
```
GET /api/capsules/games/trending
```

**Response:** Same format as active games, sorted by activity/popularity

### 6. Ending Soon Games
```
GET /api/capsules/games/ending-soon
```

**Query Parameters:**
- `hours` (optional): games ending within X hours (default: 24)

**Response:** Same format as active games, sorted by time remaining

## Database Schema Requirements

### Points System
- **Winner Points**: 100 points per game won
- **Participation Points**: 5 points per game participated
- **Creator Bonus**: 50 points per participant in their game
- **Badge Points**: Variable based on achievement type

### Required Database Views/Queries
1. **User Points Aggregation**: Sum all points from games, badges, achievements
2. **Global Rankings**: Rank users by total points with tie-breaking
3. **Time-based Rankings**: Filter by date ranges for weekly/monthly
4. **Game Activity**: Track participation and wins per user
5. **Achievement Tracking**: Log recent point-earning activities

## Implementation Priority

### Phase 1 (High Priority)
1. `GET /api/leaderboard/global` - Essential for leaderboard screen
2. `GET /api/leaderboard/user/:wallet` - User stats display
3. `GET /api/capsules/games/active` - Game discovery

### Phase 2 (Medium Priority)
4. `GET /api/capsules/games/ending-soon` - Urgency-driven discovery
5. `GET /api/capsules/games/trending` - Engagement-driven discovery

### Phase 3 (Lower Priority)
6. `GET /api/leaderboard/game/:capsule_id` - Individual game rankings

## Database Queries

### Global Leaderboard Query
```sql
WITH user_stats AS (
  SELECT 
    u.user_id,
    u.wallet_address,
    u.display_name,
    COALESCE(SUM(
      CASE 
        WHEN g.winner_wallet = u.wallet_address THEN 100
        WHEN g.guesser_wallet = u.wallet_address THEN 5
        ELSE 0
      END
    ), 0) as total_points,
    COUNT(CASE WHEN g.winner_wallet = u.wallet_address THEN 1 END) as games_won,
    COUNT(CASE WHEN g.guesser_wallet = u.wallet_address THEN 1 END) as games_participated,
    COUNT(b.badge_id) as badge_count
  FROM users u
  LEFT JOIN game_guesses g ON u.wallet_address IN (g.guesser_wallet, g.winner_wallet)
  LEFT JOIN user_badges b ON u.user_id = b.user_id
  GROUP BY u.user_id, u.wallet_address, u.display_name
)
SELECT 
  *,
  RANK() OVER (ORDER BY total_points DESC, games_won DESC) as rank,
  CASE WHEN games_participated > 0 THEN games_won::float / games_participated ELSE 0 END as win_rate
FROM user_stats
WHERE total_points > 0
ORDER BY rank
LIMIT $1 OFFSET $2;
```

This provides a complete specification for implementing the leaderboard system with all necessary endpoints and database requirements.