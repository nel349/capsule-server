/// <reference types="node" />
import {
  getPendingReveals,
  updateRevealQueueStatus,
  updateCapsuleStatus,
} from "../utils/database";
import { TwitterTokenService } from "./twitterTokenService";
import { supabase } from "../utils/supabase";
import { SolanaService } from "./solana";
import { PublicKey } from "@solana/web3.js";
import { CAPSULEX_PROGRAM_CONFIG } from "../config/solana";
import * as anchor from "@coral-xyz/anchor";

export interface RevealQueueItem {
  queue_id: string;
  capsule_id: string;
  scheduled_for: string;
  attempts: number;
  max_attempts: number;
  status: "pending" | "processing" | "completed" | "failed";
  post_type: "capsule_reveal" | "social_post";
  post_content?: string; // For social posts, this contains the content to post
  user_id?: string; // For social posts, this contains the user_id directly
  capsules?: {
    capsule_id: string;
    user_id: string;
    content_encrypted: string;
    reveal_date: string;
    status: string;
    is_gamified: boolean;
    on_chain_tx: string;
  };
}

export interface RevealProcessingResult {
  success: boolean;
  error?: string;
  twitterPosted?: boolean;
  revealProcessed?: boolean;
  guessValidationTriggered?: boolean;
}

/**
 * Background Scheduler Service for Processing Capsule Readiness
 * Handles marking capsules as ready_to_reveal when their time arrives
 * Does NOT actually reveal capsules - that only happens via frontend transactions
 */
export class CapsuleReadinessScheduler {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;
  private static readonly PROCESSING_INTERVAL = 60 * 1000; // 1 minute
  private static readonly MAX_CONCURRENT_JOBS = 5;
  
  // Solana service for blockchain operations
  private static solanaService = new SolanaService(
    process.env.SOLANA_RPC_URL || CAPSULEX_PROGRAM_CONFIG.cluster,
    "confirmed"
  );

  /**
   * Derive Capsule PDA (matching useCapsulexProgram.ts logic)
   */
  private static deriveCapsulePDA(creator: PublicKey, revealDate: anchor.BN): PublicKey {
    const programId = new PublicKey(CAPSULEX_PROGRAM_CONFIG.programId);
    const [capsulePDA] = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode('capsule'),
        creator.toBuffer(),
        revealDate.toArrayLike(Buffer, 'le', 8), // i64 is 8 bytes, little-endian
      ],
      programId
    );
    return capsulePDA;
  }

  /**
   * Derive Game PDA from Capsule PDA (matching useCapsulexProgram.ts logic)
   */
  private static deriveGamePDA(capsulePDA: PublicKey): PublicKey {
    const programId = new PublicKey(CAPSULEX_PROGRAM_CONFIG.programId);
    const [gamePDA] = PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode('game'), capsulePDA.toBuffer()],
      programId
    );
    return gamePDA;
  }

  /**
   * Start the background scheduler
   */
  static start() {
    if (this.isRunning) {
      console.log("⚠️ Reveal scheduler is already running");
      return;
    }

    console.log("🚀 Starting reveal scheduler service...");
    this.isRunning = true;

    // Process immediately on start
    this.processRevealQueue();

    // Set up recurring processing
    this.intervalId = setInterval(() => {
      this.processRevealQueue();
    }, this.PROCESSING_INTERVAL);

    console.log(`✅ Reveal scheduler started (interval: ${this.PROCESSING_INTERVAL / 1000}s)`);
  }

  /**
   * Stop the background scheduler
   */
  static stop() {
    if (!this.isRunning) {
      console.log("⚠️ Reveal scheduler is not running");
      return;
    }

    console.log("🛑 Stopping reveal scheduler service...");

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log("✅ Reveal scheduler stopped");
  }

  /**
   * Check if the scheduler is running
   */
  static getStatus() {
    return {
      isRunning: this.isRunning,
      interval: this.PROCESSING_INTERVAL,
      maxConcurrentJobs: this.MAX_CONCURRENT_JOBS,
    };
  }

  /**
   * Main processing function - checks for pending reveals and processes them
   */
  private static async processRevealQueue() {
    try {
      const currentTime = new Date().toISOString();
      console.log(`🔍 Checking for pending reveals at server time: ${currentTime}`);

      const { data: pendingReveals, error } = await getPendingReveals(this.MAX_CONCURRENT_JOBS);

      if (error) {
        console.error("❌ Error fetching pending reveals:", error);
        return;
      }

      if (!pendingReveals || pendingReveals.length === 0) {
        console.log("✅ No pending capsules ready to reveal found");
        return;
      }

      console.log(`📋 Found ${pendingReveals.length} pending reveal(s):`);

      // Log timing details for debugging
      pendingReveals.forEach((reveal: RevealQueueItem) => {
        const scheduledTime = new Date(reveal.scheduled_for).toISOString();
        const timeDiff = new Date(currentTime).getTime() - new Date(scheduledTime).getTime();
        console.log(
          `  📅 Capsule ${reveal.capsule_id}: scheduled=${scheduledTime}, diff=${Math.round(timeDiff / 1000)}s`
        );
      });

      // Process each reveal concurrently (up to MAX_CONCURRENT_JOBS)
      const processingPromises = pendingReveals.map((reveal: RevealQueueItem) =>
        this.processReveal(reveal)
      );

      const results = await Promise.allSettled(processingPromises);

      // Log results
      const successful = results.filter(
        result => result.status === "fulfilled" && result.value.success
      ).length;
      const failed = results.length - successful;

      console.log(`📊 Processing completed: ${successful} successful, ${failed} failed`);
    } catch (error) {
      console.error("❌ Error in reveal queue processing:", error);
    }
  }

  /**
   * Process a single reveal item (capsule reveal or social post)
   */
  private static async processReveal(reveal: RevealQueueItem): Promise<RevealProcessingResult> {
    const { queue_id, capsule_id, post_type } = reveal;

    console.log(`🔄 Processing ${post_type} for ID: ${capsule_id}`);

    try {
      // Mark as processing
      await updateRevealQueueStatus(queue_id, {
        status: "processing",
        attempts: reveal.attempts + 1,
      });

      let result: RevealProcessingResult;

      if (post_type === "social_post") {
        // Handle social post
        result = await this.processSocialPost(reveal);
      } else {
        // Handle capsule readiness (default)
        result = await this.processCapsuleReadiness(reveal);
      }

      if (!result.success) {
        console.error(`❌ Failed to process ${post_type}: ${result.error}`);
        await this.handleRevealFailure(
          queue_id,
          reveal.attempts + 1,
          result.error || `Failed to process ${post_type}`
        );
        return result;
      }

      // Mark as completed
      await updateRevealQueueStatus(queue_id, {
        status: "completed",
        error_message: undefined,
      });

      console.log(`✅ ${post_type} processing completed for ID: ${capsule_id}`);
      return result;
    } catch (error) {
      console.error(`❌ Error processing ${post_type} ${capsule_id}:`, error);

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await this.handleRevealFailure(queue_id, reveal.attempts + 1, errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Process a capsule readiness (mark as ready_to_reveal when time arrives)
   * Does NOT actually reveal the capsule - that only happens via frontend transactions
   */
  private static async processCapsuleReadiness(
    reveal: RevealQueueItem
  ): Promise<RevealProcessingResult> {
    const { capsules: capsule } = reveal;

    if (!capsule) {
      return {
        success: false,
        error: "Capsule data not found for reveal",
      };
    }

    try {
      console.log(`⏰ Time arrived for capsule: ${capsule.capsule_id}`);

      // Step 1: Update capsule status to ready_to_reveal (NOT revealed!)
      // Actual revealing only happens when user clicks reveal in frontend
      const { error } = await updateCapsuleStatus(capsule.capsule_id, "ready_to_reveal");

      if (error) {
        return {
          success: false,
          error: `Failed to update capsule status to ready_to_reveal: ${error}`,
        };
      }

      console.log(`✅ Capsule ready to reveal: ${capsule.capsule_id}`);

      // Step 2: Check if this is a gamified capsule with pending guesses FROM BLOCKCHAIN
      let guessValidationTriggered = false;
      if (capsule.is_gamified) {
        console.log(`🎮 Checking for pending guesses on blockchain for gamified capsule: ${capsule.capsule_id}`);

        try {
          // Get creator wallet address from capsule data
          const { data: capsuleWithUser, error: userError } = await supabase
            .from("capsules")
            .select(`
              *,
              users!inner(wallet_address)
            `)
            .eq("capsule_id", capsule.capsule_id)
            .single();

          if (userError || !capsuleWithUser?.users?.wallet_address) {
            console.error(`❌ Error fetching capsule creator wallet: ${userError}`);
          } else {
            // Derive PDAs using the same logic as useCapsulexProgram.ts
            const creator = new PublicKey(capsuleWithUser.users.wallet_address);
            const revealDate = new anchor.BN(
              Math.floor(new Date(capsule.reveal_date).getTime() / 1000)
            );
            
            const capsulePDA = this.deriveCapsulePDA(creator, revealDate);
            const gamePDA = this.deriveGamePDA(capsulePDA);

            console.log(`🔍 Derived PDAs for semantic validation:`, {
              capsule_id: capsule.capsule_id,
              creator: creator.toBase58(),
              capsulePDA: capsulePDA.toBase58(),
              gamePDA: gamePDA.toBase58(),
            });

            // Initialize Solana service and get guesses from blockchain
            await this.solanaService.initializeProgramReadOnly();
            const allGuesses = await this.solanaService.getGuessesForGame(gamePDA);

            // Filter for guesses that need semantic validation (not yet marked as correct/incorrect)
            const pendingGuesses = allGuesses.filter(guess => 
              !guess.account.isCorrect // Not yet validated as correct
            );

            if (pendingGuesses.length > 0) {
              console.log(`📝 Found ${pendingGuesses.length} pending guesses for semantic validation on blockchain`);

              // Trigger semantic validation notification for the creator
              await this.triggerSemanticValidationNotification(capsule, pendingGuesses.length);
              guessValidationTriggered = true;
            } else {
              console.log(`✅ No pending guesses found on blockchain for gamified capsule: ${capsule.capsule_id}`);
            }
          }
        } catch (blockchainError) {
          console.error(`❌ Error fetching guesses from blockchain:`, blockchainError);
          // Continue with reveal process even if blockchain query fails
        }
      }

      // Step 3: Post reveal announcement to Twitter if user has connected account
      const twitterResult = await this.postRevealToTwitter(capsule);

      return {
        success: true,
        revealProcessed: true,
        twitterPosted: twitterResult.success,
        guessValidationTriggered,
      };
    } catch (error) {
      return {
        success: false,
        error: `Database error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Process a social media post
   */
  private static async processSocialPost(reveal: RevealQueueItem): Promise<RevealProcessingResult> {
    const { post_content, user_id } = reveal;

    if (!post_content || !user_id) {
      return {
        success: false,
        error: "Missing post content or user ID for social post",
      };
    }

    try {
      console.log(`📱 Posting social content for user: ${user_id}`);

      // Get fresh access token for the user
      const tokenResult = await TwitterTokenService.getFreshAccessToken(user_id);

      if (!tokenResult.success) {
        return {
          success: false,
          error: `Failed to get Twitter token: ${tokenResult.error}`,
        };
      }

      // Post directly to Twitter API
      const twitterResponse = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenResult.access_token}`,
        },
        body: JSON.stringify({
          text: post_content,
        }),
      });

      if (!twitterResponse.ok) {
        const errorData = (await twitterResponse.json()) as { detail?: string; error?: string };
        return {
          success: false,
          error: `Twitter API error: ${errorData.detail || errorData.error || twitterResponse.statusText}`,
        };
      }

      const tweetData = (await twitterResponse.json()) as { data?: { id: string } };
      console.log(`✅ Social post published for user ${user_id}:`, tweetData.data?.id);

      return {
        success: true,
        twitterPosted: true,
      };
    } catch (error) {
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Trigger semantic validation notification for the capsule creator
   * This sends a notification (push notification, email, or in-app) to the creator
   * informing them that their gamified capsule has been revealed and needs semantic validation
   */
  private static async triggerSemanticValidationNotification(
    capsule: {
      capsule_id: string;
      user_id: string;
      is_gamified: boolean;
    },
    pendingGuessCount: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(
        `📱 Triggering semantic validation notification for capsule: ${capsule.capsule_id}`
      );

      // For now, we'll create a special Twitter post to notify the creator
      // In the future, this could be push notifications, email, or in-app notifications
      const notificationContent = `🎮 Your time capsule game has been revealed! 

${pendingGuessCount} players submitted guesses. Open CapsuleX to validate guesses and determine winners.

⏰ You have 24 hours to complete validation.

#CapsuleXGaming #TimeReveal`;

      // Schedule this as a social post notification
      const scheduledFor = new Date(Date.now() + 60 * 1000).toISOString(); // 1 minute from now

      const { data, error } = await supabase
        .from("reveal_queue")
        .insert({
          scheduled_for: scheduledFor,
          status: "pending",
          attempts: 0,
          max_attempts: 3,
          post_type: "social_post",
          post_content: notificationContent,
          user_id: capsule.user_id,
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ Failed to schedule semantic validation notification:`, error);
        return {
          success: false,
          error: `Failed to schedule notification: ${error.message}`,
        };
      }

      console.log(`✅ Scheduled semantic validation notification for user ${capsule.user_id}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error triggering semantic validation notification:`, error);
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Post reveal announcement to Twitter
   */
  private static async postRevealToTwitter(capsule: {
    capsule_id: string;
    user_id: string;
    is_gamified: boolean;
    reveal_date: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🐦 Posting reveal to Twitter for capsule: ${capsule.capsule_id}`);

      // Check if user has Twitter connected
      const { data: connections, error: connectionsError } = await supabase
        .from("social_connections")
        .select("*")
        .eq("user_id", capsule.user_id)
        .eq("platform", "twitter")
        .eq("is_active", true);

      if (connectionsError || !connections || connections.length === 0) {
        console.log(`📝 No active Twitter connection for user ${capsule.user_id}, skipping post`);
        return {
          success: false,
          error: "No active Twitter connection",
        };
      }

      // Get fresh access token
      const tokenResult = await TwitterTokenService.getFreshAccessToken(capsule.user_id);

      if (!tokenResult.success) {
        console.log(
          `🔑 Failed to get Twitter token for user ${capsule.user_id}: ${tokenResult.error}`
        );
        return {
          success: false,
          error: tokenResult.error,
        };
      }

      // Create reveal announcement text
      const revealDate = new Date(capsule.reveal_date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const gameText = capsule.is_gamified
        ? " 🏆 Congratulations to all the guessing game participants!"
        : "";

      const tweetText = `🔓 My time capsule has been revealed! 

What was scheduled for ${revealDate} is now unlocked.${gameText}

#TimeCapsule #Revealed #Solana`;

      // Post tweet directly to Twitter API (instead of internal API call)
      try {
        const twitterResponse = await fetch("https://api.twitter.com/2/tweets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenResult.access_token}`,
          },
          body: JSON.stringify({
            text: tweetText,
          }),
        });

        if (!twitterResponse.ok) {
          const errorData = (await twitterResponse.json()) as { detail?: string; error?: string };
          console.error(`❌ Twitter API error:`, errorData);
          return {
            success: false,
            error: `Twitter API error: ${errorData.detail || errorData.error || twitterResponse.statusText}`,
          };
        }

        const tweetData = (await twitterResponse.json()) as { data?: { id: string } };
        console.log(
          `✅ Posted reveal to Twitter for capsule: ${capsule.capsule_id}`,
          tweetData.data?.id
        );
        return { success: true };
      } catch (fetchError) {
        console.error(`❌ Error calling Twitter API:`, fetchError);
        return {
          success: false,
          error: `Network error: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`,
        };
      }
    } catch (error) {
      console.error(`❌ Error posting to Twitter:`, error);
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Handle reveal processing failure
   */
  private static async handleRevealFailure(
    queue_id: string,
    currentAttempts: number,
    errorMessage: string
  ) {
    try {
      console.log(`⚠️ Reveal failure (attempt ${currentAttempts}): ${errorMessage}`);

      // Calculate next retry time (exponential backoff)
      const baseDelay = 5 * 60 * 1000; // 5 minutes
      const retryDelay = Math.min(
        baseDelay * Math.pow(2, currentAttempts - 1),
        60 * 60 * 1000 // Max 1 hour
      );
      const nextAttempt = new Date(Date.now() + retryDelay).toISOString();

      await updateRevealQueueStatus(queue_id, {
        status: currentAttempts >= 3 ? "failed" : "pending", // Max 3 attempts
        attempts: currentAttempts,
        next_attempt: nextAttempt,
        error_message: errorMessage,
      });

      if (currentAttempts >= 3) {
        console.log(`💥 Reveal permanently failed after ${currentAttempts} attempts`);
      } else {
        console.log(
          `🔄 Will retry in ${Math.round(retryDelay / 60000)} minutes (attempt ${currentAttempts + 1})`
        );
      }
    } catch (error) {
      console.error("❌ Error handling reveal failure:", error);
    }
  }

  /**
   * Manually trigger processing (for testing/debugging)
   */
  static async triggerProcessing() {
    console.log("🔧 Manually triggering reveal queue processing...");
    await this.processRevealQueue();
  }

  /**
   * Get processing statistics
   */
  static async getStats() {
    try {
      const { data: pending } = await supabase
        .from("reveal_queue")
        .select("count")
        .eq("status", "pending");

      const { data: processing } = await supabase
        .from("reveal_queue")
        .select("count")
        .eq("status", "processing");

      const { data: completed } = await supabase
        .from("reveal_queue")
        .select("count")
        .eq("status", "completed");

      const { data: failed } = await supabase
        .from("reveal_queue")
        .select("count")
        .eq("status", "failed");

      return {
        pending: pending?.[0]?.count || 0,
        processing: processing?.[0]?.count || 0,
        completed: completed?.[0]?.count || 0,
        failed: failed?.[0]?.count || 0,
        isRunning: this.isRunning,
      };
    } catch (error) {
      console.error("❌ Error getting stats:", error);
      return {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        isRunning: this.isRunning,
        error: "Failed to get stats",
      };
    }
  }
}
