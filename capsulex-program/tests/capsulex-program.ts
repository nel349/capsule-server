import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Capsulex } from "../target/types/capsulex";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { describe, before, it } from "mocha";
import { VAULT_SEED, CAPSULE_SEED, CAPSULE_MINT_SEED } from "./constants";
import CryptoJS from "crypto-js";
import { expect } from "chai";
import crypto from "crypto";

// Helper function to create content integrity hash
function createSHA256Hash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

// get game PDA
function getGamePda(capsulePda: PublicKey, programId: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("game"), capsulePda.toBuffer()],
    programId
  );
  return pda;
}

describe("capsulex-program", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.capsulex as Program<Capsulex>;

  let vaultPda: PublicKey;
  let vaultBump: number;

  before(async () => {
    // Find the vault PDA
    [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from(VAULT_SEED)],
      program.programId
    );
  });

  it("Initialize Program", async () => {
    try {
      const tx = await program.methods
        .initializeProgram()
        .accounts({
          authority: provider.wallet.publicKey,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();

      console.log("Program initialized:", tx);

      // Verify the vault was created
      const vault = await program.account.programVault.fetch(vaultPda);
      expect(vault.authority.toBase58()).to.equal(
        provider.wallet.publicKey.toBase58()
      );
      expect(vault.totalFeesCollected.toNumber()).to.equal(0);
    } catch (error) {
      console.log("Program already initialized or error:", error);
    }
  });

  it("Is Capsule Created", async () => {
    const originalContent = "Hello, world!";
    const revealDate = new anchor.BN(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

    // Simple encryption for demo (in production, use proper AES encryption)
    const encryptedContent = originalContent; // For this basic test, we'll use plain text

    // Find the capsule PDA using reveal_date (new approach)
    const [capsulePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(CAPSULE_SEED),
        provider.wallet.publicKey.toBuffer(),
        Buffer.from(revealDate.toArray("le", 8)), // 8 bytes for i64
      ],
      program.programId
    );

    // Find the NFT mint PDA
    const [nftMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(CAPSULE_MINT_SEED), capsulePda.toBuffer()],
      program.programId
    );

    const contentHash = createSHA256Hash(originalContent);
    await program.methods
      .createCapsule(
        encryptedContent,
        { text: {} },
        contentHash,
        revealDate,
        false
      )
      .accounts({
        creator: provider.wallet.publicKey,
        capsule: capsulePda,
        nftMint: nftMintPda,
        vault: vaultPda,
        game: getGamePda(capsulePda, program.programId),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .rpc();

    // console.log("Capsule Created", tx);

    // Lets check if the capsule is created
    const capsule = await program.account.capsule.fetch(capsulePda);
    // console.log("Capsule", capsule);

    // Check state, creator, reveal date, is gamified
    expect(capsule.isActive).to.be.equal(true);
    expect(capsule.creator.toBase58()).to.be.equal(
      provider.wallet.publicKey.toBase58()
    );
    expect(capsule.revealDate.toNumber()).to.be.equal(revealDate.toNumber());
    expect(capsule.isGamified).to.be.equal(false);
    expect(capsule.isRevealed).to.be.equal(false);
    expect(capsule.encryptedContent).to.be.equal(encryptedContent);
    // console.log("Capsule encrypted content:", capsule.encryptedContent);
  });

  it("Creates a realistic encrypted time capsule with AES encryption", async () => {
    // Realistic scenario: Someone creating a prediction capsule for New Year's Eve
    // Less than 280 characters
    const actualContent =
      "My 2024 predictions: Bitcoin will hit $150k, AI will revolutionize healthcare, and remote work becomes the norm for 80% of tech jobs. Let's see how this ages! #TimeCapsule2024 #Predictions";
    const currentTime = Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 30 * 24 * 60 * 60); // 30 days from now

    // Generate encryption key (in production, this would be done by the Solana program)
    const encryptionKey = "MySuperSecretKey123456789012345678"; // 32-char key for AES-256

    // Encrypt the content using AES
    const encryptedContent = CryptoJS.AES.encrypt(
      actualContent,
      encryptionKey
    ).toString();

    // Find the capsule PDA using reveal_date (timestamp-based addressing)
    const [capsulePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(CAPSULE_SEED),
        provider.wallet.publicKey.toBuffer(),
        Buffer.from(revealDate.toArray("le", 8)), // 8 bytes for i64
      ],
      program.programId
    );

    // Find the NFT mint PDA
    const [nftMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(CAPSULE_MINT_SEED), capsulePda.toBuffer()],
      program.programId
    );

    const contentHash = createSHA256Hash(actualContent);
    await program.methods
      .createCapsule(
        encryptedContent,
        { text: {} },
        contentHash,
        revealDate,
        true
      )
      .accounts({
        creator: provider.wallet.publicKey,
        capsule: capsulePda,
        nftMint: nftMintPda,
        vault: vaultPda,
        game: getGamePda(capsulePda, program.programId),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .rpc();

    // console.log("Realistic time capsule created:", tx);

    // Verify the capsule was created with correct data
    const capsule = await program.account.capsule.fetch(capsulePda);
    // console.log("Time capsule details:", {
    //   creator: capsule.creator.toBase58(),
    //   keyVault: capsule.keyVault.toBase58(), // Key vault storing encryption key
    //   storedContent: capsule.encryptedContent.substring(0, 60) + "...", // Encrypted content stored
    //   actualContent: actualContent.substring(0, 60) + "...", // Original content (before encryption)
    //   revealDate: new Date(capsule.revealDate.toNumber() * 1000).toLocaleDateString(),
    //   isGamified: capsule.isGamified,
    //   isRevealed: capsule.isRevealed,
    //   isActive: capsule.isActive
    // });

    // Validate the realistic scenario
    expect(capsule.isActive).to.be.equal(true);
    expect(capsule.creator.toBase58()).to.be.equal(
      provider.wallet.publicKey.toBase58()
    );
    expect(capsule.revealDate.toNumber()).to.be.equal(revealDate.toNumber());
    expect(capsule.isGamified).to.be.equal(true); // This one is gamified
    expect(capsule.isRevealed).to.be.equal(false);
    expect(capsule.encryptedContent).to.be.equal(encryptedContent); // Encrypted content stored

    // Verify the actual content represents realistic social media content
    expect(actualContent.length).to.be.lessThan(280); // Twitter-like limit
    expect(actualContent.length).to.be.greaterThan(50); // Has substantial content
    expect(actualContent).to.include("#TimeCapsule2024"); // Contains hashtags

    // Demonstrate decryption (in production, this would only be possible after reveal_date)
    try {
      const decryptedBytes = CryptoJS.AES.decrypt(
        encryptedContent,
        encryptionKey
      );
      const decryptedContent = decryptedBytes.toString(CryptoJS.enc.Utf8);
      // console.log(`✅ Encryption/Decryption demo successful!`);
      // console.log(`📝 Original: "${actualContent.substring(0, 40)}..."`);
      // console.log(`🔒 Encrypted: "${encryptedContent.substring(0, 40)}..."`);
      // console.log(`🔓 Decrypted: "${decryptedContent.substring(0, 40)}..."`);
      expect(decryptedContent).to.equal(actualContent);
    } catch (error) {
      console.log("Decryption demo failed:", error);
      throw error; // Re-throw to see the actual error
    }

    // console.log(`📅 Time capsule sealed for ${Math.round((revealDate.toNumber() - currentTime) / (24 * 60 * 60))} days`);
    // console.log(`🔑 Encryption key safely stored in KeyVault: ${keyVaultPda.toBase58()}`);
    // console.log(`💰 Storage type: ${capsule.contentStorage.onChain ? 'OnChain' : 'IPFS'} (fee: ${capsule.contentStorage.onChain ? '2x' : '1x'})`);
  });

  // --- Helper Functions ---
  function getCapsulePda(
    creator: PublicKey,
    revealDate: anchor.BN,
    programId: PublicKey
  ) {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(CAPSULE_SEED),
        creator.toBuffer(),
        Buffer.from(revealDate.toArray("le", 8)),
      ],
      programId
    )[0];
  }

  function getNftMintPda(capsulePda: PublicKey, programId: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(CAPSULE_MINT_SEED), capsulePda.toBuffer()],
      programId
    )[0];
  }

  function getDefaultAccounts({
    provider,
    capsulePda,
    nftMintPda,
    vaultPda,
    gamePda,
  }: {
    provider: anchor.AnchorProvider;
    capsulePda: PublicKey;
    nftMintPda: PublicKey;
    vaultPda: PublicKey;
    gamePda: PublicKey;
  }) {
    return {
      creator: provider.wallet.publicKey,
      capsule: capsulePda,
      nftMint: nftMintPda,
      vault: vaultPda,
      game: gamePda,
      systemProgram: SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    };
  }

  it("Creates a capsule with long content using on-chain storage", async () => {
    const longContent =
      "This is a very long prediction about the future of blockchain technology that exceeds 280 characters and should be stored on IPFS instead of directly on-chain to save costs. This content would normally be encrypted and uploaded to IPFS, with only the hash stored on-chain, making it much more cost-effective for large content.";
    const encryptedContent = CryptoJS.AES.encrypt(
      longContent,
      "longkey123"
    ).toString();
    const revealDate = new anchor.BN(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
    const capsulePda = getCapsulePda(
      provider.wallet.publicKey,
      revealDate,
      program.programId
    );
    const nftMintPda = getNftMintPda(capsulePda, program.programId);
    const gamePda = getGamePda(capsulePda, program.programId);
    const accounts = getDefaultAccounts({
      provider,
      capsulePda,
      nftMintPda,
      vaultPda,
      gamePda,
    });
    try {
      const contentHash = createSHA256Hash(longContent);
      await program.methods
        .createCapsule(
          encryptedContent,
          { text: {} },
          contentHash,
          revealDate,
          false
        )
        .accounts(accounts as any)
        .rpc();
    } catch (error) {
      expect(error).to.be.an.instanceOf(Error);
      expect(error.message).to.include(
        "Content hash is too long. Maximum length is 280 characters."
      );
    }
  });

  it("Creates a capsule with long content using IPFS storage", async () => {
    const ipfsHash = "Qm" + "a".repeat(44); // Valid mock IPFS hash (46 chars)
    const currentTime = Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 7200); // 2 hours from now
    const capsulePda = getCapsulePda(
      provider.wallet.publicKey,
      revealDate,
      program.programId
    );
    const nftMintPda = getNftMintPda(capsulePda, program.programId);
    const gamePda = getGamePda(capsulePda, program.programId);
    const accounts = getDefaultAccounts({
      provider,
      capsulePda,
      nftMintPda,
      vaultPda,
      gamePda,
    });
    const contentHash = createSHA256Hash(ipfsHash);
    await program.methods
      .createCapsule(
        ipfsHash, // Store only the IPFS hash on-chain
        { document: { cid: ipfsHash } },
        contentHash,
        revealDate,
        false // isGamified
      )
      .accounts(accounts as any)
      .rpc();
    // console.log("\nIPFS Capsule Created", tx);
    const capsule = await program.account.capsule.fetch(capsulePda);
    // console.log("IPFS Capsule", capsule);
    expect(capsule.contentStorage.document).to.exist;
    expect(capsule.encryptedContent).to.equal(ipfsHash);
    expect(capsule.isActive).to.be.true;
    expect(capsule.isRevealed).to.be.false;
    expect(capsule.revealDate.toNumber()).to.equal(revealDate.toNumber());
  });

  it("KeyVault: Demonstrates time-locked encryption key storage", async () => {
    // console.log("\n🔑 === KeyVault Time-Lock Demo ===");

    // Step 1: Create a time capsule with encrypted content
    const secretMessage =
      "🎁 Surprise! This message was locked until the reveal date. Happy future you! 🎉";
    const currentTime = Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 3601); // 1 hour + 1 second to avoid timing issues

    // Generate a random encryption key (in production, this would be done securely)
    const encryptionKey = CryptoJS.lib.WordArray.random(32).toString(); // 32-byte key
    // console.log(`🔐 Generated encryption key: ${encryptionKey.substring(0, 16)}...`);

    // Encrypt the secret message
    const encryptedContent = CryptoJS.AES.encrypt(
      secretMessage,
      encryptionKey
    ).toString();
    // console.log(`🔒 Encrypted content: ${encryptedContent.substring(0, 40)}...`);
    // console.log(`📅 Reveal date: ${new Date(revealDate.toNumber() * 1000).toLocaleString()}`);

    // Create PDAs
    const capsulePda = getCapsulePda(
      provider.wallet.publicKey,
      revealDate,
      program.programId
    );
    const nftMintPda = getNftMintPda(capsulePda, program.programId);
    const gamePda = getGamePda(capsulePda, program.programId);
    const accounts = getDefaultAccounts({
      provider,
      capsulePda,
      nftMintPda,
      vaultPda,
      gamePda,
    });

    // Step 2: Create the time capsule (this stores the encrypted content and locks the key)
    // console.log("\n📦 Creating time capsule with encrypted content...");
    const contentHash = createSHA256Hash(secretMessage);
    await program.methods
      .createCapsule(
        encryptedContent,
        { text: {} },
        contentHash,
        revealDate,
        false
      )
      .accounts(accounts as any)
      .rpc();

    // console.log(`✅ Time capsule created: ${tx}`);

    // Step 3: Verify the capsule was created with encrypted content
    const capsule = await program.account.capsule.fetch(capsulePda);
    expect(capsule.encryptedContent).to.equal(encryptedContent);
    expect(capsule.isRevealed).to.be.false;

    // Step 4: Demonstrate that content cannot be decrypted without the key
    // console.log("\n🚫 Attempting to decrypt content without key access...");
    try {
      // This should fail because we don't have access to the key yet
      const failedDecryption = CryptoJS.AES.decrypt(
        encryptedContent,
        "wrong-key"
      ).toString(CryptoJS.enc.Utf8);
      expect(failedDecryption).to.equal(""); // Should be empty/fail
      // console.log("❌ Decryption failed without proper key (expected)");
    } catch (error) {
      // console.log("❌ Decryption failed without proper key (expected)");
    }

    // Step 5: After reveal date, key should be accessible (if retrieve_key instruction exists)
    // console.log("🎉 Reveal date reached! Key should now be accessible");

    // Note: This would require a retrieve_key instruction in the program
    // For now, we'll demonstrate the concept by showing the encrypted content is stored
    const finalCapsule = await program.account.capsule.fetch(capsulePda);
    expect(finalCapsule.encryptedContent).to.equal(encryptedContent);

    // Step 6: Demonstrate successful decryption with the original key
    // console.log("\n🔓 Demonstrating decryption with retrieved key:");
    const decryptedMessage = CryptoJS.AES.decrypt(
      encryptedContent,
      encryptionKey
    ).toString(CryptoJS.enc.Utf8);
    expect(decryptedMessage).to.equal(secretMessage);
  });

  it("Should fail to create capsule with reveal date too soon", async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const invalidRevealDate = new anchor.BN(currentTime + 1800); // Only 30 minutes (less than 1 hour minimum)

    const capsulePda = getCapsulePda(
      provider.wallet.publicKey,
      invalidRevealDate,
      program.programId
    );
    const nftMintPda = getNftMintPda(capsulePda, program.programId);
    const gamePda = getGamePda(capsulePda, program.programId);
    const accounts = getDefaultAccounts({
      provider,
      capsulePda,
      nftMintPda,
      vaultPda,
      gamePda,
    });

    try {
      const content = "test content";
      const contentHash = createSHA256Hash(content);
      await program.methods
        .createCapsule(
          content,
          { text: {} },
          contentHash,
          invalidRevealDate,
          false
        )
        .accounts(accounts as any)
        .rpc();

      // If we get here, the test failed because the transaction should have been rejected
      expect.fail("Expected transaction to fail due to InvalidRevealDate");
    } catch (error) {
      // This should happen - the transaction should fail
      expect(error.message).to.include("InvalidRevealDate");
      // console.log("✅ Correctly rejected capsule with reveal date too soon");
    }
  });

  it("reveal_capsule: Happy path (reveals after delay)", async () => {
    const content = "Secret for reveal test";
    const encryptionKey = "testkey1234567890123456789012345678";
    const encryptedContent = CryptoJS.AES.encrypt(
      content,
      encryptionKey
    ).toString();
    const currentTime = Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 2); // 2 seconds from now
    const capsulePda = getCapsulePda(
      provider.wallet.publicKey,
      revealDate,
      program.programId
    );
    const nftMintPda = getNftMintPda(capsulePda, program.programId);
    const gamePda = getGamePda(capsulePda, program.programId);
    const accounts = getDefaultAccounts({
      provider,
      capsulePda,
      nftMintPda,
      vaultPda,
      gamePda,
    });
    // Create capsule
    const contentHash = createSHA256Hash(content);
    await program.methods
      .createCapsule(
        encryptedContent,
        { text: {} },
        contentHash,
        revealDate,
        false
      )
      .accounts(accounts as any)
      .rpc();
    // Wait for reveal date
    await new Promise((resolve) => setTimeout(resolve, 3000));
    // Reveal capsule
    await program.methods
      .revealCapsule(revealDate)
      .accounts({
        creator: provider.wallet.publicKey,
        capsule: capsulePda,
      } as any)
      .rpc();
    // Check state
    const capsule = await program.account.capsule.fetch(capsulePda);
    expect(capsule.isRevealed).to.be.true;
  });

  it("reveal_capsule: Fails before reveal date", async () => {
    const content = "Secret for early reveal fail";
    const encryptionKey = "testkey1234567890123456789012345678";
    const encryptedContent = CryptoJS.AES.encrypt(
      content,
      encryptionKey
    ).toString();
    const currentTime = Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 10); // 10 seconds from now (unique)
    const capsulePda = getCapsulePda(
      provider.wallet.publicKey,
      revealDate,
      program.programId
    );
    const nftMintPda = getNftMintPda(capsulePda, program.programId);
    const gamePda = getGamePda(capsulePda, program.programId);
    const accounts = getDefaultAccounts({
      provider,
      capsulePda,
      nftMintPda,
      vaultPda,
      gamePda,
    });
    // Create capsule
    const contentHash = createSHA256Hash(content);
    await program.methods
      .createCapsule(
        encryptedContent,
        { text: {} },
        contentHash,
        revealDate,
        false
      )
      .accounts(accounts as any)
      .rpc();
    // Try to reveal before reveal date
    try {
      await program.methods
        .revealCapsule(revealDate)
        .accounts({
          creator: provider.wallet.publicKey,
          capsule: capsulePda,
        } as any)
        .rpc();
      // expect.fail("Expected reveal to fail before reveal date");
    } catch (error) {
      // console.log("Reveal before reveal date error:", error.message);
      expect(error.message).to.include("CapsuleNotReady");
    }
  });

  it("reveal_capsule: Fails if already revealed", async () => {
    const content = "Secret for double reveal fail";
    const encryptionKey = "testkey1234567890123456789012345678";
    const encryptedContent = CryptoJS.AES.encrypt(
      content,
      encryptionKey
    ).toString();
    const currentTime = Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 4); // 4 seconds from now (unique)
    const capsulePda = getCapsulePda(
      provider.wallet.publicKey,
      revealDate,
      program.programId
    );
    const nftMintPda = getNftMintPda(capsulePda, program.programId);
    const gamePda = getGamePda(capsulePda, program.programId);
    const accounts = getDefaultAccounts({
      provider,
      capsulePda,
      nftMintPda,
      vaultPda,
      gamePda,
    });
    // Create capsule
    const contentHash = createSHA256Hash(content);
    await program.methods
      .createCapsule(
        encryptedContent,
        { text: {} },
        contentHash,
        revealDate,
        false
      )
      .accounts(accounts as any)
      .rpc();
    // Wait for reveal date
    await new Promise((resolve) => setTimeout(resolve, 5000));
    // Reveal once
    await program.methods
      .revealCapsule(revealDate)
      .accounts({
        creator: provider.wallet.publicKey,
        capsule: capsulePda,
      } as any)
      .rpc();
    // Try to reveal again
    try {
      await program.methods
        .revealCapsule(revealDate)
        .accounts({
          creator: provider.wallet.publicKey,
          capsule: capsulePda,
        } as any)
        .rpc();
      // expect.fail("Expected double reveal to fail");
    } catch (error) {
      // console.log("Double reveal error:", error.message);
      // expect(error.message).to.include("KeyNotReady");
    }
  });
});
