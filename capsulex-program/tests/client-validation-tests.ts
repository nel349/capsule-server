import { describe, it } from "mocha";
import { expect } from "chai";
import { ContentValidator } from "../client-validation";

describe("Client-Side Content Validation Tests", () => {
  
  describe("SHA256 Hash Validation", () => {
    it("Should accept valid SHA256 hex strings", () => {
      const validHashes = [
        "a1b2c3d4e5f67890123456789012345678901234567890abcdefabcdefabcdef12",
        "0000000000000000000000000000000000000000000000000000000000000000",
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        "ABCDEF1234567890abcdef1234567890ABCDEF1234567890abcdef1234567890",
      ];

      validHashes.forEach(hash => {
        expect(ContentValidator.isValidSHA256Hex(hash)).to.be.true;
      });
    });

    it("Should reject invalid SHA256 hex strings", () => {
      const invalidHashes = [
        "too_short",
        "a1b2c3d4e5f67890123456789012345678901234567890abcdefabcdefabcdef123", // 65 chars
        "a1b2c3d4e5f67890123456789012345678901234567890abcdefabcdefabcdef1", // 63 chars
        "g1b2c3d4e5f67890123456789012345678901234567890abcdefabcdefabcdef12", // Contains 'g'
        "a1b2c3d4e5f67890123456789012345678901234567890abcdefabcdefabcdef!", // Contains '!'
        "", // Empty
        " a1b2c3d4e5f67890123456789012345678901234567890abcdefabcdefabcdef1", // Leading space
      ];

      invalidHashes.forEach(hash => {
        expect(ContentValidator.isValidSHA256Hex(hash)).to.be.false;
      });
    });
  });

  describe("IPFS CID Validation", () => {
    it("Should accept valid IPFS CIDs", () => {
      const validCIDs = [
        "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG", // 46 chars
        "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdGH", // 47 chars
        "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdGHJKLMNPQRSTUVWXYZ", // 59 chars (max)
      ];

      validCIDs.forEach(cid => {
        expect(ContentValidator.isValidIPFSCID(cid)).to.be.true;
      });
    });

    it("Should reject invalid IPFS CIDs", () => {
      const invalidCIDs = [
        "InvalidCID",
        "Qm", // Too short
        "QmTooShort",
        "NotStartingWithQm46characters1234567890123456789012", // Doesn't start with Qm
        "QmContainsInvalidCharacters!@#$%^&*()1234567890123456", // Invalid Base58 chars
        "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdGHJKLMNPQRSTUVWXYZ1", // 60 chars (too long)
        "", // Empty
      ];

      invalidCIDs.forEach(cid => {
        expect(ContentValidator.isValidIPFSCID(cid)).to.be.false;
      });
    });
  });

  describe("HTTPS URL Validation", () => {
    it("Should accept valid HTTPS URLs", () => {
      const validURLs = [
        "https://example.com",
        "https://x.com/user/status/1234567890",
        "https://instagram.com/user/post/abc123",
        "https://subdomain.example.com/path/to/resource",
        "https://example.com/path?query=value&other=param",
        "https://example.com:8080/secure-path",
      ];

      validURLs.forEach(url => {
        expect(ContentValidator.isValidHTTPSURL(url)).to.be.true;
      });
    });

    it("Should reject invalid URLs", () => {
      const invalidURLs = [
        "http://insecure.com", // HTTP not HTTPS
        "ftp://example.com", // Wrong protocol
        "https://", // Incomplete
        "not-a-url-at-all",
        "https://localhost/path", // Localhost blocked for security
        "https://127.0.0.1/path", // Local IP blocked
        "", // Empty
        "https://" + "a".repeat(500), // Too long (over 500 chars)
      ];

      invalidURLs.forEach(url => {
        expect(ContentValidator.isValidHTTPSURL(url)).to.be.false;
      });
    });
  });

  describe("Social Platform Validation", () => {
    it("Should accept supported social platforms", () => {
      const validPlatforms = [
        "x.com",
        "twitter.com",
        "instagram.com",
        "tiktok.com",
        "youtube.com",
        "X.COM", // Case insensitive
        "INSTAGRAM.COM",
      ];

      validPlatforms.forEach(platform => {
        expect(ContentValidator.isValidSocialPlatform(platform)).to.be.true;
      });
    });

    it("Should reject unsupported platforms", () => {
      const invalidPlatforms = [
        "facebook.com", // Not in whitelist
        "reddit.com",
        "unknown-platform.com",
        "malicious-site.evil",
        "",
        "x", // Incomplete
      ];

      invalidPlatforms.forEach(platform => {
        expect(ContentValidator.isValidSocialPlatform(platform)).to.be.false;
      });
    });
  });

  describe("Content Storage Validation", () => {
    it("Should validate Text storage type", () => {
      const textStorage = { type: "Text" as const };
      const result = ContentValidator.validateContentStorage(textStorage);
      expect(result.valid).to.be.true;
    });

    it("Should validate Document storage type", () => {
      const documentStorage = { 
        type: "Document" as const,
        cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
      };
      const result = ContentValidator.validateContentStorage(documentStorage);
      expect(result.valid).to.be.true;
    });

    it("Should reject Document with invalid CID", () => {
      const documentStorage = { 
        type: "Document" as const,
        cid: "InvalidCID123"
      };
      const result = ContentValidator.validateContentStorage(documentStorage);
      expect(result.valid).to.be.false;
      expect(result.error).to.include("Invalid IPFS CID format");
    });

    it("Should validate SocialArchive storage type", () => {
      const socialStorage = { 
        type: "SocialArchive" as const,
        originalUrl: "https://x.com/user/status/123",
        archivedCid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        platform: "x.com",
        contentHash: "a1b2c3d4e5f67890123456789012345678901234567890abcdefabcdefabcdef12"
      };
      const result = ContentValidator.validateContentStorage(socialStorage);
      expect(result.valid).to.be.true;
    });

    it("Should reject SocialArchive with invalid URL", () => {
      const socialStorage = { 
        type: "SocialArchive" as const,
        originalUrl: "http://insecure.com", // HTTP not HTTPS
        archivedCid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        platform: "x.com",
        contentHash: "a1b2c3d4e5f67890123456789012345678901234567890abcdefabcdefabcdef12"
      };
      const result = ContentValidator.validateContentStorage(socialStorage);
      expect(result.valid).to.be.false;
      expect(result.error).to.include("Invalid URL format");
    });

    it("Should validate MediaBundle storage type", () => {
      const mediaStorage = { 
        type: "MediaBundle" as const,
        primaryCid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        attachments: [
          "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdH",
          "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdI"
        ],
        manifestCid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdJ",
        totalSizeBytes: 50000000
      };
      const result = ContentValidator.validateContentStorage(mediaStorage);
      expect(result.valid).to.be.true;
    });

    it("Should reject MediaBundle with too many attachments", () => {
      const mediaStorage = { 
        type: "MediaBundle" as const,
        primaryCid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        attachments: Array(51).fill("QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdH"), // 51 > 50
        manifestCid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdJ",
        totalSizeBytes: 50000000
      };
      const result = ContentValidator.validateContentStorage(mediaStorage);
      expect(result.valid).to.be.false;
      expect(result.error).to.include("Too many attachments");
    });

    it("Should reject MediaBundle with content too large", () => {
      const mediaStorage = { 
        type: "MediaBundle" as const,
        primaryCid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        attachments: ["QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdH"],
        manifestCid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdJ",
        totalSizeBytes: 2_000_000_000 // 2GB > 1GB limit
      };
      const result = ContentValidator.validateContentStorage(mediaStorage);
      expect(result.valid).to.be.false;
      expect(result.error).to.include("Content too large");
    });

    it("Should validate ExternalWithBackup storage type", () => {
      const externalStorage = { 
        type: "ExternalWithBackup" as const,
        originalUrl: "https://example.com/resource",
        backupCid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        verificationHash: "a1b2c3d4e5f67890123456789012345678901234567890abcdefabcdef12"
      };
      const result = ContentValidator.validateContentStorage(externalStorage);
      expect(result.valid).to.be.true;
    });

    it("Should reject unknown storage type", () => {
      const unknownStorage = { type: "UnknownType" as any };
      const result = ContentValidator.validateContentStorage(unknownStorage);
      expect(result.valid).to.be.false;
      expect(result.error).to.include("Unknown content storage type");
    });
  });

  describe("Complete Capsule Content Validation", () => {
    it("Should validate complete capsule content successfully", () => {
      const encryptedContent = "Encrypted content here";
      const contentStorage = { type: "Text" as const };
      const contentIntegrityHash = "a1b2c3d4e5f67890123456789012345678901234567890abcdefabcdefabcdef12";

      const result = ContentValidator.validateCapsuleContent(
        encryptedContent,
        contentStorage,
        contentIntegrityHash
      );

      expect(result.valid).to.be.true;
    });

    it("Should reject capsule with invalid integrity hash", () => {
      const encryptedContent = "Encrypted content here";
      const contentStorage = { type: "Text" as const };
      const invalidHash = "invalid_hash_format";

      const result = ContentValidator.validateCapsuleContent(
        encryptedContent,
        contentStorage,
        invalidHash
      );

      expect(result.valid).to.be.false;
      expect(result.error).to.include("Invalid content integrity hash format");
    });

    it("Should reject Text storage with content too long", () => {
      const longContent = "a".repeat(281); // Over 280 char limit
      const contentStorage = { type: "Text" as const };
      const contentIntegrityHash = "a1b2c3d4e5f67890123456789012345678901234567890abcdefabcdefabcdef12";

      const result = ContentValidator.validateCapsuleContent(
        longContent,
        contentStorage,
        contentIntegrityHash
      );

      expect(result.valid).to.be.false;
      expect(result.error).to.include("Text content too long for on-chain storage");
    });

    it("Should validate complex SocialArchive content", () => {
      const encryptedContent = "Archived social media content";
      const contentStorage = { 
        type: "SocialArchive" as const,
        originalUrl: "https://x.com/user/status/1234567890",
        archivedCid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
        platform: "x.com",
        contentHash: "a1b2c3d4e5f67890123456789012345678901234567890abcdefabcdefabcdef12"
      };
      const contentIntegrityHash = "a1b2c3d4e5f67890123456789012345678901234567890abcdefabcdefabcdef12";

      const result = ContentValidator.validateCapsuleContent(
        encryptedContent,
        contentStorage,
        contentIntegrityHash
      );

      expect(result.valid).to.be.true;
    });
  });

  describe("Performance and Edge Cases", () => {
    it("Should handle empty strings gracefully", () => {
      expect(ContentValidator.isValidSHA256Hex("")).to.be.false;
      expect(ContentValidator.isValidIPFSCID("")).to.be.false;
      expect(ContentValidator.isValidHTTPSURL("")).to.be.false;
      expect(ContentValidator.isValidSocialPlatform("")).to.be.false;
    });

    it("Should handle very long inputs", () => {
      const veryLongString = "a".repeat(10000);
      expect(ContentValidator.isValidSHA256Hex(veryLongString)).to.be.false;
      expect(ContentValidator.isValidIPFSCID(veryLongString)).to.be.false;
    });

    it("Should handle unicode characters", () => {
      const unicodeHash = "🚀".repeat(16); // 64 unicode chars but not hex
      expect(ContentValidator.isValidSHA256Hex(unicodeHash)).to.be.false;
    });

    it("Should be case sensitive for hex validation", () => {
      const mixedCaseHash = "A1B2c3d4E5F67890123456789012345678901234567890ABCDEFABCDEFABCDEF12";
      expect(ContentValidator.isValidSHA256Hex(mixedCaseHash)).to.be.true;
    });
  });
});