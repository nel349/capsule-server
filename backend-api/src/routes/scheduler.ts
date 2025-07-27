import express from "express";
import { authenticateToken } from "../middleware/auth";
import { ApiResponse, AuthenticatedRequest } from "../types";
import { RevealSchedulerService } from "../services/revealSchedulerService";
import {
  getPendingReveals,
  getFailedReveals,
  retryFailedReveal,
  addToRevealQueue,
} from "../utils/database";

const router = express.Router();

// Get scheduler status (requires authentication)
router.get("/status", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const status = RevealSchedulerService.getStatus();
    const stats = await RevealSchedulerService.getStats();

    res.json({
      success: true,
      data: {
        ...status,
        stats,
      },
    } as ApiResponse);
  } catch (error) {
    console.error("❌ Error getting scheduler status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get scheduler status",
    } as ApiResponse);
  }
});

// Start the scheduler (requires authentication)
router.post("/start", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    RevealSchedulerService.start();

    res.json({
      success: true,
      data: {
        message: "Reveal scheduler started successfully",
        status: RevealSchedulerService.getStatus(),
      },
    } as ApiResponse);
  } catch (error) {
    console.error("❌ Error starting scheduler:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start scheduler",
    } as ApiResponse);
  }
});

// Stop the scheduler (requires authentication)
router.post("/stop", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    RevealSchedulerService.stop();

    res.json({
      success: true,
      data: {
        message: "Reveal scheduler stopped successfully",
        status: RevealSchedulerService.getStatus(),
      },
    } as ApiResponse);
  } catch (error) {
    console.error("❌ Error stopping scheduler:", error);
    res.status(500).json({
      success: false,
      error: "Failed to stop scheduler",
    } as ApiResponse);
  }
});

// Manually trigger processing (requires authentication)
router.post("/trigger", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await RevealSchedulerService.triggerProcessing();

    res.json({
      success: true,
      data: {
        message: "Reveal queue processing triggered manually",
      },
    } as ApiResponse);
  } catch (error) {
    console.error("❌ Error triggering processing:", error);
    res.status(500).json({
      success: false,
      error: "Failed to trigger processing",
    } as ApiResponse);
  }
});

// Get pending reveals (requires authentication)
router.get("/pending", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const { data: pendingReveals, error } = await getPendingReveals(limit);

    if (error) {
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve pending reveals",
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: {
        reveals: pendingReveals || [],
        count: pendingReveals?.length || 0,
      },
    } as ApiResponse);
  } catch (error) {
    console.error("❌ Error getting pending reveals:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get pending reveals",
    } as ApiResponse);
  }
});

// Get failed reveals (requires authentication)
router.get("/failed", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const { data: failedReveals, error } = await getFailedReveals(limit);

    if (error) {
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve failed reveals",
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: {
        reveals: failedReveals || [],
        count: failedReveals?.length || 0,
      },
    } as ApiResponse);
  } catch (error) {
    console.error("❌ Error getting failed reveals:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get failed reveals",
    } as ApiResponse);
  }
});

// Retry a failed reveal (requires authentication)
router.post("/retry/:queue_id", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { queue_id } = req.params;

    if (!queue_id) {
      return res.status(400).json({
        success: false,
        error: "Queue ID is required",
      } as ApiResponse);
    }

    const { data, error } = await retryFailedReveal(queue_id);

    if (error) {
      return res.status(500).json({
        success: false,
        error: "Failed to retry reveal",
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: {
        message: "Reveal queued for retry",
        reveal: data,
      },
    } as ApiResponse);
  } catch (error) {
    console.error("❌ Error retrying reveal:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retry reveal",
    } as ApiResponse);
  }
});

// Add capsule to reveal queue manually (requires authentication)
router.post("/queue", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { capsule_id, scheduled_for } = req.body;

    if (!capsule_id || !scheduled_for) {
      return res.status(400).json({
        success: false,
        error: "capsule_id and scheduled_for are required",
      } as ApiResponse);
    }

    // Validate date format
    const scheduledDate = new Date(scheduled_for);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid date format for scheduled_for",
      } as ApiResponse);
    }

    const { data, error } = await addToRevealQueue(capsule_id, scheduled_for);

    if (error) {
      return res.status(500).json({
        success: false,
        error: "Failed to add capsule to reveal queue",
      } as ApiResponse);
    }

    res.status(201).json({
      success: true,
      data: {
        message: "Capsule added to reveal queue successfully",
        queue_item: data,
      },
    } as ApiResponse);
  } catch (error) {
    console.error("❌ Error adding to reveal queue:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add to reveal queue",
    } as ApiResponse);
  }
});

export default router;
