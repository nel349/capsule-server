/**
 * Client-Side Content Validation
 *
 * Performs expensive validation before sending to Solana program.
 * This saves compute units on-chain while ensuring data integrity.
 */

export class ContentValidator {
  // Rigorous SHA256 hex validation (expensive - client-side only)
  static isValidSHA256Hex(hash: string): boolean {
    if (hash.length !== 64) return false;
    return /^[0-9a-fA-F]{64}$/.test(hash);
  }

  // Rigorous IPFS CID validation
  static isValidIPFSCID(cid: string): boolean {
    if (!cid.startsWith("Qm")) return false;
    if (cid.length < 46 || cid.length > 59) return false;
    // Base58 alphabet validation
    return /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(
      cid.slice(2)
    );
  }

  // URL validation with domain checks
  static isValidHTTPSURL(url: string): boolean {
    if (!url.startsWith("https://")) return false;
    if (url.length < 12 || url.length > 500) return false;

    try {
      const urlObj = new URL(url);
      // Additional security checks
      return (
        urlObj.protocol === "https:" &&
        urlObj.hostname.length > 0 &&
        !urlObj.hostname.includes("localhost") &&
        !urlObj.hostname.includes("127.0.0.1")
      );
    } catch {
      return false;
    }
  }

  // Platform validation with whitelist
  static isValidSocialPlatform(platform: string): boolean {
    const allowedPlatforms = [
      "x.com",
      "twitter.com",
      "instagram.com",
      "tiktok.com",
      "youtube.com",
    ];
    return allowedPlatforms.includes(platform.toLowerCase());
  }

  // Comprehensive content storage validation
  static validateContentStorage(storage: ContentStorage): ValidationResult {
    switch (storage.type) {
      case "Text":
        return { valid: true };

      case "Document":
        if (!this.isValidIPFSCID(storage.cid)) {
          return { valid: false, error: "Invalid IPFS CID format" };
        }
        return { valid: true };

      case "SocialArchive":
        if (!this.isValidHTTPSURL(storage.originalUrl)) {
          return { valid: false, error: "Invalid URL format" };
        }
        if (!this.isValidIPFSCID(storage.archivedCid)) {
          return { valid: false, error: "Invalid archived CID format" };
        }
        if (!this.isValidSocialPlatform(storage.platform)) {
          return { valid: false, error: "Unsupported social platform" };
        }
        if (!this.isValidSHA256Hex(storage.contentHash)) {
          return { valid: false, error: "Invalid content hash format" };
        }
        return { valid: true };

      case "MediaBundle":
        if (!this.isValidIPFSCID(storage.primaryCid)) {
          return { valid: false, error: "Invalid primary CID format" };
        }
        if (!this.isValidIPFSCID(storage.manifestCid)) {
          return { valid: false, error: "Invalid manifest CID format" };
        }
        if (storage.attachments.length > 50) {
          return { valid: false, error: "Too many attachments (max 50)" };
        }
        for (const attachment of storage.attachments) {
          if (!this.isValidIPFSCID(attachment)) {
            return { valid: false, error: "Invalid attachment CID format" };
          }
        }
        if (storage.totalSizeBytes > 1_000_000_000) {
          return { valid: false, error: "Content too large (max 1GB)" };
        }
        return { valid: true };

      case "ExternalWithBackup":
        if (!this.isValidHTTPSURL(storage.originalUrl)) {
          return { valid: false, error: "Invalid original URL format" };
        }
        if (!this.isValidIPFSCID(storage.backupCid)) {
          return { valid: false, error: "Invalid backup CID format" };
        }
        if (!this.isValidSHA256Hex(storage.verificationHash)) {
          return { valid: false, error: "Invalid verification hash format" };
        }
        return { valid: true };

      default:
        return { valid: false, error: "Unknown content storage type" };
    }
  }

  // Main validation function for capsule creation
  static validateCapsuleContent(
    encryptedContent: string,
    contentStorage: ContentStorage,
    contentIntegrityHash: string
  ): ValidationResult {
    // Validate integrity hash
    if (!this.isValidSHA256Hex(contentIntegrityHash)) {
      return { valid: false, error: "Invalid content integrity hash format" };
    }

    // Validate content storage
    const storageValidation = this.validateContentStorage(contentStorage);
    if (!storageValidation.valid) {
      return storageValidation;
    }

    // Additional content-specific validation
    if (contentStorage.type === "Text" && encryptedContent.length > 280) {
      return {
        valid: false,
        error: "Text content too long for on-chain storage",
      };
    }

    return { valid: true };
  }
}

// Type definitions - matching generated TypeScript types (camelCase)
export interface ContentStorage {
  type:
    | "Text"
    | "Document"
    | "SocialArchive"
    | "MediaBundle"
    | "ExternalWithBackup";
  cid?: string;
  originalUrl?: string;
  archivedCid?: string;
  platform?: string;
  contentHash?: string;
  primaryCid?: string;
  attachments?: string[];
  manifestCid?: string;
  totalSizeBytes?: number;
  backupCid?: string;
  verificationHash?: string;
  captureTimestamp?: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Usage example:
/*
const validation = ContentValidator.validateCapsuleContent(
  encryptedContent,
  contentStorage,
  contentIntegrityHash
);

if (!validation.valid) {
  throw new Error(`Validation failed: ${validation.error}`);
}

// Now safe to send to Solana program
await program.methods.createCapsule(
  encryptedContent,
  contentStorage,
  contentIntegrityHash,
  revealDate,
  isGamified
).rpc();
*/
