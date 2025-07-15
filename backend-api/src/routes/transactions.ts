import express from 'express';
import { createSOLTransaction, getSOLTransactions, updateSOLTransaction } from '../utils/database';
import { authenticateToken } from '../middleware/auth';
import { CreateSOLTransactionRequest, ApiResponse, AuthenticatedRequest } from '../types';

const router = express.Router();

// Create SOL transaction (requires authentication)
router.post('/create', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      transaction_type,
      sol_amount,
      usd_amount,
      moonpay_transaction_id,
    }: CreateSOLTransactionRequest = req.body;

    if (!transaction_type || !sol_amount) {
      return res.status(400).json({
        success: false,
        error: 'transaction_type and sol_amount are required',
      } as ApiResponse);
    }

    if (sol_amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'sol_amount must be greater than 0',
      } as ApiResponse);
    }

    const { data: transaction, error } = await createSOLTransaction({
      user_id: req.user!.user_id,
      transaction_type,
      sol_amount,
      usd_amount,
      moonpay_transaction_id,
    });

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.error,
      } as ApiResponse);
    }

    res.status(201).json({
      success: true,
      data: transaction,
    } as ApiResponse);
  } catch (error) {
    console.error('Create SOL transaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// Get user's SOL transactions (requires authentication)
router.get('/my-transactions', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { data: transactions, error } = await getSOLTransactions(req.user!.user_id);

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.error,
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: transactions || [],
    } as ApiResponse);
  } catch (error) {
    console.error('Get SOL transactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// Update transaction status (for processing webhooks)
router.patch(
  '/:transaction_id/status',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { transaction_id } = req.params;
      const { status, solana_tx_signature, moonpay_status, completed_at } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          error: 'status is required',
        } as ApiResponse);
      }

      const updateData: any = { status };
      if (solana_tx_signature) updateData.solana_tx_signature = solana_tx_signature;
      if (moonpay_status) updateData.moonpay_status = moonpay_status;
      if (completed_at) updateData.completed_at = completed_at;

      const { data: transaction, error } = await updateSOLTransaction(transaction_id, updateData);

      if (error) {
        return res.status(500).json({
          success: false,
          error: error.error,
        } as ApiResponse);
      }

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found',
        } as ApiResponse);
      }

      res.json({
        success: true,
        data: transaction,
      } as ApiResponse);
    } catch (error) {
      console.error('Update transaction status error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      } as ApiResponse);
    }
  }
);

export default router;
