import express from 'express';
import { createSocialConnection, getSocialConnections } from '../utils/database';
import { authenticateToken } from '../middleware/auth';
import { CreateSocialConnectionRequest, ApiResponse, AuthenticatedRequest } from '../types';
import axios from 'axios';

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

// Twitter OAuth 2.0 token exchange endpoint
router.post(
  '/twitter/exchange-token',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { code, codeVerifier, redirectUri } = req.body;

      if (!code || !codeVerifier || !redirectUri) {
        return res.status(400).json({
          success: false,
          error: 'code, codeVerifier, and redirectUri are required',
        } as ApiResponse);
      }

      console.log('🔄 Twitter token exchange - starting...');
      console.log('🔑 Using client ID:', process.env.CLIENT_ID?.substring(0, 10) + '...');

      // Exchange authorization code for access token with Twitter
      // Twitter OAuth 2.0 requires Basic Auth header with client credentials
      const credentials = Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString('base64');
      
      const tokenResponse = await axios.post(
        'https://api.twitter.com/2/oauth2/token',
        new URLSearchParams({
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`,
          },
        }
      );

      console.log('✅ Twitter token exchange successful');

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      // Get user information from Twitter
      const userResponse = await axios.get('https://api.twitter.com/2/users/me', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      const { id: platform_user_id, username, name } = userResponse.data.data;

      console.log('✅ Twitter user info retrieved:', username);

      // Store the connection in database
      const { error } = await createSocialConnection({
        user_id: req.user!.user_id,
        platform: 'twitter',
        platform_user_id,
        platform_username: username,
        access_token,
        refresh_token,
        expires_at: expires_in ? new Date(Date.now() + expires_in * 1000) : undefined,
      });

      if (error) {
        console.error('❌ Failed to save Twitter connection:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to save Twitter connection',
        } as ApiResponse);
      }

      console.log('✅ Twitter connection saved to database');

      // Return success with user info (no sensitive tokens)
      res.status(200).json({
        success: true,
        data: {
          user: {
            id: platform_user_id,
            username,
            name,
          },
          accessToken: '[STORED_SECURELY]',
          refreshToken: refresh_token ? '[STORED_SECURELY]' : undefined,
        },
      } as ApiResponse);
    } catch (error) {
      console.error('❌ Twitter token exchange error:', error);

      if (axios.isAxiosError(error)) {
        console.error('Twitter API error details:', {
          status: error.response?.status,
          data: error.response?.data,
        });

        return res.status(400).json({
          success: false,
          error: `Twitter OAuth error: ${error.response?.data?.error_description || error.message}`,
        } as ApiResponse);
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error during token exchange',
      } as ApiResponse);
    }
  }
);

export default router;
