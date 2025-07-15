import express from 'express';
import { createSocialConnection, getSocialConnections } from '../utils/database';
import { authenticateToken } from '../middleware/auth';
import { CreateSocialConnectionRequest, ApiResponse, AuthenticatedRequest } from '../types';

const router = express.Router();

// Connect social media account (requires authentication)
router.post('/connect', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      platform,
      platform_user_id,
      platform_username,
      access_token,
      refresh_token,
    }: CreateSocialConnectionRequest = req.body;

    if (!platform || !platform_user_id) {
      return res.status(400).json({
        success: false,
        error: 'platform and platform_user_id are required',
      } as ApiResponse);
    }

    const { data: connection, error } = await createSocialConnection({
      user_id: req.user!.user_id,
      platform,
      platform_user_id,
      platform_username,
      access_token,
      refresh_token,
    });

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.error,
      } as ApiResponse);
    }

    // Don't return sensitive tokens in response
    const safeConnection = {
      ...connection,
      access_token: connection?.access_token ? '[REDACTED]' : undefined,
      refresh_token: connection?.refresh_token ? '[REDACTED]' : undefined,
    };

    res.status(201).json({
      success: true,
      data: safeConnection,
    } as ApiResponse);
  } catch (error) {
    console.error('Connect social account error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// Get user's social connections (requires authentication)
router.get('/connections', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { data: connections, error } = await getSocialConnections(req.user!.user_id);

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.error,
      } as ApiResponse);
    }

    // Don't return sensitive tokens in response
    const safeConnections = (connections || []).map(connection => ({
      ...connection,
      access_token: connection.access_token ? '[REDACTED]' : undefined,
      refresh_token: connection.refresh_token ? '[REDACTED]' : undefined,
    }));

    res.json({
      success: true,
      data: safeConnections,
    } as ApiResponse);
  } catch (error) {
    console.error('Get social connections error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

export default router;
