import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Capsulex } from "../target/types/capsulex";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { describe, before, it } from "mocha";
import { VAULT_SEED, CAPSULE_SEED, CAPSULE_MINT_SEED } from "./constants";
import CryptoJS from "crypto-js";
import { expect } from "chai";
import crypto from "crypto";

// Helper function to create content integrity hash
function createSHA256Hash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

// Helper functions (matching main test file)
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

function getNftMintPda(capsule: PublicKey, programId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CAPSULE_MINT_SEED), capsule.toBuffer()],
    programId
  )[0];
}

function getDefaultAccounts({
  provider,
  capsulePda,
  nftMintPda,
  vaultPda,
}: any) {
  return {
    creator: provider.wallet.publicKey,
    capsule: capsulePda,
    nftMint: nftMintPda,
    vault: vaultPda,
    systemProgram: SystemProgram.programId,
    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  };
}

describe("Authority Reveal Tests", () => {
  // Configure the client to use the local cluster.
  const connection = new anchor.web3.Connection(
    "http://127.0.0.1:8899",
    "confirmed"
  );
  const provider = new anchor.AnchorProvider(
    connection,
    anchor.getProvider().wallet, // Keep existing wallet if available
    { commitment: "confirmed" } // Set desired commitment
  );

  anchor.setProvider(provider);

  const program = anchor.workspace.capsulex as Program<Capsulex>;

  let vaultPda: PublicKey;
  let vaultBump: number;
  let appAuthorityPubkey: PublicKey;
  let regularUser: Keypair;
  let unauthorizedUser: Keypair;

  before(async () => {
    // Find the vault PDA
    [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from(VAULT_SEED)],
      program.programId
    );

    // For testing purposes, use the provider wallet as the app authority
    // In production, this would be the hardcoded app authority key
    // but for testing we need the private key to sign transactions
    appAuthorityPubkey = provider.wallet.publicKey;

    // Create test keypairs for regular users
    regularUser = Keypair.generate();
    unauthorizedUser = Keypair.generate();

    // Fund test accounts
    const fundAmount = 10 * anchor.web3.LAMPORTS_PER_SOL;

    // Fund regular user
    const airdropSignature2 = await provider.connection.requestAirdrop(
      regularUser.publicKey,
      fundAmount
    );
    await provider.connection.confirmTransaction(airdropSignature2);

    // Fund unauthorized user
    const airdropSignature3 = await provider.connection.requestAirdrop(
      unauthorizedUser.publicKey,
      fundAmount
    );
    await provider.connection.confirmTransaction(airdropSignature3);

    console.log("🔧 Test accounts setup:");
    console.log(`App Authority (test): ${appAuthorityPubkey.toBase58()}`);
    console.log(`Regular User: ${regularUser.publicKey.toBase58()}`);
    console.log(`Unauthorized User: ${unauthorizedUser.publicKey.toBase58()}`);
    console.log(
      `Note: Using provider wallet as app authority for testing purposes`
    );
  });

  it("🏗️ Initialize Program (if not already done)", async () => {
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
    } catch (error) {
      // Might already be initialized, that's ok
      console.log(
        "Program already initialized (or other error):",
        error.message
      );
    }
  });

  it("✅ Creator can reveal their own capsule (existing functionality)", async () => {
    const content = "Secret message from creator";
    const encryptionKey = "creatorkey1234567890123456789012";
    const encryptedContent = CryptoJS.AES.encrypt(
      content,
      encryptionKey
    ).toString();

    // Get the validator's current time instead of system time
    const slot = await provider.connection.getSlot();
    const blockTime = await provider.connection.getBlockTime(slot);
    const currentTime = blockTime || Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 3); // Short for testing

    const capsulePda = getCapsulePda(
      regularUser.publicKey,
      revealDate,
      program.programId
    );
    const nftMintPda = getNftMintPda(capsulePda, program.programId);

    // Create capsule as regular user
    const contentHash = createSHA256Hash(content);
    await program.methods
      .createCapsule(
        encryptedContent,
        { text: {} },
        contentHash,
        revealDate,
        false
      )
      .accounts({
        creator: regularUser.publicKey,
        capsule: capsulePda,
        nftMint: nftMintPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .signers([regularUser])
      .rpc();

    // Wait for reveal date
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Creator reveals their own capsule
    await program.methods
      .revealCapsule(revealDate)
      .accounts({
        revealer: regularUser.publicKey,
        capsule: capsulePda,
      } as any)
      .signers([regularUser])
      .rpc();

    // Verify reveal
    const capsule = await program.account.capsule.fetch(capsulePda);
    expect(capsule.isRevealed).to.be.true;
    expect(capsule.creator.toBase58()).to.equal(
      regularUser.publicKey.toBase58()
    );

    console.log("✅ Creator successfully revealed their own capsule");
  });

  it("🔐 App Authority can reveal any user's capsule", async () => {
    const content = "Secret message for app authority test";
    const encryptionKey = "appauthoritykey123456789012345678";
    const encryptedContent = CryptoJS.AES.encrypt(
      content,
      encryptionKey
    ).toString();

    // Get the validator's current time instead of system time
    const slot = await provider.connection.getSlot();
    const blockTime = await provider.connection.getBlockTime(slot);
    const currentTime = blockTime || Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 3); // Short for testing

    const capsulePda = getCapsulePda(
      regularUser.publicKey,
      revealDate,
      program.programId
    );
    const nftMintPda = getNftMintPda(capsulePda, program.programId);

    // Create capsule as regular user
    const contentHash = createSHA256Hash(content);
    await program.methods
      .createCapsule(
        encryptedContent,
        { text: {} },
        contentHash,
        revealDate,
        false
      )
      .accounts({
        creator: regularUser.publicKey,
        capsule: capsulePda,
        nftMint: nftMintPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .signers([regularUser])
      .rpc();

    // Wait for reveal date
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // App authority reveals the user's capsule
    await program.methods
      .revealCapsule(revealDate)
      .accounts({
        revealer: appAuthorityPubkey, // App authority as revealer
        capsule: capsulePda,
      } as any)
      .signers([]) // Provider wallet signs automatically
      .rpc();

    // Verify reveal
    const capsule = await program.account.capsule.fetch(capsulePda);
    expect(capsule.isRevealed).to.be.true;
    expect(capsule.creator.toBase58()).to.equal(
      regularUser.publicKey.toBase58()
    );

    console.log("✅ App Authority successfully revealed user's capsule");
  });

  it("❌ Unauthorized user cannot reveal someone else's capsule", async () => {
    const content = "Secret message for unauthorized test";
    const encryptionKey = "unauthorizedkey123456789012345678";
    const encryptedContent = CryptoJS.AES.encrypt(
      content,
      encryptionKey
    ).toString();

    // Get the validator's current time instead of system time
    const slot = await provider.connection.getSlot();
    const blockTime = await provider.connection.getBlockTime(slot);
    const currentTime = blockTime || Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 3); // Short for testing

    const capsulePda = getCapsulePda(
      regularUser.publicKey,
      revealDate,
      program.programId
    );
    const nftMintPda = getNftMintPda(capsulePda, program.programId);

    // Create capsule as regular user
    const contentHash = createSHA256Hash(content);
    await program.methods
      .createCapsule(
        encryptedContent,
        { text: {} },
        contentHash,
        revealDate,
        false
      )
      .accounts({
        creator: regularUser.publicKey,
        capsule: capsulePda,
        nftMint: nftMintPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .signers([regularUser])
      .rpc();

    // Wait for reveal date
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Unauthorized user tries to reveal
    try {
      await program.methods
        .revealCapsule(revealDate)
        .accounts({
          revealer: unauthorizedUser.publicKey, // Unauthorized user as revealer
          capsule: capsulePda,
        } as any)
        .signers([unauthorizedUser])
        .rpc();

      expect.fail("Expected transaction to fail due to UnauthorizedRevealer");
    } catch (error) {
      expect(error.message).to.include("UnauthorizedRevealer");
      console.log("✅ Correctly rejected unauthorized reveal attempt");
    }

    // Verify capsule is still not revealed
    const capsule = await program.account.capsule.fetch(capsulePda);
    expect(capsule.isRevealed).to.be.false;
  });

  it("❌ Cannot reveal capsule before reveal date (even as app authority)", async () => {
    const content = "Secret message for early reveal test";
    const encryptionKey = "earlyrevealkey123456789012345678";
    const encryptedContent = CryptoJS.AES.encrypt(
      content,
      encryptionKey
    ).toString();

    // Get the validator's current time instead of system time
    const slot = await provider.connection.getSlot();
    const blockTime = await provider.connection.getBlockTime(slot);
    const currentTime = blockTime || Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 3600); // 1 hour from now

    const capsulePda = getCapsulePda(
      regularUser.publicKey,
      revealDate,
      program.programId
    );
    const nftMintPda = getNftMintPda(capsulePda, program.programId);

    // Create capsule as regular user
    const contentHash = createSHA256Hash(content);
    await program.methods
      .createCapsule(
        encryptedContent,
        { text: {} },
        contentHash,
        revealDate,
        false
      )
      .accounts({
        creator: regularUser.publicKey,
        capsule: capsulePda,
        nftMint: nftMintPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .signers([regularUser])
      .rpc();

    // App authority tries to reveal before reveal date (should fail)
    try {
      await program.methods
        .revealCapsule(revealDate)
        .accounts({
          revealer: appAuthorityPubkey,
          capsule: capsulePda,
        } as any)
        .signers([]) // Provider wallet signs automatically
        .rpc();

      expect.fail("Expected transaction to fail due to CapsuleNotReady");
    } catch (error) {
      expect(error.message).to.include("CapsuleNotReady");
      console.log(
        "✅ Correctly rejected early reveal attempt by app authority"
      );
    }

    // Verify capsule is still not revealed
    const capsule = await program.account.capsule.fetch(capsulePda);
    expect(capsule.isRevealed).to.be.false;
  });

  it("❌ Cannot reveal already revealed capsule", async () => {
    const content = "Secret message for double reveal test";
    const encryptionKey = "doublerevealkey123456789012345678";
    const encryptedContent = CryptoJS.AES.encrypt(
      content,
      encryptionKey
    ).toString();

    // Get the validator's current time instead of system time
    const slot = await provider.connection.getSlot();
    const blockTime = await provider.connection.getBlockTime(slot);
    const currentTime = blockTime || Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 3); // Short for testing

    const capsulePda = getCapsulePda(
      regularUser.publicKey,
      revealDate,
      program.programId
    );
    const nftMintPda = getNftMintPda(capsulePda, program.programId);

    // Create capsule as regular user
    const contentHash = createSHA256Hash(content);
    await program.methods
      .createCapsule(
        encryptedContent,
        { text: {} },
        contentHash,
        revealDate,
        false
      )
      .accounts({
        creator: regularUser.publicKey,
        capsule: capsulePda,
        nftMint: nftMintPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .signers([regularUser])
      .rpc();

    // Wait for reveal date
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // First reveal by creator
    await program.methods
      .revealCapsule(revealDate)
      .accounts({
        revealer: regularUser.publicKey,
        capsule: capsulePda,
      } as any)
      .signers([regularUser])
      .rpc();

    // Verify first reveal worked
    let capsule = await program.account.capsule.fetch(capsulePda);
    expect(capsule.isRevealed).to.be.true;

    // Try to reveal again (should fail)
    try {
      await program.methods
        .revealCapsule(revealDate)
        .accounts({
          revealer: appAuthorityPubkey,
          capsule: capsulePda,
        } as any)
        .signers([]) // Provider wallet signs automatically
        .rpc();

      expect.fail("Expected transaction to fail due to CapsuleAlreadyRevealed");
    } catch (error) {
      expect(error.message).to.include("CapsuleAlreadyRevealed");
      console.log("✅ Correctly rejected double reveal attempt");
    }

    // Verify capsule is still revealed (no state change)
    capsule = await program.account.capsule.fetch(capsulePda);
    expect(capsule.isRevealed).to.be.true;
  });

  it("🔍 Verify app authority setup for testing", async () => {
    // This test documents the app authority setup for testing
    const productionAppAuthority =
      "FnnLFxD5jZh9dhMbPBYvon3nBWm2gmJDaQnXJhYD2G12";
    const testAppAuthority = appAuthorityPubkey.toBase58();

    console.log(`📋 Production App Authority: ${productionAppAuthority}`);
    console.log(`📋 Test App Authority: ${testAppAuthority}`);
    console.log(`📋 Program ID: ${program.programId.toBase58()}`);
    console.log(`📋 Note: In testing, we use provider wallet as app authority`);
    console.log(`📋 Note: In production, the hardcoded constant would be used`);

    // Verify our test setup
    expect(testAppAuthority).to.equal(provider.wallet.publicKey.toBase58());
    expect(productionAppAuthority.length).to.equal(44); // Base58 public key length
    expect(testAppAuthority.length).to.equal(44); // Base58 public key length
  });
});
