import express from 'express';
import {
  createCapsule,
  getCapsulesByUser,
  getRevealedCapsules,
  updateCapsuleStatus,
} from '../utils/database';
import { authenticateToken } from '../middleware/auth';
import { CreateCapsuleRequest, ApiResponse, AuthenticatedRequest } from '../types';

const router = express.Router();

// Create new capsule (requires authentication)
router.post('/create', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      content_encrypted,
      content_hash,
      has_media = false,
      media_urls = [],
      reveal_date,
      on_chain_tx,
      sol_fee_amount,
    }: CreateCapsuleRequest = req.body;

    if (!content_encrypted || !content_hash || !reveal_date || !on_chain_tx) {
      return res.status(400).json({
        success: false,
        error: 'content_encrypted, content_hash, reveal_date, and on_chain_tx are required',
      } as ApiResponse);
    }

    // Validate reveal_date is in the future
    const revealDateTime = new Date(reveal_date);
    if (revealDateTime <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'reveal_date must be in the future',
      } as ApiResponse);
    }

    const { data: capsule, error } = await createCapsule({
      user_id: req.user!.user_id,
      content_encrypted,
      content_hash,
      has_media,
      media_urls,
      reveal_date,
      on_chain_tx,
      sol_fee_amount,
    });

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.error,
      } as ApiResponse);
    }

    res.status(201).json({
      success: true,
      data: capsule,
    } as ApiResponse);
  } catch (error) {
    console.error('Create capsule error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// Get user's capsules (requires authentication)
router.get('/my-capsules', authenticateToken, async (req: AuthenticatedRequest, res) => {
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
    console.error('Get user capsules error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// Get revealed capsules (public, no auth required)
router.get('/revealed', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const { data: capsules, error } = await getRevealedCapsules(limit);

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
    console.error('Get revealed capsules error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// Update capsule status (for reveals and social posting)
router.patch('/:capsule_id/status', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { capsule_id } = req.params;
    const { status, revealed_at, social_post_id, posted_to_social } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'status is required',
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
        error: 'Capsule not found',
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: capsule,
    } as ApiResponse);
  } catch (error) {
    console.error('Update capsule status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

export default router;
