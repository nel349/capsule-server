import express from "express";
import { PublicKey } from "@solana/web3.js";
import { ApiResponse } from "../types";
import { getUserByWallet } from "../utils/database";
import { supabase } from "../utils/supabase";
import { ActionGetResponse, createActionHeaders, ACTIONS_CORS_HEADERS } from "@solana/actions";

const router = express.Router();

// Helper function to calculate user stats from database and blockchain
async function calculateUserStatsFromDatabase(walletAddress: string) {
  try {
    console.log(`📊 Calculating real stats for user: ${walletAddress}`);

    // Get all guesses by this user from database
    const { data: userGuesses, error: guessError } = await supabase
      .from("guesses")
      .select(
        `
        *,
        capsules!inner(
          capsule_id,
          user_id,
          is_gamified,
          status
        )
      `
      )
      .eq("guesser_wallet", walletAddress)
      .eq("status", "confirmed"); // Only confirmed guesses

    if (guessError) {
      console.error("Error fetching user guesses:", guessError);
      return null;
    }

    // Get games created by this user
    const { data: userCapsules, error: capsulesError } = await supabase
      .from("capsules")
      .select(
        `
        capsule_id,
        is_gamified,
        status,
        users!inner(wallet_address)
      `
      )
      .eq("users.wallet_address", walletAddress)
      .eq("is_gamified", true);

    if (capsulesError) {
      console.error("Error fetching user capsules:", capsulesError);
      return null;
    }

    // Calculate basic stats from database
    const gamesParticipated = userGuesses?.length || 0;
    const gamesCreated = userCapsules?.length || 0;

    // TODO: Query blockchain for actual game results to calculate wins
    // For now, estimate wins based on database activity
    const gamesWon = 0;
    let totalPoints = 0;

    // Award participation points (5 points per guess)
    totalPoints += gamesParticipated * 5;

    // Award creator bonus (50 points per participant in their games)
    // This would require blockchain queries to get actual participant counts
    // For now, estimate based on average participation
    totalPoints += gamesCreated * 50; // Base creator bonus

    // Calculate win rate (would be accurate with blockchain data)
    const winRate = gamesParticipated > 0 ? gamesWon / gamesParticipated : 0;

    return {
      wallet_address: walletAddress,
      total_points: totalPoints,
      games_won: gamesWon,
      games_participated: gamesParticipated,
      games_created: gamesCreated,
      win_rate: winRate,
      badge_count: Math.floor(totalPoints / 200), // Badge every 200 points
    };
  } catch (error) {
    console.error(`Error calculating stats for ${walletAddress}:`, error);
    return null;
  }
}

// Generate leaderboard from database activity
async function generateLeaderboardFromDatabase(limit: number = 50, offset: number = 0) {
  try {
    console.log("🏆 Generating leaderboard from database...");

    // Get all users who have participated in games
    const { data: activeUsers, error } = await supabase
      .from("guesses")
      .select(
        `
        guesser_wallet,
        capsules!inner(is_gamified)
      `
      )
      .eq("status", "confirmed")
      .eq("capsules.is_gamified", true);

    if (error) {
      console.error("Error fetching active users:", error);
      return [];
    }

    // Get unique wallet addresses
    const uniqueWallets = [...new Set(activeUsers?.map(g => g.guesser_wallet) || [])];

    console.log(`Found ${uniqueWallets.length} unique participants`);

    // Calculate stats for each user
    const userStats = [];
    for (const wallet of uniqueWallets) {
      const stats = await calculateUserStatsFromDatabase(wallet);
      if (stats) {
        userStats.push(stats);
      }
    }

    // Sort by total points descending
    userStats.sort((a, b) => b.total_points - a.total_points);

    // Apply pagination and add ranks
    const paginatedUsers = userStats.slice(offset, offset + limit);

    return paginatedUsers.map((user, index) => ({
      rank: index + 1 + offset,
      wallet_address: user.wallet_address,
      display_name: `${user.wallet_address.slice(0, 4)}...${user.wallet_address.slice(-4)}`,
      total_points: user.total_points,
      games_won: user.games_won,
      games_participated: user.games_participated,
      games_created: user.games_created,
      win_rate: user.win_rate,
      badge_count: user.badge_count,
      is_current_user: false,
    }));
  } catch (error) {
    console.error("Error generating leaderboard:", error);
    return [];
  }
}

// Global leaderboard endpoint
router.get("/global", async (req, res) => {
  try {
    const { timeframe = "all-time", limit = 50, offset = 0 } = req.query;

    console.log("🏆 Fetching global leaderboard from database...");

    // Generate leaderboard from actual database data
    const leaderboard = await generateLeaderboardFromDatabase(Number(limit), Number(offset));

    console.log(`🎯 Generated leaderboard with ${leaderboard.length} entries`);

    res.json({
      success: true,
      data: leaderboard,
      metadata: {
        timeframe,
        limit: Number(limit),
        offset: Number(offset),
        data_source: "database_activity",
      },
    } as ApiResponse);
  } catch (error) {
    console.error("Global leaderboard error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch global leaderboard",
    } as ApiResponse);
  }
});

// User stats endpoint
router.get("/user/:wallet_address", async (req, res) => {
  try {
    const { wallet_address } = req.params;

    console.log(`📊 Fetching real stats for user: ${wallet_address}`);

    // Validate wallet address format
    try {
      new PublicKey(wallet_address);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: "Invalid wallet address format",
      } as ApiResponse);
    }

    // Calculate user stats from database
    const stats = await calculateUserStatsFromDatabase(wallet_address);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: "User not found or has no game activity",
      } as ApiResponse);
    }

    // Get display name from database if available
    let displayName = `${wallet_address.slice(0, 4)}...${wallet_address.slice(-4)}`;
    try {
      const { data: user } = await getUserByWallet(wallet_address);
      if (user?.name) {
        displayName = user.name;
      }
    } catch (error) {
      // Use default wallet address display
    }

    // Calculate global rank by comparing with all users
    const allUsers = await generateLeaderboardFromDatabase(1000, 0); // Get top 1000
    const userRank = allUsers.findIndex(u => u.wallet_address === wallet_address) + 1;
    const globalRank = userRank > 0 ? userRank : null;

    // Get recent activity from database
    const { data: recentGuesses } = await supabase
      .from("guesses")
      .select(
        `
        *,
        capsules!inner(capsule_id, is_gamified)
      `
      )
      .eq("guesser_wallet", wallet_address)
      .eq("status", "confirmed")
      .eq("capsules.is_gamified", true)
      .order("submitted_at", { ascending: false })
      .limit(5);

    const recentAchievements = (recentGuesses || []).map(guess => ({
      type: "participation" as const,
      game_id: guess.capsules.capsule_id,
      points_earned: 5, // Participation points
      timestamp: guess.submitted_at,
      description: `Participated in game for capsule ${guess.capsules.capsule_id.slice(0, 8)}...`,
    }));

    const userStats = {
      ...stats,
      display_name: displayName,
      global_rank: globalRank,
      recent_achievements: recentAchievements,
    };

    res.json({
      success: true,
      data: userStats,
      metadata: {
        data_source: "database_activity",
        rank_based_on_top: allUsers.length,
      },
    } as ApiResponse);
  } catch (error) {
    console.error("User stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user stats",
    } as ApiResponse);
  }
});

// Game-specific leaderboard endpoint
router.get("/game/:capsule_id", async (req, res) => {
  try {
    const { capsule_id } = req.params;

    console.log(`🎮 Fetching game leaderboard for capsule: ${capsule_id}`);

    // Validate capsule_id format
    if (!capsule_id || typeof capsule_id !== "string") {
      return res.status(400).json({
        success: false,
        error: "Invalid capsule_id format",
      } as ApiResponse);
    }

    // Verify the capsule exists and is gamified
    const { data: capsule, error: capsuleError } = await supabase
      .from("capsules")
      .select("*")
      .eq("capsule_id", capsule_id)
      .single();

    if (capsuleError || !capsule) {
      return res.status(404).json({
        success: false,
        error: "Capsule not found",
      } as ApiResponse);
    }

    if (!capsule.is_gamified) {
      return res.status(400).json({
        success: false,
        error: "This capsule is not gamified",
      } as ApiResponse);
    }

    // Get all guesses for this game from database
    const { data: gameGuesses, error: guessesError } = await supabase
      .from("guesses")
      .select("*")
      .eq("capsule_id", capsule_id)
      .eq("status", "confirmed")
      .order("submitted_at", { ascending: true }); // First submit gets better rank

    if (guessesError) {
      console.error("Error fetching game guesses:", guessesError);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch game data",
      } as ApiResponse);
    }

    // Format the game leaderboard
    const gameLeaderboard = (gameGuesses || []).map((guess, index) => {
      // TODO: Query blockchain to determine actual winners
      // For now, assume the first submitter has higher chance of winning
      const isWinner = index === 0 && Math.random() > 0.5; // 50% chance for first submitter

      return {
        rank: index + 1,
        wallet_address: guess.guesser_wallet,
        display_name: guess.is_anonymous
          ? `Anonymous #${index + 1}`
          : `${guess.guesser_wallet.slice(0, 4)}...${guess.guesser_wallet.slice(-4)}`,
        points_earned: isWinner ? 100 : 5, // Winners get 100, participants get 5
        is_winner: isWinner,
        guess_content: guess.is_anonymous ? "[Anonymous Guess]" : guess.guess_content,
        submitted_at: guess.submitted_at,
        is_anonymous: guess.is_anonymous,
      };
    });

    res.json({
      success: true,
      data: gameLeaderboard,
      metadata: {
        capsule_id,
        total_participants: gameLeaderboard.length,
        data_source: "database_guesses",
        note: "Winner determination pending blockchain integration",
      },
    } as ApiResponse);
  } catch (error) {
    console.error("Game leaderboard error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch game leaderboard",
    } as ApiResponse);
  }
});

// =============================================================================
// BLINK/ACTIONS ENDPOINTS FOR LEADERBOARD
// =============================================================================

// Global Leaderboard Blink - GET endpoint
router.get("/blink/global", async (_req, res) => {
  try {
    // Set CORS headers for Actions
    res.set(createActionHeaders());

    // Get leaderboard data
    const leaderboard = await generateLeaderboardFromDatabase(10, 0); // Top 10 for Blink display

    // Format leaderboard for display
    const topUsers = leaderboard
      .slice(0, 5)
      .map(user => `${user.rank}. ${user.display_name} - ${user.total_points} pts`)
      .join("\\n");

    const actionResponse: ActionGetResponse = {
      type: "action",
      icon: "https://ucarecdn.com/7aa46c85-08a4-4bc7-9376-88b424990d12/",
      title: "🏆 CapsuleX Global Leaderboard",
      description: `Top Players:\\n${topUsers}\\n\\nSee full rankings and compete in time capsule games!`,
      label: "View Full Leaderboard",
      links: {
        actions: [
          {
            type: "external-link",
            label: "🎮 Join Game",
            href: "/api/games/active",
          },
          {
            type: "transaction",
            label: "📊 My Stats",
            href: "/api/leaderboard/blink/user",
            parameters: [
              {
                name: "wallet",
                label: "Your wallet address",
                required: true,
              },
            ],
          },
        ],
      },
    };

    res.json(actionResponse);
  } catch (error) {
    console.error("Leaderboard Blink error:", error);
    res.status(500).json({
      error: "Failed to load leaderboard",
    });
  }
});

// User Stats Blink - GET endpoint
router.get("/blink/user", async (req, res) => {
  try {
    res.set(createActionHeaders());

    const { wallet } = req.query;

    if (!wallet || typeof wallet !== "string") {
      const actionResponse: ActionGetResponse = {
        type: "action",
        icon: "https://ucarecdn.com/7aa46c85-08a4-4bc7-9376-88b424990d12/",
        title: "📊 Your CapsuleX Stats",
        description: "Enter your wallet address to view your game statistics and ranking.",
        label: "Get My Stats",
        links: {
          actions: [
            {
              type: "transaction",
              label: "📊 View Stats",
              href: "/api/leaderboard/blink/user",
              parameters: [
                {
                  name: "wallet",
                  label: "Your wallet address",
                  required: true,
                },
              ],
            },
          ],
        },
      };
      return res.json(actionResponse);
    }

    // Validate wallet address
    try {
      new PublicKey(wallet);
    } catch (error) {
      return res.status(400).json({
        error: "Invalid wallet address format",
      });
    }

    // Get user stats
    const stats = await calculateUserStatsFromDatabase(wallet);

    if (!stats) {
      const actionResponse: ActionGetResponse = {
        type: "action",
        icon: "https://ucarecdn.com/7aa46c85-08a4-4bc7-9376-88b424990d12/",
        title: "🎮 Start Your CapsuleX Journey",
        description: "No game activity found. Join a game to start earning points and competing!",
        label: "Join First Game",
        links: {
          actions: [
            {
              type: "external-link",
              label: "🎮 Browse Games",
              href: "/api/games/active",
            },
          ],
        },
      };
      return res.json(actionResponse);
    }

    const actionResponse: ActionGetResponse = {
      type: "action",
      icon: "https://ucarecdn.com/7aa46c85-08a4-4bc7-9376-88b424990d12/",
      title: `📊 ${stats.wallet_address.slice(0, 4)}...${stats.wallet_address.slice(-4)} Stats`,
      description: `🏆 Points: ${stats.total_points}\\n🎮 Games Played: ${stats.games_participated}\\n🎯 Games Created: ${stats.games_created}\\n🏅 Badges: ${stats.badge_count}`,
      label: "View Global Leaderboard",
      links: {
        actions: [
          {
            type: "external-link",
            label: "🏆 Global Ranking",
            href: "/api/leaderboard/blink/global",
          },
          {
            type: "external-link",
            label: "🎮 Join New Game",
            href: "/api/games/active",
          },
        ],
      },
    };

    res.json(actionResponse);
  } catch (error) {
    console.error("User stats Blink error:", error);
    res.status(500).json({
      error: "Failed to load user stats",
    });
  }
});

// Game Leaderboard Blink - GET endpoint
router.get("/blink/game/:capsule_id", async (req, res) => {
  try {
    res.set(createActionHeaders());

    const { capsule_id } = req.params;

    // Validate capsule exists and is gamified
    const { data: capsule, error: capsuleError } = await supabase
      .from("capsules")
      .select("*")
      .eq("capsule_id", capsule_id)
      .single();

    if (capsuleError || !capsule || !capsule.is_gamified) {
      return res.status(404).json({
        error: "Game not found",
      });
    }

    // Get game participants
    const { data: gameGuesses } = await supabase
      .from("guesses")
      .select("*")
      .eq("capsule_id", capsule_id)
      .eq("status", "confirmed")
      .order("submitted_at", { ascending: true });

    const participants = gameGuesses?.length || 0;
    const topParticipants = (gameGuesses || [])
      .slice(0, 3)
      .map((guess, index) => {
        const displayName = guess.is_anonymous
          ? `Anonymous #${index + 1}`
          : `${guess.guesser_wallet.slice(0, 4)}...${guess.guesser_wallet.slice(-4)}`;
        return `${index + 1}. ${displayName}`;
      })
      .join("\\n");

    const timeUntilReveal = Math.max(
      0,
      Math.floor((new Date(capsule.reveal_date).getTime() - Date.now()) / 1000)
    );

    const isRevealed = capsule.status === "revealed" || capsule.status === "posted";
    const canStillJoin = !isRevealed && timeUntilReveal > 0;

    const description = isRevealed
      ? `Game Complete! 🎉\\n\\nParticipants: ${participants}\\n${topParticipants ? `\\nTop Players:\\n${topParticipants}` : ""}`
      : `🎮 Active Game\\n⏰ ${Math.floor(timeUntilReveal / 3600)}h ${Math.floor((timeUntilReveal % 3600) / 60)}m left\\n👥 ${participants} participants\\n${topParticipants ? `\\nCurrent Players:\\n${topParticipants}` : ""}`;

    const actionResponse: ActionGetResponse = {
      type: "action",
      icon: "https://ucarecdn.com/7aa46c85-08a4-4bc7-9376-88b424990d12/",
      title: `🎯 Game ${capsule_id.slice(0, 8)}... Leaderboard`,
      description,
      label: canStillJoin ? "Join Game" : "View Global Leaderboard",
      links: {
        actions: canStillJoin
          ? [
              {
                type: "external-link",
                label: "🎮 Submit Guess",
                href: `/api/games/${capsule_id}`,
              },
              {
                type: "external-link",
                label: "🏆 Global Leaderboard",
                href: "/api/leaderboard/blink/global",
              },
            ]
          : [
              {
                type: "external-link",
                label: "🏆 Global Leaderboard",
                href: "/api/leaderboard/blink/global",
              },
              {
                type: "external-link",
                label: "🎮 Find New Game",
                href: "/api/games/active",
              },
            ],
      },
    };

    res.json(actionResponse);
  } catch (error) {
    console.error("Game leaderboard Blink error:", error);
    res.status(500).json({
      error: "Failed to load game leaderboard",
    });
  }
});

// Handle OPTIONS requests for CORS
router.options("/blink/*", (_req, res) => {
  res.set(ACTIONS_CORS_HEADERS);
  res.status(200).end();
});

export default router;
