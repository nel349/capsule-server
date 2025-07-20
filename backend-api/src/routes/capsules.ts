import express from 'express';
import {
  createCapsule,
  getCapsulesByUser,
  getRevealedCapsules,
  updateCapsuleStatus,
} from '../utils/database';
import { authenticateToken } from '../middleware/auth';
import { CreateCapsuleRequest, ApiResponse, AuthenticatedRequest } from '../types';
import { SolanaService } from '../services/solana';
import { Keypair } from '@solana/web3.js';

const router = express.Router();

// Initialize SolanaService (it will handle IDL loading internally)
const solanaService = new SolanaService(
  process.env.SOLANA_RPC_URL || 'http://localhost:8899', // Use local by default
  'confirmed'
);

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
      is_gamified = false,
      test_mode = false, // Add test mode flag
    }: CreateCapsuleRequest & { is_gamified?: boolean; test_mode?: boolean } = req.body;

    if (!content_encrypted || !content_hash || !reveal_date) {
      return res.status(400).json({
        success: false,
        error: 'content_encrypted, content_hash, and reveal_date are required',
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

    let onChainTx = on_chain_tx;
    let solFeeAmount = sol_fee_amount;

    // Test Solana integration if test_mode is enabled
    if (test_mode) {
      try {
        console.log('🔧 Testing Solana integration...');

        // Create a test keypair (in production, you'd use a proper wallet)
        const testKeypair = Keypair.generate();

        // Initialize the program with the wallet (IDL already loaded in constructor)
        await solanaService.initializeProgram(testKeypair);

        // Test 1: Initialize program vault (only needed once)
        console.log('1️⃣ Testing initializeProgramVault...');
        try {
          const vaultTx = await solanaService.initializeProgramVault(testKeypair);
          console.log('✅ Program vault initialized:', vaultTx);
          console.log(
            '🔗 View transaction: https://explorer.solana.com/tx/' +
              vaultTx +
              '?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899'
          );
        } catch (error: any) {
          if (
            error.message?.includes('already in use') ||
            error.message?.includes('Already initialized')
          ) {
            console.log('✅ Program vault already initialized');
          } else {
            console.log('⚠️ Vault initialization failed:', error.message);
          }
        }

        // Test 2: Create capsule on-chain
        console.log('2️⃣ Testing createCapsule...');
        const capsuleTx = await solanaService.createCapsule({
          content: content_encrypted, // In production, use decrypted content
          contentHash: content_hash,
          revealDate: revealDateTime,
          payer: testKeypair,
          isGamified: is_gamified,
        });

        console.log('✅ Capsule created on-chain:', capsuleTx);
        console.log(
          '🔗 View transaction: https://explorer.solana.com/tx/' +
            capsuleTx +
            '?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899'
        );
        onChainTx = capsuleTx;
        solFeeAmount = 0.001; // Example fee

        // Test 3: Get capsule data
        console.log('3️⃣ Testing getCapsuleData...');
        const revealDateBN = solanaService.dateToBN(revealDateTime);
        const capsuleData = await solanaService.getCapsuleData(testKeypair.publicKey, revealDateBN);
        console.log('✅ Capsule data retrieved:', capsuleData);
      } catch (solanaError: any) {
        console.error('❌ Solana integration test failed:', solanaError);
        return res.status(500).json({
          success: false,
          error: `Solana integration failed: ${solanaError.message}`,
          details: solanaError,
        } as ApiResponse);
      }
    }

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
      solana_test: test_mode ? 'completed' : 'skipped',
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
