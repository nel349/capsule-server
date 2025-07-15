import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getUserByWallet } from '../utils/database';
import { AuthenticatedRequest } from '../types';

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required',
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret) as any;

    // Get user from database
    const { data: user, error } = await getUserByWallet(decoded.wallet_address);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token or user not found',
      });
    }

    // Attach user to request
    req.user = {
      user_id: user.user_id,
      wallet_address: user.wallet_address,
      auth_type: user.auth_type,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
};

export const generateAuthToken = (user: {
  user_id: string;
  wallet_address: string;
  auth_type: string;
}) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign(
    {
      user_id: user.user_id,
      wallet_address: user.wallet_address,
      auth_type: user.auth_type,
    },
    jwtSecret,
    { expiresIn: '7d' } // Token expires in 7 days
  );
};
