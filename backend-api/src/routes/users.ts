import express from 'express';
import { createUser, getUserByWallet, getUserByPrivyId } from '../utils/database';
import { generateAuthToken } from '../middleware/auth';
import { CreateUserRequest, ApiResponse } from '../types';

const router = express.Router();

// Create or authenticate user
router.post('/auth', async (req, res) => {
  try {
    const { wallet_address, auth_type, privy_user_id, email, name }: CreateUserRequest = req.body;

    if (!wallet_address || !auth_type) {
      return res.status(400).json({
        success: false,
        error: 'wallet_address and auth_type are required',
      } as ApiResponse);
    }

    // Check if user already exists
    let existingUser = null;

    if (auth_type === 'wallet') {
      const { data } = await getUserByWallet(wallet_address);
      existingUser = data;
    } else if (auth_type === 'privy' && privy_user_id) {
      const { data } = await getUserByPrivyId(privy_user_id);
      existingUser = data;
    }

    let user = existingUser;

    // Create user if doesn't exist
    if (!existingUser) {
      const { data, error } = await createUser({
        wallet_address,
        auth_type,
        privy_user_id,
        email,
        name,
      });

      if (error) {
        return res.status(500).json({
          success: false,
          error: error.error,
        } as ApiResponse);
      }

      user = data;
    }

    if (!user) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create or retrieve user',
      } as ApiResponse);
    }

    // Generate auth token
    const token = generateAuthToken({
      user_id: user.user_id,
      wallet_address: user.wallet_address,
      auth_type: user.auth_type,
    });

    res.json({
      success: true,
      data: {
        user: {
          user_id: user.user_id,
          wallet_address: user.wallet_address,
          auth_type: user.auth_type,
          email: user.email,
          name: user.name,
          created_at: user.created_at,
        },
        token,
      },
    } as ApiResponse);
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// Get user profile
router.get('/profile/:wallet_address', async (req, res) => {
  try {
    const { wallet_address } = req.params;
    const { data: user, error } = await getUserByWallet(wallet_address);

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.error,
      } as ApiResponse);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: {
        user_id: user.user_id,
        wallet_address: user.wallet_address,
        auth_type: user.auth_type,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
      },
    } as ApiResponse);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

export default router;
