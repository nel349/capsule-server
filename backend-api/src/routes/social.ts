import express from "express";
import {
  createSocialConnection,
  getSocialConnections,
  upsertSocialConnection,
} from "../utils/database";
import { authenticateToken } from "../middleware/auth";
import { CreateSocialConnectionRequest, ApiResponse, AuthenticatedRequest } from "../types";
import axios from "axios";
import FormData from "form-data";

const router = express.Router();

// Connect social media account (requires authentication)
router.post("/connect", authenticateToken, async (req: AuthenticatedRequest, res) => {
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
        error: "platform and platform_user_id are required",
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
      access_token: connection?.access_token ? "[REDACTED]" : undefined,
      refresh_token: connection?.refresh_token ? "[REDACTED]" : undefined,
    };

    res.status(201).json({
      success: true,
      data: safeConnection,
    } as ApiResponse);
  } catch (error) {
    console.error("Connect social account error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    } as ApiResponse);
  }
});

// Get user's social connections (requires authentication)
router.get("/connections", authenticateToken, async (req: AuthenticatedRequest, res) => {
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
      access_token: connection.access_token ? "[REDACTED]" : undefined,
      refresh_token: connection.refresh_token ? "[REDACTED]" : undefined,
    }));

    res.json({
      success: true,
      data: safeConnections,
    } as ApiResponse);
  } catch (error) {
    console.error("Get social connections error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    } as ApiResponse);
  }
});

// Twitter OAuth 2.0 token exchange endpoint
router.post(
  "/twitter/exchange-token",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { code, codeVerifier, redirectUri } = req.body;

      if (!code || !codeVerifier || !redirectUri) {
        return res.status(400).json({
          success: false,
          error: "code, codeVerifier, and redirectUri are required",
        } as ApiResponse);
      }

      console.log("🔄 Twitter token exchange - starting...");
      console.log("🔑 Using client ID:", process.env.CLIENT_ID?.substring(0, 10) + "...");

      // Exchange authorization code for access token with Twitter
      // Twitter OAuth 2.0 requires Basic Auth header with client credentials
      const credentials = Buffer.from(
        `${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`
      ).toString("base64");

      const tokenResponse = await axios.post(
        "https://api.twitter.com/2/oauth2/token",
        new URLSearchParams({
          code: code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${credentials}`,
          },
        }
      );

      console.log("✅ Twitter token exchange successful");

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      // Get user information from Twitter
      const userResponse = await axios.get("https://api.twitter.com/2/users/me", {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      const { id: platform_user_id, username, name } = userResponse.data.data;

      console.log("✅ Twitter user info retrieved:", username);

      // Store or update the connection in database
      const { error } = await upsertSocialConnection({
        user_id: req.user!.user_id,
        platform: "twitter",
        platform_user_id,
        platform_username: username,
        access_token,
        refresh_token,
        expires_at: expires_in ? new Date(Date.now() + expires_in * 1000) : undefined,
      });

      if (error) {
        console.error("❌ Failed to save Twitter connection:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to save Twitter connection",
        } as ApiResponse);
      }

      console.log("✅ Twitter connection saved to database");

      // Return success with user info (no sensitive tokens)
      res.status(200).json({
        success: true,
        data: {
          user: {
            id: platform_user_id,
            username,
            name,
          },
          accessToken: "[STORED_SECURELY]",
          refreshToken: refresh_token ? "[STORED_SECURELY]" : undefined,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("❌ Twitter token exchange error:", error);

      if (axios.isAxiosError(error)) {
        console.error("Twitter API error details:", {
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
        error: "Internal server error during token exchange",
      } as ApiResponse);
    }
  }
);

// Post tweet using stored Twitter connection
router.post("/post-tweet", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { text, media_urls } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Tweet text is required",
      } as ApiResponse);
    }

    if (text.length > 280) {
      return res.status(400).json({
        success: false,
        error: "Tweet text exceeds 280 character limit",
      } as ApiResponse);
    }

    console.log("🐦 Posting tweet for user:", req.user!.user_id);

    // Get user's Twitter connection
    const { data: connections, error: connectionsError } = await getSocialConnections(
      req.user!.user_id
    );

    if (connectionsError || !connections) {
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve social connections",
      } as ApiResponse);
    }

    const twitterConnection = connections.find(
      conn => conn.platform === "twitter" && conn.is_active
    );

    if (!twitterConnection) {
      return res.status(400).json({
        success: false,
        error: "Twitter account not connected. Please connect your Twitter account first.",
      } as ApiResponse);
    }

    if (!twitterConnection.access_token) {
      return res.status(400).json({
        success: false,
        error: "Twitter access token not found. Please reconnect your Twitter account.",
      } as ApiResponse);
    }

    console.log("✅ Twitter connection found for user:", twitterConnection.platform_username);

    // Check if we should mock Twitter API for development/demo
    const mockTwitterApi = process.env.MOCK_TWITTER_API === "true";

    if (mockTwitterApi) {
      console.log("🎭 Mock mode: Simulating Twitter post");

      // Generate mock response data
      const mockTweetId = `mock_${Date.now()}`;
      const mockTweetUrl = `https://twitter.com/${twitterConnection.platform_username}/status/${mockTweetId}`;

      // Mock media info if media URLs provided
      const mockMediaInfo =
        media_urls && Array.isArray(media_urls) && media_urls.length > 0
          ? media_urls.map((url, index) => ({
              mediaId: `mock_media_${Date.now()}_${index}`,
              mediaKey: `mock_key_${Date.now()}_${index}`,
              viewUrl: url, // Use original URL as mock view URL
              originalUrl: url,
            }))
          : [];

      // Return mock success response
      return res.status(200).json({
        success: true,
        data: {
          tweet_id: mockTweetId,
          tweet_url: mockTweetUrl,
          username: twitterConnection.platform_username,
          text: text.trim(),
          media_info: mockMediaInfo.length > 0 ? mockMediaInfo : undefined,
          mock_mode: true,
        },
      } as ApiResponse);
    }

    // Prepare tweet data
    const tweetData: any = {
      text: text.trim(),
    };

    // Handle media if provided - using X API v2 media upload
    const media_ids: string[] = [];
    const uploadedMediaInfo: Array<{
      mediaId: string;
      mediaKey: string;
      viewUrl: string;
      originalUrl: string;
    }> = [];

    if (media_urls && Array.isArray(media_urls) && media_urls.length > 0) {
      console.log("📸 Processing media URLs:", media_urls);

      try {
        // For each media URL, download and upload to X API v2
        for (const mediaUrl of media_urls.slice(0, 4)) {
          // Twitter allows max 4 media
          console.log("⬇️ Downloading media from:", mediaUrl);

          // Download media to buffer
          const mediaResponse = await axios.get(mediaUrl, {
            responseType: "arraybuffer",
            timeout: 30000,
          });

          // Detect content type from response headers
          const contentType = mediaResponse.headers["content-type"] || "image/jpeg";
          console.log("📄 Media content type:", contentType);

          // Create form data for X API v2 media upload (multipart/form-data)
          const formData = new FormData();
          formData.append("media", mediaResponse.data, {
            filename: `image.${contentType.split("/")[1] || "jpg"}`,
            contentType: contentType,
          });
          formData.append("media_category", "tweet_image");

          // Upload using X API v2 media endpoint with multipart/form-data
          console.log("🚀 Using X API v2 media upload with multipart/form-data");
          const uploadResponse = await axios.post(
            "https://api.twitter.com/2/media/upload",
            formData,
            {
              headers: {
                Authorization: `Bearer ${twitterConnection.access_token}`,
                ...formData.getHeaders(),
              },
              maxContentLength: Infinity,
              maxBodyLength: Infinity,
            }
          );

          // Log full response to see what X API v2 returns
          console.log("🔍 X API v2 upload response:", JSON.stringify(uploadResponse.data, null, 2));

          // X API v2 response structure: { data: { id, media_key, ... } }
          const responseData = uploadResponse.data.data;
          if (!responseData) {
            console.error("❌ No data object in X API response:", uploadResponse.data);
            throw new Error("Invalid response format from X API v2");
          }

          const mediaId = responseData.id;
          const mediaKey = responseData.media_key;

          if (mediaId) {
            media_ids.push(String(mediaId));

            // Fetch the actual viewable URL from X API v2
            let mediaViewUrl: string | undefined;
            try {
              const mediaDetailsResponse = await axios.get(
                `https://api.twitter.com/2/media/${mediaId}?media.fields=url,preview_image_url`,
                {
                  headers: {
                    Authorization: `Bearer ${twitterConnection.access_token}`,
                  },
                }
              );

              // Extract the actual URL from the API response
              mediaViewUrl =
                mediaDetailsResponse.data.data?.url ||
                mediaDetailsResponse.data.data?.preview_image_url;

              console.log("📷 Media details from API:", mediaDetailsResponse.data.data);
            } catch (urlError) {
              console.error("⚠️ Could not fetch media URL:", urlError);
              mediaViewUrl = undefined;
            }

            // Store media info for response
            uploadedMediaInfo.push({
              mediaId: String(mediaId),
              mediaKey: String(mediaKey),
              viewUrl: mediaViewUrl || "URL not available",
              originalUrl: mediaUrl,
            });

            console.log("✅ Media uploaded with X API v2:", {
              mediaId,
              mediaKey,
              viewUrl: mediaViewUrl,
            });
          } else {
            console.error("❌ No media ID found in response data:", responseData);
            throw new Error("Media uploaded but no ID returned from X API v2");
          }
        }

        if (media_ids.length > 0) {
          tweetData.media = { media_ids };
        }
      } catch (mediaError) {
        console.error("❌ Media upload failed:", mediaError);

        if (axios.isAxiosError(mediaError)) {
          console.error("Media upload error details:", {
            status: mediaError.response?.status,
            data: mediaError.response?.data,
          });
        }

        return res.status(500).json({
          success: false,
          error: "Failed to upload media to Twitter",
        } as ApiResponse);
      }
    }

    // Post tweet to Twitter API v2
    const tweetResponse = await axios.post("https://api.twitter.com/2/tweets", tweetData, {
      headers: {
        Authorization: `Bearer ${twitterConnection.access_token}`,
        "Content-Type": "application/json",
      },
    });

    const tweetId = tweetResponse.data.data.id;
    const tweetUrl = `https://twitter.com/${twitterConnection.platform_username}/status/${tweetId}`;

    console.log("✅ Tweet posted successfully:", tweetUrl);

    // Return success with tweet info
    res.status(200).json({
      success: true,
      data: {
        tweet_id: tweetId,
        tweet_url: tweetUrl,
        username: twitterConnection.platform_username,
        text: tweetData.text,
        media_info: uploadedMediaInfo.length > 0 ? uploadedMediaInfo : undefined,
      },
    } as ApiResponse);
  } catch (error) {
    console.error("❌ Tweet posting error:", error);

    if (axios.isAxiosError(error)) {
      console.error("Twitter API error details:", {
        status: error.response?.status,
        data: error.response?.data,
      });

      // Handle specific Twitter API errors
      if (error.response?.status === 401) {
        return res.status(400).json({
          success: false,
          error: "Twitter access token expired. Please reconnect your Twitter account.",
        } as ApiResponse);
      }

      if (error.response?.status === 403) {
        return res.status(400).json({
          success: false,
          error: "Twitter API access forbidden. Check your Twitter app permissions.",
        } as ApiResponse);
      }

      return res.status(400).json({
        success: false,
        error: `Twitter API error: ${error.response?.data?.detail || error.message}`,
      } as ApiResponse);
    }

    res.status(500).json({
      success: false,
      error: "Internal server error during tweet posting",
    } as ApiResponse);
  }
});

// Get app settings (requires authentication)
router.get("/settings", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const settings = {
      mock_twitter_api: process.env.MOCK_TWITTER_API === "true",
      environment: process.env.NODE_ENV || "development",
    };

    res.json({
      success: true,
      data: settings,
    } as ApiResponse);
  } catch (error) {
    console.error("Get settings error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    } as ApiResponse);
  }
});

// Post Twitter audience notification when capsule is created
router.post("/notify-audience", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { capsule_id, reveal_date, hint_text, include_capsule_link = true } = req.body;

    if (!capsule_id || !reveal_date) {
      return res.status(400).json({
        success: false,
        error: "capsule_id and reveal_date are required",
      } as ApiResponse);
    }

    console.log("📢 Creating audience notification post for capsule:", capsule_id);

    // Get user's Twitter connection
    const { data: connections, error: connectionsError } = await getSocialConnections(
      req.user!.user_id
    );

    if (connectionsError || !connections) {
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve social connections",
      } as ApiResponse);
    }

    const twitterConnection = connections.find(
      conn => conn.platform === "twitter" && conn.is_active
    );

    if (!twitterConnection) {
      return res.status(400).json({
        success: false,
        error: "Twitter account not connected. Please connect your Twitter account first.",
      } as ApiResponse);
    }

    // Format reveal date nicely
    const revealDateTime = new Date(reveal_date);
    const formattedDate = revealDateTime.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    // Create audience notification text
    const baseText = hint_text || "🔮 I just created a time capsule that will be revealed on";
    const capsuleLink = include_capsule_link
      ? `\n\n🔗 Track the reveal: https://capsulex.com/capsule/${capsule_id}`
      : "";
    const hashtags = "\n\n#TimeCapsule #CapsuleX #FutureSelf #BlockchainReveal";

    const fullText = `${baseText} ${formattedDate}! ⏰${capsuleLink}${hashtags}`;

    // Check character limit
    if (fullText.length > 280) {
      // Trim if too long
      const maxLength = 280 - hashtags.length - 3; // Leave room for "..."
      const trimmedBase = baseText.substring(0, maxLength - formattedDate.length - 20);
      const trimmedText = `${trimmedBase}... ${formattedDate}! ⏰${hashtags}`;

      // Use internal post-tweet endpoint
      const postResponse = await axios.post(
        `${req.protocol}://${req.get("host")}/api/social/post-tweet`,
        { text: trimmedText },
        {
          headers: {
            Authorization: req.headers.authorization,
            "Content-Type": "application/json",
          },
        }
      );

      if (!postResponse.data.success) {
        throw new Error(postResponse.data.error || "Failed to post tweet");
      }

      return res.status(200).json({
        success: true,
        data: {
          ...postResponse.data.data,
          notification_type: "audience_notification",
          capsule_id,
          original_text: fullText,
          posted_text: trimmedText,
          was_trimmed: true,
        },
      } as ApiResponse);
    } else {
      // Use internal post-tweet endpoint
      const postResponse = await axios.post(
        `${req.protocol}://${req.get("host")}/api/social/post-tweet`,
        { text: fullText },
        {
          headers: {
            Authorization: req.headers.authorization,
            "Content-Type": "application/json",
          },
        }
      );

      if (!postResponse.data.success) {
        throw new Error(postResponse.data.error || "Failed to post tweet");
      }

      return res.status(200).json({
        success: true,
        data: {
          ...postResponse.data.data,
          notification_type: "audience_notification",
          capsule_id,
          posted_text: fullText,
          was_trimmed: false,
        },
      } as ApiResponse);
    }
  } catch (error) {
    console.error("❌ Audience notification error:", error);

    if (axios.isAxiosError(error)) {
      console.error("Internal API error details:", {
        status: error.response?.status,
        data: error.response?.data,
      });

      return res.status(error.response?.status || 500).json({
        success: false,
        error: error.response?.data?.error || error.message,
      } as ApiResponse);
    }

    res.status(500).json({
      success: false,
      error: "Internal server error during audience notification",
    } as ApiResponse);
  }
});

// Update app settings (requires authentication)
router.post("/settings", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { mock_twitter_api } = req.body;

    // Update environment variable for current session
    if (typeof mock_twitter_api === "boolean") {
      process.env.MOCK_TWITTER_API = mock_twitter_api.toString();
      console.log("🎭 Mock Twitter API setting updated:", mock_twitter_api);
    }

    const updatedSettings = {
      mock_twitter_api: process.env.MOCK_TWITTER_API === "true",
      environment: process.env.NODE_ENV || "development",
    };

    res.json({
      success: true,
      data: updatedSettings,
      message: "Settings updated successfully",
    } as ApiResponse);
  } catch (error) {
    console.error("Update settings error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    } as ApiResponse);
  }
});

export default router;
