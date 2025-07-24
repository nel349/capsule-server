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
      wallet_address: capsuleData.users?.wallet_address 
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
        program_id: CAPSULEX_PROGRAM_CONFIG.programId
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

export default router;
