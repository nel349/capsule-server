import express from "express";
import { ApiResponse } from "../types";
import { SolanaService } from "../services/solana";
import { PublicKey } from "@solana/web3.js";
import { CAPSULEX_PROGRAM_CONFIG } from "../config/solana";
import { supabase } from "../utils/supabase";
import * as anchor from "@coral-xyz/anchor";

const router = express.Router();

// Constants for PDA derivation (matching Solana program)
const CAPSULE_SEED = "capsule";

// Initialize SolanaService using the cluster from config
const solanaService = new SolanaService(
  process.env.SOLANA_RPC_URL || CAPSULEX_PROGRAM_CONFIG.cluster,
  "confirmed"
);

// Helper function to derive capsule PDA (matching Solana program tests)
function getCapsulePda(creator: PublicKey, revealDate: anchor.BN, programId: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(CAPSULE_SEED), creator.toBuffer(), Buffer.from(revealDate.toArray("le", 8))],
    programId
  );
  return pda;
}

// Get active games that users can participate in
router.get("/active", async (req, res) => {
  try {
    // Parse query parameters
    const limit = parseInt(req.query.limit as string) || 50; // Default to 50 games
    const excludeCreator = req.query.exclude_creator as string;

    console.log("Fetching active games with params:", { limit, excludeCreator });

    // Build the database query for gamified capsules that are active
    let query = supabase
      .from("capsules")
      .select(
        `
        *,
        users!inner(wallet_address)
      `
      )
      .eq("is_gamified", true)
      .eq("status", "pending") // Only pending capsules (not yet revealed)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Add creator exclusion if specified
    if (excludeCreator) {
      // Validate wallet address format
      try {
        new PublicKey(excludeCreator);
        query = query.neq("users.wallet_address", excludeCreator);
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: "Invalid wallet address format for exclude_creator parameter",
        } as ApiResponse);
      }
    }

    const { data: capsulesData, error: capsulesError } = await query;

    if (capsulesError) {
      console.error("Database error:", capsulesError);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch active games",
      } as ApiResponse);
    }

    if (!capsulesData || capsulesData.length === 0) {
      return res.json({
        success: true,
        data: {
          games: [],
          total: 0,
          filters: {
            limit,
            exclude_creator: excludeCreator || null,
          },
        },
      } as ApiResponse);
    }

    console.log(`Found ${capsulesData.length} gamified capsules`);

    // Initialize Solana service for read-only operations
    await solanaService.initializeProgramReadOnly();

    // Process each capsule to get game data from blockchain
    const activeGames = [];
    const programId = new PublicKey(CAPSULEX_PROGRAM_CONFIG.programId);

    for (const capsule of capsulesData) {
      try {
        // Derive the capsule PDA
        const creator = new PublicKey(capsule.users.wallet_address);
        const revealDate = new anchor.BN(
          Math.floor(new Date(capsule.reveal_date).getTime() / 1000)
        );
        const capsulePda = getCapsulePda(creator, revealDate, programId);

        // Get game data from blockchain
        const gameData = await solanaService.getGameData(capsulePda);

        if (gameData && gameData.isActive) {
          // Only include games that are still active
          const gameResponse = {
            game_id: solanaService.getGamePda(capsulePda).toBase58(),
            capsule_id: capsule.capsule_id,
            capsule_pda: capsulePda.toBase58(),
            creator: gameData.creator.toBase58(),
            max_guesses: gameData.maxGuesses,
            max_winners: gameData.maxWinners,
            current_guesses: gameData.currentGuesses,
            winners_found: gameData.winnersFound || 0,
            is_active: gameData.isActive,
            total_participants: gameData.totalParticipants || 0,
            reveal_date: capsule.reveal_date,
            created_at: capsule.created_at,
            content_hint: capsule.has_media ? "Contains media content" : "Text content",
            time_until_reveal: Math.max(
              0,
              Math.floor((new Date(capsule.reveal_date).getTime() - Date.now()) / 1000)
            ),
          };

          activeGames.push(gameResponse);
        }
      } catch (error) {
        console.warn(
          `Failed to process capsule ${capsule.capsule_id}:`,
          error instanceof Error ? error.message : "Unknown error"
        );
        // Continue processing other capsules
      }
    }

    // Sort by most recent first
    activeGames.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json({
      success: true,
      data: {
        games: activeGames,
        total: activeGames.length,
        filters: {
          limit,
          exclude_creator: excludeCreator || null,
        },
      },
    } as ApiResponse);
  } catch (error: any) {
    console.error("Get active games error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    } as ApiResponse);
  }
});

// Get game details for a specific capsule
router.get("/:capsule_id", async (req, res) => {
  try {
    const { capsule_id } = req.params;

    if (!capsule_id) {
      return res.status(400).json({
        success: false,
        error: "capsule_id is required",
      } as ApiResponse);
    }

    // Get capsule info with creator's wallet address via join
    console.log("Fetching capsule data for ID:", capsule_id);
    const { data: capsuleData, error: capsuleError } = await supabase
      .from("capsules")
      .select(
        `
        *,
        users!inner(wallet_address)
      `
      )
      .eq("capsule_id", capsule_id)
      .single();

    if (capsuleError) {
      console.error("Database error:", capsuleError);
      return res.status(404).json({
        success: false,
        error: "Capsule not found",
      } as ApiResponse);
    }

    if (!capsuleData) {
      console.log("No capsule data returned");
      return res.status(404).json({
        success: false,
        error: "Capsule not found",
      } as ApiResponse);
    }

    console.log("Capsule data fetched:", {
      capsule_id: capsuleData.capsule_id,
      is_gamified: capsuleData.is_gamified,
      wallet_address: capsuleData.users?.wallet_address,
    });

    // Check if this capsule is gamified
    if (!capsuleData.is_gamified) {
      return res.status(400).json({
        success: false,
        error: "This capsule is not gamified",
      } as ApiResponse);
    }

    // Derive the capsule PDA using the same method as the Solana program
    let capsulePda: PublicKey;
    try {
      console.log("Creating PDA with:", {
        wallet_address: capsuleData.users.wallet_address,
        reveal_date: capsuleData.reveal_date,
        program_id: CAPSULEX_PROGRAM_CONFIG.programId,
      });

      const creator = new PublicKey(capsuleData.users.wallet_address);
      const revealDate = new anchor.BN(
        Math.floor(new Date(capsuleData.reveal_date).getTime() / 1000)
      );
      const programId = new PublicKey(CAPSULEX_PROGRAM_CONFIG.programId);

      capsulePda = getCapsulePda(creator, revealDate, programId);
      console.log("Derived capsule PDA:", capsulePda.toBase58());
    } catch (error: any) {
      console.error("PDA derivation error:", error);
      return res.status(500).json({
        success: false,
        error: "Unable to determine capsule PDA address",
      } as ApiResponse);
    }

    // Initialize Solana service for read-only operations
    await solanaService.initializeProgramReadOnly();

    // Get game data from blockchain
    const gameData = await solanaService.getGameData(capsulePda);

    if (!gameData) {
      return res.status(404).json({
        success: false,
        error: "Game not found on blockchain",
      } as ApiResponse);
    }

    // Format the response
    const gameResponse = {
      game_id: solanaService.getGamePda(capsulePda).toBase58(),
      capsule_id: capsule_id,
      capsule_pda: capsulePda.toBase58(),
      creator: gameData.creator.toBase58(),
      max_guesses: gameData.maxGuesses,
      max_winners: gameData.maxWinners,
      current_guesses: gameData.currentGuesses,
      winners_found: gameData.winnersFound || 0,
      is_active: gameData.isActive,
      winner: gameData.winner ? gameData.winner.toBase58() : null,
      total_participants: gameData.totalParticipants || 0,
      reveal_date: capsuleData.reveal_date,
      created_at: capsuleData.created_at,
      // Additional helpful info from database
      content_hint: capsuleData.has_media ? "Contains media content" : "Text content",
      is_revealed: capsuleData.status === "revealed" || capsuleData.status === "posted",
    };

    res.json({
      success: true,
      data: gameResponse,
    } as ApiResponse);
  } catch (error: any) {
    console.error("Get game details error:", error);

    // Handle specific blockchain errors
    if (error instanceof Error && error.message.includes("Account does not exist")) {
      return res.status(404).json({
        success: false,
        error: "Game not found on blockchain",
      } as ApiResponse);
    }

    res.status(500).json({
      success: false,
      error: "Internal server error",
    } as ApiResponse);
  }
});

// Get guesses for a specific game
router.get("/:capsule_id/guesses", async (req, res) => {
  try {
    const { capsule_id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50; // Default to 50 guesses
    const offset = parseInt(req.query.offset as string) || 0; // Default to 0 offset
    const includeStats = req.query.include_stats === "true";

    if (!capsule_id) {
      return res.status(400).json({
        success: false,
        error: "capsule_id is required",
      } as ApiResponse);
    }

    console.log("Fetching guesses for capsule:", { capsule_id, limit, offset, includeStats });

    // Get capsule info with creator's wallet address via join
    const { data: capsuleData, error: capsuleError } = await supabase
      .from("capsules")
      .select(
        `
        *,
        users!inner(wallet_address)
      `
      )
      .eq("capsule_id", capsule_id)
      .single();

    if (capsuleError || !capsuleData) {
      console.error("Database error:", capsuleError);
      return res.status(404).json({
        success: false,
        error: "Capsule not found",
      } as ApiResponse);
    }

    // Check if this capsule is gamified
    if (!capsuleData.is_gamified) {
      return res.status(400).json({
        success: false,
        error: "This capsule is not gamified",
      } as ApiResponse);
    }

    // Derive the capsule PDA and game PDA
    let capsulePda: PublicKey;
    let gamePda: PublicKey;
    try {
      const creator = new PublicKey(capsuleData.users.wallet_address);
      const revealDate = new anchor.BN(
        Math.floor(new Date(capsuleData.reveal_date).getTime() / 1000)
      );
      const programId = new PublicKey(CAPSULEX_PROGRAM_CONFIG.programId);

      capsulePda = getCapsulePda(creator, revealDate, programId);
      gamePda = solanaService.getGamePda(capsulePda);
      console.log("Derived PDAs:", {
        capsulePda: capsulePda.toBase58(),
        gamePda: gamePda.toBase58(),
      });
    } catch (error: any) {
      console.error("PDA derivation error:", error);
      return res.status(500).json({
        success: false,
        error: "Unable to determine game address",
      } as ApiResponse);
    }

    // Initialize Solana service for read-only operations
    await solanaService.initializeProgramReadOnly();

    // Verify the game exists
    const gameData = await solanaService.getGameData(capsulePda);
    if (!gameData) {
      return res.status(404).json({
        success: false,
        error: "Game not found on blockchain",
      } as ApiResponse);
    }

    // Get all guesses for this game from blockchain
    const allGuesses = await solanaService.getGuessesForGame(gamePda);

    // Sort guesses by submission time (most recent first)
    allGuesses.sort((a, b) => b.account.timestamp - a.account.timestamp);

    // Apply pagination
    const paginatedGuesses = allGuesses.slice(offset, offset + limit);

    // Format the guesses for response
    const formattedGuesses = paginatedGuesses.map(guess => ({
      guess_id: guess.publicKey.toBase58(),
      guesser: guess.account.isAnonymous ? null : guess.account.guesser.toBase58(),
      guess_content: guess.account.guessContent,
      is_anonymous: guess.account.isAnonymous,
      is_paid: guess.account.isPaid,
      is_correct: guess.account.isCorrect || false,
      submitted_at: new Date(guess.account.timestamp * 1000).toISOString(),
    }));

    // Prepare response data
    const responseData: any = {
      guesses: formattedGuesses,
      pagination: {
        total: allGuesses.length,
        limit,
        offset,
        has_more: offset + limit < allGuesses.length,
      },
      game_info: {
        game_id: gamePda.toBase58(),
        capsule_id: capsule_id,
        total_guesses: gameData.currentGuesses,
        max_guesses: gameData.maxGuesses,
        is_active: gameData.isActive,
      },
    };

    // Add anonymous statistics if requested
    if (includeStats) {
      const anonymousCount = allGuesses.filter(guess => guess.account.isAnonymous).length;
      const paidCount = allGuesses.filter(guess => guess.account.isPaid).length;
      const correctCount = allGuesses.filter(guess => guess.account.isCorrect).length;

      responseData.stats = {
        total_guesses: allGuesses.length,
        anonymous_guesses: anonymousCount,
        paid_guesses: paidCount,
        correct_guesses: correctCount,
        unique_participants: new Set(
          allGuesses
            .filter(guess => !guess.account.isAnonymous)
            .map(guess => guess.account.guesser.toBase58())
        ).size,
      };
    }

    res.json({
      success: true,
      data: responseData,
    } as ApiResponse);
  } catch (error: any) {
    console.error("Get game guesses error:", error);

    // Handle specific blockchain errors
    if (error instanceof Error && error.message.includes("Account does not exist")) {
      return res.status(404).json({
        success: false,
        error: "Game not found on blockchain",
      } as ApiResponse);
    }

    res.status(500).json({
      success: false,
      error: "Internal server error",
    } as ApiResponse);
  }
});

export default router;
