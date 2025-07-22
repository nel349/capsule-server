import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Capsulex } from "../target/types/capsulex";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { describe, before, it } from "mocha";
import { VAULT_SEED, CAPSULE_SEED, CAPSULE_MINT_SEED } from "./constants";
import { expect } from "chai";
import crypto from "crypto";

// Helper functions for PDA generation
function getCapsulePda(
  creator: PublicKey,
  revealDate: anchor.BN,
  programId: PublicKey
) {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(CAPSULE_SEED),
      creator.toBuffer(),
      Buffer.from(revealDate.toArray("le", 8)),
    ],
    programId
  );
  return pda;
}

function getNftMintPda(capsule: PublicKey, programId: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(CAPSULE_MINT_SEED), capsule.toBuffer()],
    programId
  );
  return pda;
}

function getVaultPda(programId: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED)],
    programId
  );
  return pda;
}

function createSHA256Hash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function getDefaultAccounts({ provider, capsulePda, nftMintPda, programId }) {
  return {
    creator: provider.wallet.publicKey,
    capsule: capsulePda,
    nftMint: nftMintPda,
    vault: getVaultPda(programId),
    systemProgram: SystemProgram.programId,
    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  };
}

describe("Content Storage System Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.capsulex as Program<Capsulex>;

  before(async () => {
    console.log("Starting Content Storage Tests");

    // Initialize program if needed
    const vaultPda = getVaultPda(program.programId);
    try {
      await program.methods
        .initializeProgram()
        .accounts({
          authority: provider.wallet.publicKey,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();
    } catch (error) {
      // Program likely already initialized
      console.log("Program already initialized or init failed:", error.message);
    }
  });

  describe("Text Storage Type", () => {
    it("Should create capsule with Text storage for short content", async () => {
      const originalContent = "Short prediction: Bitcoin $200k!";
      const contentHash = createSHA256Hash(originalContent);
      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 3600);

      const capsulePda = getCapsulePda(
        provider.wallet.publicKey,
        revealDate,
        program.programId
      );
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const accounts = getDefaultAccounts({
        provider,
        capsulePda,
        nftMintPda,
        programId: program.programId,
      });

      const tx = await program.methods
        .createCapsule(
          originalContent, // Not encrypted for test simplicity
          { text: {} },
          contentHash,
          revealDate,
          false
        )
        .accounts(accounts as any)
        .rpc();

      // Verify capsule creation
      const capsule = await program.account.capsule.fetch(capsulePda);
      expect(capsule.encryptedContent).to.equal(originalContent);
      expect(capsule.contentIntegrityHash).to.equal(contentHash);
      expect(capsule.contentStorage).to.deep.equal({ text: {} });

      console.log("✅ Text storage capsule created successfully");
    });

    it("Should reject Text storage for content over 280 characters", async () => {
      const longContent = "a".repeat(281); // Over limit
      const contentHash = createSHA256Hash(longContent);
      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 3601);

      const capsulePda = getCapsulePda(
        provider.wallet.publicKey,
        revealDate,
        program.programId
      );
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const accounts = getDefaultAccounts({
        provider,
        capsulePda,
        nftMintPda,
        programId: program.programId,
      });

      try {
        await program.methods
          .createCapsule(
            longContent,
            { text: {} },
            contentHash,
            revealDate,
            false
          )
          .accounts(accounts as any)
          .rpc();

        expect.fail("Should have failed for content too long");
      } catch (error) {
        expect(error.message).to.include("ContentHashTooLong");
        console.log("✅ Correctly rejected long content for Text storage");
      }
    });
  });

  describe("Document Storage Type", () => {
    it("Should create capsule with Document storage", async () => {
      const originalContent =
        "Long document content that exceeds the on-chain limit...";
      const mockCID = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"; // Valid IPFS CID
      const contentHash = createSHA256Hash(originalContent);
      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 3602);

      const capsulePda = getCapsulePda(
        provider.wallet.publicKey,
        revealDate,
        program.programId
      );
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const accounts = getDefaultAccounts({
        provider,
        capsulePda,
        nftMintPda,
        programId: program.programId,
      });

      const tx = await program.methods
        .createCapsule(
          mockCID, // Store CID instead of content
          { document: { cid: mockCID } },
          contentHash,
          revealDate,
          false
        )
        .accounts(accounts as any)
        .rpc();

      const capsule = await program.account.capsule.fetch(capsulePda);
      expect(capsule.encryptedContent).to.equal(mockCID);
      expect(capsule.contentStorage.document.cid).to.equal(mockCID);

      console.log("✅ Document storage capsule created successfully");
    });

    it("Should reject invalid IPFS CID format", async () => {
      const invalidCID = "InvalidCIDFormat123";
      const contentHash = createSHA256Hash("test content");
      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 3603);

      const capsulePda = getCapsulePda(
        provider.wallet.publicKey,
        revealDate,
        program.programId
      );
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const accounts = getDefaultAccounts({
        provider,
        capsulePda,
        nftMintPda,
        programId: program.programId,
      });

      try {
        await program.methods
          .createCapsule(
            invalidCID,
            { document: { cid: invalidCID } },
            contentHash,
            revealDate,
            false
          )
          .accounts(accounts as any)
          .rpc();

        expect.fail("Should have failed for invalid CID");
      } catch (error) {
        expect(error.message).to.include("InvalidCID");
        console.log("✅ Correctly rejected invalid CID format");
      }
    });
  });

  describe("SocialArchive Storage Type", () => {
    it("Should create capsule with SocialArchive storage", async () => {
      const originalUrl = "https://x.com/user/status/1234567890";
      const archivedCID = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
      const platform = "x.com";
      const captureTimestamp = Math.floor(Date.now() / 1000);
      const contentHash = createSHA256Hash("archived tweet content");
      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 3604);

      const capsulePda = getCapsulePda(
        provider.wallet.publicKey,
        revealDate,
        program.programId
      );
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const accounts = getDefaultAccounts({
        provider,
        capsulePda,
        nftMintPda,
        programId: program.programId,
      });

      const tx = await program.methods
        .createCapsule(
          archivedCID,
          {
            socialArchive: {
              originalUrl: originalUrl,
              archivedCid: archivedCID,
              platform,
              captureTimestamp: new anchor.BN(captureTimestamp),
              contentHash: contentHash,
            },
          },
          contentHash,
          revealDate,
          false
        )
        .accounts(accounts as any)
        .rpc();

      const capsule = await program.account.capsule.fetch(capsulePda);
      expect(capsule.contentStorage.socialArchive.originalUrl).to.equal(
        originalUrl
      );
      expect(capsule.contentStorage.socialArchive.platform).to.equal(platform);

      console.log("✅ SocialArchive storage capsule created successfully");
    });

    it("Should reject non-HTTPS URLs", async () => {
      const invalidUrl = "http://insecure-site.com/post"; // HTTP not HTTPS
      const archivedCID = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
      const contentHash = createSHA256Hash("content");
      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 3605);

      const capsulePda = getCapsulePda(
        provider.wallet.publicKey,
        revealDate,
        program.programId
      );
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const accounts = getDefaultAccounts({
        provider,
        capsulePda,
        nftMintPda,
        programId: program.programId,
      });

      try {
        await program.methods
          .createCapsule(
            archivedCID,
            {
              socialArchive: {
                originalUrl: invalidUrl,
                archivedCid: archivedCID,
                platform: "x.com",
                captureTimestamp: new anchor.BN(Date.now()),
                contentHash: contentHash,
              },
            },
            contentHash,
            revealDate,
            false
          )
          .accounts(accounts as any)
          .rpc();

        expect.fail("Should have failed for non-HTTPS URL");
      } catch (error) {
        expect(error.message).to.include("InvalidURL");
        console.log("✅ Correctly rejected non-HTTPS URL");
      }
    });
  });

  describe("MediaBundle Storage Type", () => {
    it("Should create capsule with MediaBundle storage", async () => {
      const primaryCID = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
      const attachmentCIDs = [
        "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdH",
        "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdI",
      ];
      const manifestCID = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdJ";
      const totalSizeBytes = 50000000; // 50MB
      const contentHash = createSHA256Hash("media bundle content");
      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 3606);

      const capsulePda = getCapsulePda(
        provider.wallet.publicKey,
        revealDate,
        program.programId
      );
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const accounts = getDefaultAccounts({
        provider,
        capsulePda,
        nftMintPda,
        programId: program.programId,
      });

      const tx = await program.methods
        .createCapsule(
          primaryCID,
          {
            mediaBundle: {
              primaryCid: primaryCID,
              attachments: attachmentCIDs,
              manifestCid: manifestCID,
              totalSizeBytes: new anchor.BN(totalSizeBytes),
            },
          },
          contentHash,
          revealDate,
          false
        )
        .accounts(accounts as any)
        .rpc();

      const capsule = await program.account.capsule.fetch(capsulePda);
      expect(capsule.contentStorage.mediaBundle.primaryCid).to.equal(
        primaryCID
      );
      expect(capsule.contentStorage.mediaBundle.attachments).to.deep.equal(
        attachmentCIDs
      );
      expect(
        capsule.contentStorage.mediaBundle.totalSizeBytes.toNumber()
      ).to.equal(totalSizeBytes);

      console.log("✅ MediaBundle storage capsule created successfully");
    });

    it("Should reject MediaBundle with too many attachments", async () => {
      const primaryCID = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
      // Use shorter strings to avoid serialization buffer overflow
      const tooManyAttachments = Array(51).fill("QmX"); // 51 > 50 limit, but shorter strings
      const manifestCID = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdJ";
      const contentHash = createSHA256Hash("content");
      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 3607);

      const capsulePda = getCapsulePda(
        provider.wallet.publicKey,
        revealDate,
        program.programId
      );
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const accounts = getDefaultAccounts({
        provider,
        capsulePda,
        nftMintPda,
        programId: program.programId,
      });

      try {
        await program.methods
          .createCapsule(
            primaryCID,
            {
              mediaBundle: {
                primaryCid: primaryCID,
                attachments: tooManyAttachments,
                manifestCid: manifestCID,
                totalSizeBytes: new anchor.BN(1000000),
              },
            },
            contentHash,
            revealDate,
            false
          )
          .accounts(accounts as any)
          .rpc();

        expect.fail("Should have failed for too many attachments");
      } catch (error) {
        expect(error.message).to.include("TooManyAttachments");
        console.log("✅ Correctly rejected too many attachments");
      }
    });
  });

  describe("Content Integrity Hash Validation", () => {
    it("Should reject invalid hash length", async () => {
      const content = "Test content";
      const invalidHash = "tooshort"; // Not 64 characters
      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 3608);

      const capsulePda = getCapsulePda(
        provider.wallet.publicKey,
        revealDate,
        program.programId
      );
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const accounts = getDefaultAccounts({
        provider,
        capsulePda,
        nftMintPda,
        programId: program.programId,
      });

      try {
        await program.methods
          .createCapsule(content, { text: {} }, invalidHash, revealDate, false)
          .accounts(accounts as any)
          .rpc();

        expect.fail("Should have failed for invalid hash length");
      } catch (error) {
        expect(error.message).to.include("InvalidContentHash");
        console.log("✅ Correctly rejected invalid hash length");
      }
    });

    it("Should accept valid 64-character hash", async () => {
      const content = "Test content for valid hash";
      const validHash = createSHA256Hash(content); // Proper 64-char SHA256
      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 3609);

      const capsulePda = getCapsulePda(
        provider.wallet.publicKey,
        revealDate,
        program.programId
      );
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const accounts = getDefaultAccounts({
        provider,
        capsulePda,
        nftMintPda,
        programId: program.programId,
      });

      const tx = await program.methods
        .createCapsule(content, { text: {} }, validHash, revealDate, false)
        .accounts(accounts as any)
        .rpc();

      const capsule = await program.account.capsule.fetch(capsulePda);
      expect(capsule.contentIntegrityHash).to.equal(validHash);
      expect(capsule.contentIntegrityHash.length).to.equal(64);

      console.log("✅ Valid hash accepted successfully");
    });
  });

  describe("Content Integrity Verification Flow", () => {
    it("Should verify content integrity after reveal", async () => {
      const originalContent = "My prediction for content verification test";
      const contentHash = createSHA256Hash(originalContent);
      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 7777); // Unique timestamp to avoid conflicts

      const capsulePda = getCapsulePda(
        provider.wallet.publicKey,
        revealDate,
        program.programId
      );
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const accounts = getDefaultAccounts({
        provider,
        capsulePda,
        nftMintPda,
        programId: program.programId,
      });

      // Create capsule
      await program.methods
        .createCapsule(
          originalContent,
          { text: {} },
          contentHash,
          revealDate,
          false
        )
        .accounts(accounts as any)
        .rpc();

      // For testing purposes, we'll verify the content integrity without waiting for reveal date
      // In a real scenario, this would only work after the reveal date

      // Verify content integrity (client-side simulation)
      const capsuleBeforeReveal = await program.account.capsule.fetch(
        capsulePda
      );
      const storedContent = capsuleBeforeReveal.encryptedContent;
      const storedHash = capsuleBeforeReveal.contentIntegrityHash;
      const verificationHash = createSHA256Hash(storedContent);

      expect(verificationHash).to.equal(storedHash);
      expect(capsuleBeforeReveal.isRevealed).to.be.false; // Not revealed yet

      console.log("✅ Content integrity verification successful");
    });
  });
});
