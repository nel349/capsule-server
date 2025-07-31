import express from "express";
import {
  createCapsule,
  getCapsulesByUser,
  updateCapsuleStatus,
  addToRevealQueue,
} from "../utils/database";
import { authenticateToken } from "../middleware/auth";
import { CreateCapsuleRequest, ApiResponse, AuthenticatedRequest } from "../types";
import { SolanaService } from "../services/solana";
import { Keypair, PublicKey } from "@solana/web3.js";
import { CAPSULEX_PROGRAM_CONFIG } from "../config/solana";

const router = express.Router();

// Initialize SolanaService using the cluster from config
const solanaService = new SolanaService(
  process.env.SOLANA_RPC_URL || CAPSULEX_PROGRAM_CONFIG.cluster,
  "confirmed"
);

// Create new capsule (requires authentication)
router.post("/create", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      content_encrypted,
      content_hash,
      has_media = false,
      media_urls = [],
      reveal_date,
      on_chain_tx,
      sol_fee_amount,
      is_gamified = false,
      test_mode = false, // Add test mode flag
    }: CreateCapsuleRequest & { is_gamified?: boolean; test_mode?: boolean } = req.body;

    if (!content_encrypted || !content_hash || !reveal_date) {
      return res.status(400).json({
        success: false,
        error: "content_encrypted, content_hash, and reveal_date are required",
      } as ApiResponse);
    }

    // Validate reveal_date is in the future
    const revealDateTime = new Date(reveal_date);
    if (revealDateTime <= new Date()) {
      return res.status(400).json({
        success: false,
        error: "reveal_date must be in the future",
      } as ApiResponse);
    }

    const onChainTx = on_chain_tx;
    const solFeeAmount = sol_fee_amount;

    // Test Solana integration if test_mode is enabled
    // if (test_mode) {
    //   try {
    //     console.log("🔧 Testing Solana integration...");

    //     // Create a test keypair (in production, you'd use a proper wallet)
    //     const testKeypair = Keypair.generate();

    //     // Initialize the program with the wallet (IDL already loaded in constructor)
    //     await solanaService.initializeProgram(testKeypair);

    //     // Test 1: Initialize program vault (only needed once)
    //     console.log("1️⃣ Testing initializeProgramVault...");
    //     try {
    //       const vaultTx = await solanaService.initializeProgramVault(testKeypair);
    //       console.log("✅ Program vault initialized:", vaultTx);
    //       console.log(
    //         "🔗 View transaction: https://explorer.solana.com/tx/" +
    //           vaultTx +
    //           "?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899"
    //       );
    //     } catch (error: any) {
    //       if (
    //         error.message?.includes("already in use") ||
    //         error.message?.includes("Already initialized")
    //       ) {
    //         console.log("✅ Program vault already initialized");
    //       } else {
    //         console.log("⚠️ Vault initialization failed:", error.message);
    //       }
    //     }

    //     // Test 2: Create capsule on-chain
    //     console.log("2️⃣ Testing createCapsule...");
    //     const capsuleTx = await solanaService.createCapsule({
    //       content: content_encrypted, // In production, use decrypted content
    //       contentHash: content_hash,
    //       revealDate: revealDateTime,
    //       payer: testKeypair,
    //       isGamified: is_gamified,
    //     });

    //     console.log("✅ Capsule created on-chain:", capsuleTx);
    //     console.log(
    //       "🔗 View transaction: https://explorer.solana.com/tx/" +
    //         capsuleTx +
    //         "?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899"
    //     );
    //     onChainTx = capsuleTx;
    //     solFeeAmount = 0.001; // Example fee

    //     // Test 3: Get capsule data
    //     console.log("3️⃣ Testing getCapsuleData...");
    //     const revealDateBN = solanaService.dateToBN(revealDateTime);
    //     const capsuleData = await solanaService.getCapsuleData(testKeypair.publicKey, revealDateBN);
    //     console.log("✅ Capsule data retrieved:", capsuleData);
    //   } catch (solanaError: any) {
    //     console.error("❌ Solana integration test failed:", solanaError);
    //     return res.status(500).json({
    //       success: false,
    //       error: `Solana integration failed: ${solanaError.message}`,
    //       details: solanaError,
    //     } as ApiResponse);
    //   }
    // }

    // Save to database
    const { data: capsule, error } = await createCapsule({
      user_id: req.user!.user_id,
      content_encrypted,
      content_hash,
      has_media,
      media_urls,
      reveal_date,
      on_chain_tx: onChainTx,
      sol_fee_amount: solFeeAmount,
      is_gamified,
    });

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.error,
      } as ApiResponse);
    }

    // Add capsule to reveal queue for automated processing
    if (capsule) {
      try {
        console.log(`📅 Adding capsule ${capsule.capsule_id} to reveal queue for ${reveal_date}`);

        const { error: queueError } = await addToRevealQueue(capsule.capsule_id, reveal_date);

        if (queueError) {
          console.error("⚠️ Failed to add capsule to reveal queue:", queueError);
          // Don't fail the whole request, just log the error
        } else {
          console.log(`✅ Capsule ${capsule.capsule_id} added to reveal queue successfully`);
        }
      } catch (queueError) {
        console.error("⚠️ Error adding capsule to reveal queue:", queueError);
        // Don't fail the whole request, just log the error
      }
    }

    res.status(201).json({
      success: true,
      data: capsule,
      solana_test: test_mode ? "completed" : "skipped",
    } as ApiResponse);
  } catch (error) {
    console.error("Create capsule error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    } as ApiResponse);
  }
});

// Get user's capsules (requires authentication)
router.get("/my-capsules", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { data: capsules, error } = await getCapsulesByUser(req.user!.user_id);

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.error,
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: capsules || [],
    } as ApiResponse);
  } catch (error) {
    console.error("Get user capsules error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    } as ApiResponse);
  }
});

// Get revealed capsules (public, no auth required)
router.get("/revealed", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    // Initialize with a dummy keypair for read-only operations
    const dummyKeypair = Keypair.generate();
    await solanaService.initializeProgram(dummyKeypair);

    // Get all revealed capsules from blockchain
    const program = solanaService.getProgram();
    const allCapsules = await program.account.capsule.all();

    // Filter for revealed capsules and take the requested limit
    const revealedCapsules = allCapsules
      .filter((capsule: any) => capsule.account.isRevealed === true)
      .slice(0, limit)
      .map((capsule: any) => ({
        id: capsule.publicKey.toString(),
        content: capsule.account.encryptedContent,
        content_hash: capsule.account.contentIntegrityHash,
        reveal_date_timestamp: capsule.account.revealDate.toNumber(),
        revealed_at_timestamp: capsule.account.revealDate.toNumber(), // Use reveal date as revealed timestamp
        creator: capsule.account.creator.toString(),
        creator_display_name: null, // TODO: Get from database if needed
        twitter_username: null, // TODO: Get from database if needed
        is_public: true,
        is_game: capsule.account.isGamified,
        revealed: true, // All filtered capsules are revealed
        on_chain_id: capsule.publicKey.toString(),
      }));

    res.json({
      success: true,
      data: revealedCapsules,
    } as ApiResponse);
  } catch (error) {
    console.error("Get revealed capsules error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    } as ApiResponse);
  }
});

// Update capsule status (for reveals and social posting)
router.patch("/:capsule_id/status", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { capsule_id } = req.params;
    const { status, revealed_at, social_post_id, posted_to_social } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "status is required",
      } as ApiResponse);
    }

    const additionalData: any = {};
    if (revealed_at) additionalData.revealed_at = revealed_at;
    if (social_post_id) additionalData.social_post_id = social_post_id;
    if (posted_to_social !== undefined) additionalData.posted_to_social = posted_to_social;

    const { data: capsule, error } = await updateCapsuleStatus(capsule_id, status, additionalData);

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.error,
      } as ApiResponse);
    }

    if (!capsule) {
      return res.status(404).json({
        success: false,
        error: "Capsule not found",
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: capsule,
    } as ApiResponse);
  } catch (error) {
    console.error("Update capsule status error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    } as ApiResponse);
  }
});

// Get all capsules owned by a wallet address (on-chain data)
router.get("/wallet/:address", async (req, res) => {
  try {
    const { address } = req.params;

    // Validate wallet address
    if (!solanaService.isValidPublicKey(address)) {
      return res.status(400).json({
        success: false,
        error: "Invalid wallet address format",
      } as ApiResponse);
    }

    // Initialize with a dummy keypair for read-only operations
    const dummyKeypair = Keypair.generate();
    await solanaService.initializeProgram(dummyKeypair);

    // Fetch capsules from on-chain
    const capsules = await solanaService.getCapsulesByOwner(new PublicKey(address));

    // Group capsules by status for easy frontend consumption
    const grouped = {
      pending: capsules.filter(c => c.status === "pending"),
      ready_to_reveal: capsules.filter(c => c.status === "ready_to_reveal"),
      revealed: capsules.filter(c => c.status === "revealed"),
    };

    res.json({
      success: true,
      data: {
        wallet_address: address,
        total_capsules: capsules.length,
        summary: {
          pending: grouped.pending.length,
          ready_to_reveal: grouped.ready_to_reveal.length,
          revealed: grouped.revealed.length,
        },
        capsules: grouped,
        all_capsules: capsules, // Flat list for easier iteration
      },
    } as ApiResponse);
  } catch (error) {
    console.error("Get capsules by wallet error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    } as ApiResponse);
  }
});

// Get capsules ready for reveal (can be filtered by wallet)
router.get("/ready-to-reveal", async (req, res) => {
  try {
    const { wallet } = req.query;

    // Validate wallet address if provided
    let ownerPublicKey: PublicKey | undefined;
    if (wallet) {
      if (!solanaService.isValidPublicKey(wallet as string)) {
        return res.status(400).json({
          success: false,
          error: "Invalid wallet address format",
        } as ApiResponse);
      }
      ownerPublicKey = new PublicKey(wallet as string);
    }

    // Initialize with a dummy keypair for read-only operations
    const dummyKeypair = Keypair.generate();
    await solanaService.initializeProgram(dummyKeypair);

    // Fetch revealable capsules
    const revealableCapsules = await solanaService.getRevealableCapsules(ownerPublicKey);

    res.json({
      success: true,
      data: {
        total_ready: revealableCapsules.length,
        wallet_filter: wallet || "all",
        capsules: revealableCapsules,
      },
    } as ApiResponse);
  } catch (error) {
    console.error("Check reveals error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    } as ApiResponse);
  }
});

// Get single capsule by ID (public endpoint for Blinks)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Capsule ID is required",
      } as ApiResponse);
    }

    // Query capsule from database using supabase client
    const { supabase } = await import("../utils/supabase");
    const { data: capsule, error } = await supabase
      .from("capsules")
      .select("*, users(wallet_address)") // Join with users table
      .eq("capsule_id", id)
      .single();

    // Remove the separate query for creator_data
    // const { data: creator_data, error: creatorError } = await supabase
    //   .from("users")
    //   .select("wallet_address, user_id")
    //   .eq("user_id", capsule?.user_id)
    //   .single();

    if (error) {
      console.error("Database error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch capsule",
      } as ApiResponse);
    }

    if (!capsule) {
      return res.status(404).json({
        success: false,
        error: "Capsule not found",
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: capsule,
    } as ApiResponse);
  } catch (error) {
    console.error("Get capsule by ID error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    } as ApiResponse);
  }
});

export default router;
