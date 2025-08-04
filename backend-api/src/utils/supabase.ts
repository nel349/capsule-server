import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing required Supabase environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
  );
}

// Create Supabase client with service role for backend operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: "public",
  },
});

// Database response types
export interface DatabaseError {
  code: string;
  message: string;
  details?: string;
  hint?: string;
}

export interface DatabaseUser {
  user_id: string;
  wallet_address: string;
  auth_type: "privy" | "wallet";
  privy_user_id?: string;
  email?: string;
  name?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSocialConnection {
  connection_id: string;
  user_id: string;
  platform: "twitter" | "farcaster" | "instagram" | "tiktok";
  platform_user_id: string;
  platform_username?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  is_active: boolean;
  connected_at: string;
}

export interface DatabaseCapsule {
  capsule_id: string;
  user_id: string;
  content_encrypted: string;
  content_hash: string;
  has_media: boolean;
  media_urls?: string[];
  reveal_date: string | null;
  reveal_tx_signature?: string;
  posted_to_social: boolean;
  social_post_id?: string;
  social_platform: string;
  on_chain_tx: string;
  sol_fee_amount: number;
  can_edit: boolean;
  is_gamified: boolean;
  created_at: string;
  status: "pending" | "ready_to_reveal" | "revealed" | "posted" | "failed" | "cancelled";
  // Encryption metadata fields
  encryption_version?: string; // '2.0' for new unified encryption
  encryption_platform?: "android" | "ios";
  encryption_key_id?: string; // For iOS vault key
  encryption_seed_name?: string; // For Android seed vault
  encryption_derivation_path?: string; // For Android seed vault
}

export interface DatabaseSOLTransaction {
  transaction_id: string;
  user_id: string;
  transaction_type: "onramp" | "capsule_fee" | "refund";
  sol_amount: number;
  usd_amount?: number;
  solana_tx_signature?: string;
  moonpay_transaction_id?: string;
  moonpay_status?: string;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
  completed_at?: string;
}

// Test database connectivity
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from("users").select("user_id").limit(1);

    return !error;
  } catch (error) {
    console.error("Database connection test failed:", error);
    return false;
  }
};

// Utility function for handling database errors
export const handleDatabaseError = (error: any): { error: string; code?: string } => {
  if (error?.code && error?.message) {
    // Supabase/PostgreSQL error
    return {
      error: error.message,
      code: error.code,
    };
  }

  // Generic error
  return {
    error: error?.message || "Database operation failed",
  };
};
