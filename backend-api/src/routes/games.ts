import express from "express";
import { ApiResponse } from "../types";
import { SolanaService } from "../services/solana";
import { PublicKey } from "@solana/web3.js";
import { CAPSULEX_PROGRAM_CONFIG } from "../config/solana";
import { supabase } from "../utils/supabase";
import { SemanticService } from "../services/semanticService";
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

    // Initialize Solana service for blockchain queries
    const dummyKeypair = require("@solana/web3.js").Keypair.generate();
    await solanaService.initializeProgram(dummyKeypair);

    // Get all capsules from blockchain
    const program = solanaService.getProgram();
    const allCapsules = await program.account.capsule.all();
    const currentTime = Math.floor(Date.now() / 1000);

    // Validate exclude_creator if provided
    if (excludeCreator) {
      try {
        new PublicKey(excludeCreator);
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: "Invalid wallet address format for exclude_creator parameter",
        } as ApiResponse);
      }
    }

    // Filter for active gamified capsules that are not revealed
    const activeCapsules = allCapsules
      .filter((capsule: any) => {
        const account = capsule.account;
        const isActive = account.isActive && account.isGamified && !account.isRevealed;
        const creatorMatch = !excludeCreator || account.creator.toString() !== excludeCreator;
        return isActive && creatorMatch;
      })
      .slice(0, limit);

    if (activeCapsules.length === 0) {
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

    console.log(`Found ${activeCapsules.length} active gamified capsules`);

    // Process each capsule to get game data from blockchain
    const activeGames = [];

    // Use Promise.all to batch the game data requests for better performance
    const gamePromises = activeCapsules.map(async capsule => {
      try {
        const capsulePda = capsule.publicKey;
        const account = capsule.account;

        // Get game data and guesses in parallel
        const gamePda = solanaService.getGamePda(capsulePda);
        const [gameData, guesses] = await Promise.all([
          solanaService.getGameData(capsulePda).catch(() => null),
          solanaService.getGuessesForGame(gamePda).catch(() => []),
        ]);

        if (gameData && gameData.isActive) {
          return {
            game_id: gamePda.toBase58(),
            capsule_id: capsulePda.toBase58(),
            capsule_pda: capsulePda.toBase58(),
            creator: account.creator.toString(),
            creator_display_name: null,
            twitter_username: null,
            max_guesses: gameData.maxGuesses,
            max_winners: gameData.maxWinners,
            current_guesses: guesses.length,
            winners_found: gameData.winnersFound || 0,
            is_active: gameData.isActive,
            total_participants: new Set(
              guesses.map((g: any) => g.account?.guesser?.toString()).filter(Boolean)
            ).size,
            reveal_date: new Date(account.revealDate.toNumber() * 1000).toISOString(),
            created_at: new Date(account.createdAt.toNumber() * 1000).toISOString(),
            content_hint: "Text content",
            time_until_reveal: Math.max(0, account.revealDate.toNumber() - currentTime),
          };
        }
        return null;
      } catch (error) {
        console.warn(
          `Failed to process capsule ${capsule.publicKey.toString()}:`,
          error instanceof Error ? error.message : "Unknown error"
        );
        return null;
      }
    });

    // Wait for all games to be processed and filter out nulls
    const gameResults = await Promise.all(gamePromises);
    activeGames.push(...gameResults.filter(game => game !== null));

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
    const walletAddress = req.query.wallet_address as string; // Filter by specific wallet

    if (!capsule_id) {
      return res.status(400).json({
        success: false,
        error: "capsule_id is required",
      } as ApiResponse);
    }

    // Validate wallet address format if provided
    if (walletAddress) {
      try {
        new PublicKey(walletAddress);
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: "Invalid wallet address format",
        } as ApiResponse);
      }
    }

    console.log("Fetching guesses for capsule:", {
      capsule_id,
      limit,
      offset,
      includeStats,
      walletAddress,
    });

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
    let allGuesses = await solanaService.getGuessesForGame(gamePda);

    // Filter by wallet address if specified
    if (walletAddress) {
      const walletPubkey = new PublicKey(walletAddress);
      allGuesses = allGuesses.filter(
        guess => !guess.account.isAnonymous && guess.account.guesser.equals(walletPubkey)
      );
    }

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
        filtered_by_wallet: walletAddress || null,
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

// Submit a guess (register in database AFTER transaction confirmation)
router.post("/:capsule_id/guess", async (req, res) => {
  try {
    const { capsule_id } = req.params;
    const {
      transaction_signature, // Required - transaction must be confirmed
      guesser_wallet,
      guess_content,
      is_anonymous = false,
      guess_pda, // The derived PDA address for matching with on-chain data
      game_pda, // For additional validation
    } = req.body;

    // Validate required fields
    if (!capsule_id || !transaction_signature || !guesser_wallet || !guess_content || !guess_pda) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: capsule_id, transaction_signature, guesser_wallet, guess_content, guess_pda",
      } as ApiResponse);
    }

    // Validate wallet and PDA address formats
    try {
      new PublicKey(guesser_wallet);
      new PublicKey(guess_pda);
      if (game_pda) new PublicKey(game_pda);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: "Invalid wallet or PDA address format",
      } as ApiResponse);
    }

    console.log("Registering confirmed guess:", {
      capsule_id,
      guesser_wallet,
      guess_pda,
      transaction_signature: transaction_signature.substring(0, 20) + "...",
      is_anonymous,
    });

    // Get capsule info to verify it's gamified
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
      return res.status(404).json({
        success: false,
        error: "Capsule not found",
      } as ApiResponse);
    }

    if (!capsuleData.is_gamified) {
      return res.status(400).json({
        success: false,
        error: "This capsule is not gamified",
      } as ApiResponse);
    }

    // Verify transaction signature exists on blockchain
    try {
      await solanaService.initializeProgramReadOnly();
      const connection = solanaService.getConnection();

      const txInfo = await connection.getTransaction(transaction_signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      if (!txInfo) {
        return res.status(400).json({
          success: false,
          error: "Transaction signature not found on blockchain",
        } as ApiResponse);
      }

      console.log("Transaction verified on blockchain:", {
        signature: transaction_signature.substring(0, 20) + "...",
        slot: txInfo.slot,
      });
    } catch (error) {
      console.error(
        "Transaction verification failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return res.status(400).json({
        success: false,
        error: "Could not verify transaction on blockchain",
      } as ApiResponse);
    }

    // Store the confirmed guess in database
    const { data: guessRecord, error: insertError } = await supabase
      .from("guesses")
      .insert({
        capsule_id,
        guesser_wallet,
        guess_content,
        is_anonymous: Boolean(is_anonymous),
        guess_pda, // Key for matching with on-chain data
        game_pda: game_pda || null,
        transaction_signature, // Already confirmed
        status: "confirmed", // Transaction is already confirmed
        confirmed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Database insert error:", insertError);
      return res.status(500).json({
        success: false,
        error: "Failed to register guess in database",
      } as ApiResponse);
    }

    console.log("Confirmed guess stored successfully:", {
      capsule_id,
      guesser_wallet,
      guess_pda,
      guess_id: guessRecord.id,
      transaction_signature: transaction_signature.substring(0, 20) + "...",
    });

    res.json({
      success: true,
      data: {
        message: "Guess confirmed and stored successfully",
        guess_id: guessRecord.id,
        capsule_id,
        guess_pda,
        transaction_signature,
        submitted_at: guessRecord.submitted_at,
        confirmed_at: guessRecord.confirmed_at,
        status: guessRecord.status,
      },
    } as ApiResponse);
  } catch (error: any) {
    console.error("Register guess error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    } as ApiResponse);
  }
});

// Get pending validations for a creator
router.get("/creator/:creatorWallet/pending-validations", async (req, res) => {
  try {
    const { creatorWallet } = req.params;
    
    console.log(`Fetching pending validations for creator: ${creatorWallet}`);
    
    // Validate creator wallet address
    try {
      new PublicKey(creatorWallet);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: "Invalid creator wallet address",
      } as ApiResponse);
    }

    // Get creator's gamified capsules that are revealed from users and capsules table
    const { data: creatorCapsules, error: capsulesError } = await supabase
      .from("capsules")
      .select(`
        *,
        users!inner(wallet_address)
      `)
      .eq("users.wallet_address", creatorWallet)
      .eq("is_gamified", true)
      .eq("status", "revealed")
      .order("created_at", { ascending: false });

    if (capsulesError) {
      console.error("Error fetching creator capsules:", capsulesError);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch creator capsules",
      } as ApiResponse);
    }

    if (!creatorCapsules || creatorCapsules.length === 0) {
      return res.json({
        success: true,
        data: {
          pending_validations: [],
          total_capsules: 0,
          total_guesses: 0,
        },
      } as ApiResponse);
    }

    // Return capsules with pending validation needed (no blockchain lookup here)
    const pendingValidations = creatorCapsules.map(capsule => ({
      capsule_id: capsule.capsule_id,
      reveal_date: capsule.reveal_date,
      content_encrypted: capsule.content_encrypted,
      estimated_validation_cost: 0, // Will be calculated when creator selects specific game
    }));

    console.log(`Found ${pendingValidations.length} pending validations for creator ${creatorWallet}`);
    console.log(pendingValidations);

    res.json({
      success: true,
      data: {
        pending_validations: pendingValidations,
        total_capsules: pendingValidations.length,
        total_guesses: 0, // Unknown until creator selects specific game
        estimated_total_cost: 0, // Unknown until creator selects specific game
      },
    } as ApiResponse);

  } catch (error: any) {
    console.error("Error fetching pending validations:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    } as ApiResponse);
  }
});

// Get pending guesses for a specific game
router.get("/creator/:creatorWallet/game/:gamePda/pending-guesses", async (req, res) => {
  try {
    const { creatorWallet, gamePda } = req.params;
    
    console.log(`Fetching pending guesses for creator: ${creatorWallet}, game: ${gamePda}`);
    
    // Validate parameters
    try {
      new PublicKey(creatorWallet);
      new PublicKey(gamePda);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: "Invalid wallet address or game PDA",
      } as ApiResponse);
    }

    // Initialize Solana service
    const dummyKeypair = require("@solana/web3.js").Keypair.generate();
    await solanaService.initializeProgram(dummyKeypair);

    // Get guesses for the specific game from blockchain
    const gamePublicKey = new PublicKey(gamePda);
    const guesses = await solanaService.getGuessesForGame(gamePublicKey);
    
    // Filter for unvalidated guesses
    const pendingGuesses = guesses.filter(guess => 
      !guess.account.isCorrect && guess.account.guessContent.trim().length > 0
    );

    console.log(`Found ${pendingGuesses.length} pending guesses for game ${gamePda}`);

    res.json({
      success: true,
      data: {
        game_pda: gamePda,
        pending_guesses: pendingGuesses.map(guess => ({
          guess_pda: guess.publicKey.toBase58(),
          guesser: guess.account.guesser.toBase58(),
          guess_content: guess.account.guessContent,
          timestamp: guess.account.timestamp.toNumber(),
          is_anonymous: guess.account.isAnonymous,
        })),
        total_guesses: pendingGuesses.length,
        estimated_validation_cost: pendingGuesses.length * 0.003,
      },
    } as ApiResponse);

  } catch (error: any) {
    console.error("Error fetching pending guesses:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    } as ApiResponse);
  }
});

// Get pending guesses for a specific capsule (derives game PDA automatically)
router.get("/capsule/:capsuleId/pending-guesses", async (req, res) => {
  try {
    const { capsuleId } = req.params;
    
    console.log(`Fetching pending guesses for capsule: ${capsuleId}`);

    // Get capsule data from database to derive game PDA
    const { data: capsule, error: capsuleError } = await supabase
      .from("capsules")
      .select(`
        *,
        users!inner(wallet_address)
      `)
      .eq("capsule_id", capsuleId)
      .eq("is_gamified", true)
      .eq("status", "revealed")
      .single();

    if (capsuleError || !capsule) {
      return res.status(404).json({
        success: false,
        error: "Capsule not found or not a revealed gamified capsule",
      } as ApiResponse);
    }

    // Derive game PDA using capsule data
    const creator = new PublicKey(capsule.users.wallet_address);
    const revealDate = new anchor.BN(
      Math.floor(new Date(capsule.reveal_date).getTime() / 1000)
    );
    const programId = new PublicKey(CAPSULEX_PROGRAM_CONFIG.programId);
    const capsulePDA = getCapsulePda(creator, revealDate, programId);

    // Derive game PDA
    const [gamePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("game"), capsulePDA.toBuffer()],
      programId
    );

    // Initialize Solana service
    const dummyKeypair = require("@solana/web3.js").Keypair.generate();
    await solanaService.initializeProgram(dummyKeypair);

    // Get guesses for the specific game from blockchain
    const guesses = await solanaService.getGuessesForGame(gamePDA);
    
    // Filter for unvalidated guesses
    const pendingGuesses = guesses.filter(guess => 
      !guess.account.isCorrect && guess.account.guessContent.trim().length > 0
    );

    console.log(`Found ${pendingGuesses.length} pending guesses for capsule ${capsuleId}`);

    res.json({
      success: true,
      data: {
        game_pda: gamePDA.toBase58(),
        capsule_id: capsuleId,
        pending_guesses: pendingGuesses.map(guess => ({
          guess_pda: guess.publicKey.toBase58(),
          guesser: guess.account.guesser.toBase58(),
          guess_content: guess.account.guessContent,
          timestamp: guess.account.timestamp.toNumber(),
          is_anonymous: guess.account.isAnonymous,
        })),
        total_guesses: pendingGuesses.length,
        estimated_validation_cost: pendingGuesses.length * 0.003,
      },
    } as ApiResponse);

  } catch (error: any) {
    console.error("Error fetching pending guesses for capsule:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    } as ApiResponse);
  }
});

// Submit batch validation results
router.post("/creator/validate-batch", async (req, res) => {
  try {
    const { 
      creator_wallet,
      capsule_id,
      validations,
      decrypted_content 
    } = req.body;

    console.log(`Processing batch validation for creator: ${creator_wallet}, capsule: ${capsule_id}`);

    // Validate required fields
    if (!creator_wallet || !capsule_id || !validations || !decrypted_content) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: creator_wallet, capsule_id, validations, decrypted_content",
      } as ApiResponse);
    }

    // Validate creator wallet
    try {
      const creatorPubkey = new PublicKey(creator_wallet);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: "Invalid creator wallet address",
      } as ApiResponse);
    }

    // Validate validations array
    if (!Array.isArray(validations) || validations.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Validations must be a non-empty array",
      } as ApiResponse);
    }

    // Prepare guesses for semantic validation
    const guessAnswerPairs = validations.map((validation: any) => ({
      id: validation.guess_pda,
      guess: validation.guess_content,
      answer: decrypted_content.trim(),
    }));

    console.log(`Validating ${guessAnswerPairs.length} guesses via semantic service`);

    // Process semantic validation batch (Creator pays for this)
    const semanticResults = await SemanticService.validateGuessesBatch(guessAnswerPairs);

    // Track validation costs for creator billing
    const validationCost = guessAnswerPairs.length * 0.003; // $0.003 per guess
    console.log(`💰 Creator will be charged: $${validationCost.toFixed(3)} for ${guessAnswerPairs.length} validations`);

    // Creator billing implementation - track the cost
    // In production, this would integrate with payment processor (Stripe, etc.)
    console.log(`📋 Billing record: Creator ${creator_wallet} owes $${validationCost.toFixed(3)} for semantic validation`);

    // Initialize Solana service for blockchain updates
    const dummyKeypair = require("@solana/web3.js").Keypair.generate();
    await solanaService.initializeProgram(dummyKeypair);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each semantic result and update blockchain
    for (const semanticResult of semanticResults) {
      try {
        const validation = validations.find((v: any) => v.guess_pda === semanticResult.id);
        if (!validation) {
          console.error(`Validation not found for guess: ${semanticResult.id}`);
          errorCount++;
          continue;
        }

        // Check if semantic validation was successful
        if ('error' in semanticResult.result) {
          console.error(`Semantic validation failed for ${semanticResult.id}:`, semanticResult.result.error);
          results.push({
            guess_pda: semanticResult.id,
            success: false,
            error: semanticResult.result.error,
          });
          errorCount++;
          continue;
        }

        const isCorrect = semanticResult.result.is_correct;
        console.log(`Guess ${semanticResult.id}: ${isCorrect ? 'CORRECT' : 'INCORRECT'} (similarity: ${semanticResult.result.similarity})`);

        // Update blockchain with verification result
        // Note: In production, this would be called by the creator's wallet with proper signatures
        // For now, we'll log the blockchain update that needs to happen
        console.log(`🔗 Blockchain update needed: verifyGuess(${semanticResult.id}, ${isCorrect})`);

        results.push({
          guess_pda: semanticResult.id,
          guess_content: validation.guess_content,
          guesser: validation.guesser,
          is_correct: isCorrect,
          similarity: semanticResult.result.similarity,
          method: semanticResult.result.method,
          confidence: semanticResult.result.confidence,
          success: true,
        });

        successCount++;

      } catch (error) {
        console.error(`Error processing guess ${semanticResult.id}:`, error);
        results.push({
          guess_pda: semanticResult.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        errorCount++;
      }
    }

    // Store creator billing record
    try {
      const { error: billingError } = await supabase
        .from("creator_validation_billing")
        .insert({
          creator_wallet,
          capsule_id,
          guesses_validated: guessAnswerPairs.length,
          validation_cost_usd: validationCost,
          processed_at: new Date().toISOString(),
          semantic_service_cost: validationCost,
          status: "completed",
        });

      if (billingError) {
        console.error("Failed to store billing record:", billingError);
        // Don't fail the request, just log the error
      }
    } catch (billingError) {
      console.error("Error storing billing record:", billingError);
    }

    res.json({
      success: true,
      data: {
        results,
        summary: {
          total_processed: validations.length,
          successful: successCount,
          failed: errorCount,
          validation_cost_usd: validationCost,
        },
      },
    } as ApiResponse);

  } catch (error: any) {
    console.error("Error processing batch validation:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    } as ApiResponse);
  }
});

export default router;
