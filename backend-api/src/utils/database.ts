import {
  supabase,
  DatabaseUser,
  DatabaseCapsule,
  DatabaseSocialConnection,
  DatabaseSOLTransaction,
  handleDatabaseError,
} from "./supabase";
import { v4 as uuidv4 } from "uuid";

// User operations
export const createUser = async (userData: {
  wallet_address: string;
  auth_type: "privy" | "wallet";
  privy_user_id?: string;
  email?: string;
  name?: string;
}): Promise<{ data: DatabaseUser | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from("users")
      .insert({
        user_id: uuidv4(),
        ...userData,
      })
      .select()
      .single();

    return { data, error: error ? handleDatabaseError(error) : null };
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};

export const getUserByWallet = async (
  wallet_address: string
): Promise<{ data: DatabaseUser | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", wallet_address)
      .single();

    return { data, error: error ? handleDatabaseError(error) : null };
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};

export const getUserByPrivyId = async (
  privy_user_id: string
): Promise<{ data: DatabaseUser | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("privy_user_id", privy_user_id)
      .single();

    return { data, error: error ? handleDatabaseError(error) : null };
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};

// Capsule operations
export const createCapsule = async (capsuleData: {
  user_id: string;
  content_encrypted: string;
  content_hash: string;
  has_media?: boolean;
  media_urls?: string[];
  reveal_date: string;
  created_at?: string; // Frontend timestamp for consistency
  on_chain_tx: string;
  sol_fee_amount?: number;
  is_gamified?: boolean;
}): Promise<{ data: DatabaseCapsule | null; error: any }> => {
  try {
    const insertData = {
      capsule_id: uuidv4(),
      sol_fee_amount: capsuleData.sol_fee_amount ?? 0.00005, // Default SOL fee
      is_gamified: capsuleData.is_gamified ?? false, // Default to non-gamified
      created_at: capsuleData.created_at, // Use frontend timestamp instead of DEFAULT NOW()
      ...capsuleData,
    };

    const { data, error } = await supabase.from("capsules").insert(insertData).select().single();

    return { data, error: error ? handleDatabaseError(error) : null };
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};

export const getCapsuleById = async (
  capsule_id: string
): Promise<{ data: DatabaseCapsule | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from("capsules")
      .select("*")
      .eq("capsule_id", capsule_id)
      .single();

    return { data, error: error ? handleDatabaseError(error) : null };
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};

export const getCapsulesByUser = async (
  user_id: string
): Promise<{ data: DatabaseCapsule[] | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from("capsules")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false });

    return { data, error: error ? handleDatabaseError(error) : null };
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};

export const getRevealedCapsules = async (
  limit = 50
): Promise<{ data: DatabaseCapsule[] | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from("capsules")
      .select("*")
      .in("status", ["revealed", "posted"])
      .not("revealed_at", "is", null)
      .order("revealed_at", { ascending: false })
      .limit(limit);

    return { data, error: error ? handleDatabaseError(error) : null };
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};

export const updateCapsuleStatus = async (
  capsule_id: string,
  status: "pending" | "ready_to_reveal" | "revealed" | "posted" | "failed" | "cancelled",
  additionalData?: { revealed_at?: string; reveal_tx_signature?: string; social_post_id?: string; posted_to_social?: boolean }
): Promise<{ data: DatabaseCapsule | null; error: any }> => {
  try {
    const updateData = { status, ...additionalData };

    const { data, error } = await supabase
      .from("capsules")
      .update(updateData)
      .eq("capsule_id", capsule_id)
      .select()
      .single();

    return { data, error: error ? handleDatabaseError(error) : null };
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};

// Social connection operations
export const createSocialConnection = async (connectionData: {
  user_id: string;
  platform: "twitter" | "farcaster" | "instagram" | "tiktok";
  platform_user_id: string;
  platform_username?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: Date;
}): Promise<{ data: DatabaseSocialConnection | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from("social_connections")
      .insert({
        connection_id: uuidv4(),
        ...connectionData,
      })
      .select()
      .single();

    return { data, error: error ? handleDatabaseError(error) : null };
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};

export const upsertSocialConnection = async (connectionData: {
  user_id: string;
  platform: "twitter" | "farcaster" | "instagram" | "tiktok";
  platform_user_id: string;
  platform_username?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: Date;
}): Promise<{ data: DatabaseSocialConnection | null; error: any }> => {
  try {
    // First, try to find existing connection
    const { data: existingConnection } = await supabase
      .from("social_connections")
      .select("*")
      .eq("user_id", connectionData.user_id)
      .eq("platform", connectionData.platform)
      .single();

    if (existingConnection) {
      // Update existing connection
      const { data, error } = await supabase
        .from("social_connections")
        .update({
          platform_user_id: connectionData.platform_user_id,
          platform_username: connectionData.platform_username,
          access_token: connectionData.access_token,
          refresh_token: connectionData.refresh_token,
          expires_at: connectionData.expires_at,
          is_active: true,
          connected_at: new Date().toISOString(),
        })
        .eq("connection_id", existingConnection.connection_id)
        .select()
        .single();

      return { data, error: error ? handleDatabaseError(error) : null };
    } else {
      // Create new connection
      const { data, error } = await supabase
        .from("social_connections")
        .insert({
          connection_id: uuidv4(),
          ...connectionData,
        })
        .select()
        .single();

      return { data, error: error ? handleDatabaseError(error) : null };
    }
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};

export const getSocialConnections = async (
  user_id: string
): Promise<{ data: DatabaseSocialConnection[] | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from("social_connections")
      .select("*")
      .eq("user_id", user_id)
      .eq("is_active", true);

    return { data, error: error ? handleDatabaseError(error) : null };
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};

// SOL transaction operations
export const createSOLTransaction = async (transactionData: {
  user_id: string;
  transaction_type: "onramp" | "capsule_fee" | "refund";
  sol_amount: number;
  usd_amount?: number;
  moonpay_transaction_id?: string;
}): Promise<{ data: DatabaseSOLTransaction | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from("sol_transactions")
      .insert({
        transaction_id: uuidv4(),
        ...transactionData,
      })
      .select()
      .single();

    return { data, error: error ? handleDatabaseError(error) : null };
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};

export const getSOLTransactions = async (
  user_id: string
): Promise<{ data: DatabaseSOLTransaction[] | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from("sol_transactions")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false });

    return { data, error: error ? handleDatabaseError(error) : null };
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};

export const updateSOLTransaction = async (
  transaction_id: string,
  updateData: {
    status?: "pending" | "processing" | "completed" | "failed";
    solana_tx_signature?: string;
    moonpay_status?: string;
    completed_at?: string;
  }
): Promise<{ data: DatabaseSOLTransaction | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from("sol_transactions")
      .update(updateData)
      .eq("transaction_id", transaction_id)
      .select()
      .single();

    return { data, error: error ? handleDatabaseError(error) : null };
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};

// ===== Reveal Queue Management Functions =====

export const addToRevealQueue = async (
  capsule_id: string,
  scheduled_for: string
): Promise<{ data: any | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from("reveal_queue")
      .insert({
        capsule_id,
        scheduled_for,
        status: "pending",
        attempts: 0,
        max_attempts: 3,
      })
      .select()
      .single();

    return { data, error: error ? handleDatabaseError(error) : null };
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};

export const getPendingReveals = async (
  limit: number = 10
): Promise<{ data: any[] | null; error: any }> => {
  try {
    const now = new Date().toISOString();

    // Use a raw SQL query for column-to-column comparison
    const { data, error } = await supabase.rpc("get_pending_reveals", {
      current_time: now,
      query_limit: limit,
    });

    if (error) {
      // If RPC doesn't exist, fall back to fetching all and filtering in JS
      console.log("RPC function not found, using fallback query...");

      const { data: allPending, error: fallbackError } = await supabase
        .from("reveal_queue")
        .select(
          `
          *,
          capsules:capsule_id (
            capsule_id,
            user_id,
            content_encrypted,
            reveal_date,
            status,
            is_gamified,
            on_chain_tx
          )
        `
        )
        .eq("status", "pending")
        .lte("scheduled_for", now)
        .order("scheduled_for", { ascending: true })
        .limit(limit * 2); // Get more to filter client-side

      if (fallbackError) {
        return { data: null, error: handleDatabaseError(fallbackError) };
      }

      // Filter client-side where attempts < max_attempts
      const filtered = (allPending || [])
        .filter(item => item.attempts < item.max_attempts)
        .slice(0, limit);

      return { data: filtered, error: null };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};

export const updateRevealQueueStatus = async (
  queue_id: string,
  updateData: {
    status?: "pending" | "processing" | "completed" | "failed";
    attempts?: number;
    last_attempt?: string;
    next_attempt?: string;
    error_message?: string;
  }
): Promise<{ data: any | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from("reveal_queue")
      .update({
        ...updateData,
        last_attempt: updateData.last_attempt || new Date().toISOString(),
      })
      .eq("queue_id", queue_id)
      .select()
      .single();

    return { data, error: error ? handleDatabaseError(error) : null };
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};

export const getFailedReveals = async (
  limit: number = 50
): Promise<{ data: any[] | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from("reveal_queue")
      .select(
        `
        *,
        capsules:capsule_id (
          capsule_id,
          user_id,
          reveal_date,
          status
        )
      `
      )
      .eq("status", "failed")
      .order("last_attempt", { ascending: false })
      .limit(limit * 2); // Get more to filter client-side

    if (error) {
      return { data: null, error: handleDatabaseError(error) };
    }

    // Filter client-side where attempts >= max_attempts
    const filtered = (data || [])
      .filter(item => item.attempts >= item.max_attempts)
      .slice(0, limit);

    return { data: filtered, error: null };
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};

export const retryFailedReveal = async (
  queue_id: string
): Promise<{ data: any | null; error: any }> => {
  try {
    const nextAttempt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // Retry in 5 minutes

    const { data, error } = await supabase
      .from("reveal_queue")
      .update({
        status: "pending",
        next_attempt: nextAttempt,
        error_message: null,
      })
      .eq("queue_id", queue_id)
      .select()
      .single();

    return { data, error: error ? handleDatabaseError(error) : null };
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};

// ===== Social Post Scheduling Functions =====

export const addSocialPostToQueue = async (
  user_id: string,
  post_content: string,
  scheduled_for: string
): Promise<{ data: any | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from("reveal_queue")
      .insert({
        // Don't set capsule_id for social posts - they don't have capsules
        scheduled_for,
        status: "pending",
        attempts: 0,
        max_attempts: 3,
        post_type: "social_post",
        post_content,
        user_id, // Store user_id directly for social posts
      })
      .select()
      .single();

    return { data, error: error ? handleDatabaseError(error) : null };
  } catch (error) {
    return { data: null, error: handleDatabaseError(error) };
  }
};
