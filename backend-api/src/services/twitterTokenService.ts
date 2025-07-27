import axios from "axios";
import { supabase } from "../utils/supabase";
import { upsertSocialConnection } from "../utils/database";

export interface TwitterTokenRefreshResult {
  success: boolean;
  access_token?: string;
  refresh_token?: string;
  expires_at?: Date;
  error?: string;
}

export interface TwitterConnection {
  user_id: string;
  platform_user_id: string;
  platform_username?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  is_active: boolean;
}

/**
 * Twitter Token Refresh Service
 * Handles OAuth 2.0 token refresh for maintaining persistent Twitter authorization
 */
export class TwitterTokenService {
  private static readonly TWITTER_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
  private static readonly CLIENT_ID = process.env.TWITTER_CLIENT_ID;
  private static readonly CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;

  /**
   * Refresh an expired Twitter access token using a refresh token
   */
  static async refreshAccessToken(
    refreshToken: string,
    userId: string
  ): Promise<TwitterTokenRefreshResult> {
    try {
      console.log("🔄 Refreshing Twitter access token for user:", userId);

      if (!this.CLIENT_ID || !this.CLIENT_SECRET) {
        console.error("❌ Missing Twitter OAuth credentials");
        return {
          success: false,
          error: "Twitter OAuth credentials not configured",
        };
      }

      // Prepare the token refresh request
      const tokenData = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.CLIENT_ID,
      });

      // Create basic auth header for client credentials
      const clientCredentials = Buffer.from(`${this.CLIENT_ID}:${this.CLIENT_SECRET}`).toString(
        "base64"
      );

      console.log("🔄 Making token refresh request to Twitter...");

      const response = await axios.post(this.TWITTER_TOKEN_URL, tokenData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${clientCredentials}`,
        },
        timeout: 10000, // 10 second timeout
      });

      const { access_token, refresh_token: new_refresh_token, expires_in } = response.data;

      if (!access_token) {
        console.error("❌ No access token in Twitter refresh response");
        return {
          success: false,
          error: "No access token received from Twitter",
        };
      }

      // Calculate expiration time
      const expires_at = expires_in ? new Date(Date.now() + expires_in * 1000) : undefined;

      console.log("✅ Twitter token refresh successful");
      console.log("📅 New token expires at:", expires_at?.toISOString());

      return {
        success: true,
        access_token,
        refresh_token: new_refresh_token || refreshToken, // Use new refresh token if provided, otherwise keep existing
        expires_at,
      };
    } catch (error) {
      console.error("❌ Twitter token refresh failed:", error);

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const errorData = error.response?.data;

        console.error("Twitter API error details:", {
          status,
          data: errorData,
        });

        // Handle specific error cases
        if (status === 400 && errorData?.error === "invalid_grant") {
          return {
            success: false,
            error: "Refresh token is invalid or expired. User needs to reconnect Twitter.",
          };
        }

        if (status === 401) {
          return {
            success: false,
            error: "Twitter OAuth credentials are invalid",
          };
        }

        return {
          success: false,
          error: `Twitter API error: ${errorData?.error_description || error.message}`,
        };
      }

      return {
        success: false,
        error: "Network error during token refresh",
      };
    }
  }

  /**
   * Update the stored Twitter connection with refreshed tokens
   */
  static async updateStoredTokens(
    userId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt?: Date
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("💾 Updating stored Twitter tokens for user:", userId);

      // Get existing connection details
      const { data: existingConnection, error: fetchError } = await supabase
        .from("social_connections")
        .select("platform_user_id, platform_username")
        .eq("user_id", userId)
        .eq("platform", "twitter")
        .eq("is_active", true)
        .single();

      if (fetchError || !existingConnection) {
        console.error("❌ Could not find existing Twitter connection:", fetchError);
        return {
          success: false,
          error: "Twitter connection not found",
        };
      }

      // Update connection with new tokens
      const { error: updateError } = await upsertSocialConnection({
        user_id: userId,
        platform: "twitter",
        platform_user_id: existingConnection.platform_user_id,
        platform_username: existingConnection.platform_username,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
      });

      if (updateError) {
        console.error("❌ Failed to update Twitter tokens:", updateError);
        return {
          success: false,
          error: "Failed to update stored tokens",
        };
      }

      console.log("✅ Twitter tokens updated successfully");
      return { success: true };
    } catch (error) {
      console.error("❌ Error updating stored tokens:", error);
      return {
        success: false,
        error: "Database error while updating tokens",
      };
    }
  }

  /**
   * Get fresh access token for a user, refreshing if necessary
   */
  static async getFreshAccessToken(userId: string): Promise<{
    success: boolean;
    access_token?: string;
    error?: string;
  }> {
    try {
      console.log("🔍 Getting fresh access token for user:", userId);

      // Get current Twitter connection
      const { data: connection, error: fetchError } = await supabase
        .from("social_connections")
        .select("*")
        .eq("user_id", userId)
        .eq("platform", "twitter")
        .eq("is_active", true)
        .single();

      if (fetchError || !connection) {
        console.error("❌ No active Twitter connection found:", fetchError);
        return {
          success: false,
          error: "No active Twitter connection found",
        };
      }

      const twitterConnection = connection as TwitterConnection;

      if (!twitterConnection.access_token) {
        return {
          success: false,
          error: "No access token stored",
        };
      }

      // Check if token is expired or will expire soon (within 5 minutes)
      const now = new Date();
      const expiresAt = twitterConnection.expires_at
        ? new Date(twitterConnection.expires_at)
        : null;
      const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds

      const needsRefresh = expiresAt && expiresAt.getTime() - now.getTime() < bufferTime;

      if (!needsRefresh) {
        console.log("✅ Current access token is still valid");
        return {
          success: true,
          access_token: twitterConnection.access_token,
        };
      }

      console.log("⏰ Access token expired or expires soon, refreshing...");

      if (!twitterConnection.refresh_token) {
        return {
          success: false,
          error: "No refresh token available. User needs to reconnect Twitter.",
        };
      }

      // Refresh the token
      const refreshResult = await this.refreshAccessToken(twitterConnection.refresh_token, userId);

      if (!refreshResult.success) {
        return {
          success: false,
          error: refreshResult.error,
        };
      }

      // Update stored tokens
      const updateResult = await this.updateStoredTokens(
        userId,
        refreshResult.access_token!,
        refreshResult.refresh_token!,
        refreshResult.expires_at
      );

      if (!updateResult.success) {
        return {
          success: false,
          error: updateResult.error,
        };
      }

      console.log("✅ Fresh access token obtained and stored");
      return {
        success: true,
        access_token: refreshResult.access_token,
      };
    } catch (error) {
      console.error("❌ Error getting fresh access token:", error);
      return {
        success: false,
        error: "Internal error while getting fresh token",
      };
    }
  }

  /**
   * Validate if a Twitter access token is still valid
   */
  static async validateAccessToken(accessToken: string): Promise<{
    success: boolean;
    valid: boolean;
    error?: string;
  }> {
    try {
      console.log("🔍 Validating Twitter access token...");

      const response = await axios.get("https://api.twitter.com/2/users/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 5000,
      });

      if (response.status === 200 && response.data?.data?.id) {
        console.log("✅ Access token is valid");
        return {
          success: true,
          valid: true,
        };
      }

      console.log("❌ Access token validation failed");
      return {
        success: true,
        valid: false,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;

        if (status === 401) {
          console.log("❌ Access token is invalid (401)");
          return {
            success: true,
            valid: false,
          };
        }
      }

      console.error("❌ Error validating access token:", error);
      return {
        success: false,
        valid: false,
        error: "Network error during validation",
      };
    }
  }
}
