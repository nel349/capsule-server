import { Request } from "express";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CreateUserRequest {
  wallet_address: string;
  auth_type: "privy" | "wallet";
  privy_user_id?: string;
  email?: string;
  name?: string;
}

export interface CreateCapsuleRequest {
  content_encrypted: string;
  content_hash: string;
  has_media?: boolean;
  media_urls?: string[];
  reveal_date: string; // ISO string
  created_at?: string; // Frontend timestamp for consistency
  on_chain_tx: string;
  sol_fee_amount?: number;
}

export interface CreateSocialConnectionRequest {
  platform: "twitter" | "farcaster" | "instagram" | "tiktok";
  platform_user_id: string;
  platform_username?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: Date;
}

export interface CreateSOLTransactionRequest {
  transaction_type: "onramp" | "capsule_fee" | "refund";
  sol_amount: number;
  usd_amount?: number;
  moonpay_transaction_id?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    user_id: string;
    wallet_address: string;
    auth_type: "privy" | "wallet";
  };
}
