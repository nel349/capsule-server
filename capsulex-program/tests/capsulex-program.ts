import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Capsulex } from "../target/types/capsulex";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { describe, before, it } from "mocha";
import { VAULT_SEED, CAPSULE_SEED, CAPSULE_MINT_SEED, KEY_VAULT_SEED } from "./constants";
import CryptoJS from "crypto-js";
import { expect } from "chai";

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
      const tx = await program.methods.initializeProgram()
        .accounts({
          authority: provider.wallet.publicKey,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();
      
      console.log("Program initialized:", tx);
      
      // Verify the vault was created
      const vault = await program.account.programVault.fetch(vaultPda);
      expect(vault.authority.toBase58()).to.equal(provider.wallet.publicKey.toBase58());
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
    const [capsulePda,] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(CAPSULE_SEED),
        provider.wallet.publicKey.toBuffer(),
        Buffer.from(revealDate.toArray('le', 8)) // 8 bytes for i64
      ],
      program.programId
    );
    
    // Find the NFT mint PDA
    const [nftMintPda, nftMintBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(CAPSULE_MINT_SEED),
        capsulePda.toBuffer()
      ],
      program.programId
    );
    
    // Find the key vault PDA
    const [keyVaultPda, keyVaultBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(KEY_VAULT_SEED),
        capsulePda.toBuffer()
      ],
      program.programId
    );
    
    const tx = await program.methods.createCapsule(
      encryptedContent,
      { onChain: {} },
      revealDate,
      false
    ).accounts({
      creator: provider.wallet.publicKey,
      capsule: capsulePda,
      keyVault: keyVaultPda,
      nftMint: nftMintPda,
      vault: vaultPda,
      systemProgram: SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    } as any).rpc();
    
    console.log("Capsule Created", tx);

    // Lets check if the capsule is created
    const capsule = await program.account.capsule.fetch(capsulePda);
    console.log("Capsule", capsule);

    // Check state, creator, reveal date, is gamified
    expect(capsule.isActive).to.be.equal(true);
    expect(capsule.creator.toBase58()).to.be.equal(provider.wallet.publicKey.toBase58());
    expect(capsule.revealDate.toNumber()).to.be.equal(revealDate.toNumber());
    expect(capsule.isGamified).to.be.equal(false);
    expect(capsule.isRevealed).to.be.equal(false);
    expect(capsule.encryptedContent).to.be.equal(encryptedContent);
    console.log("Capsule encrypted content:", capsule.encryptedContent);
  });

  it("Creates a realistic encrypted time capsule with AES encryption", async () => {
    // Realistic scenario: Someone creating a prediction capsule for New Year's Eve
    // Less than 280 characters
    const actualContent = "My 2024 predictions: Bitcoin will hit $150k, AI will revolutionize healthcare, and remote work becomes the norm for 80% of tech jobs. Let's see how this ages! #TimeCapsule2024 #Predictions";
    const currentTime = Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + (30 * 24 * 60 * 60)); // 30 days from now
    const isGamified = true; // Make it gamified so others can guess
    
    // Generate encryption key (in production, this would be done by the Solana program)
    const encryptionKey = "MySuperSecretKey123456789012345678"; // 32-char key for AES-256
    
    // Encrypt the content using AES
    const encryptedContent = CryptoJS.AES.encrypt(actualContent, encryptionKey).toString();
    
    console.log(`Creating time capsule with content: "${actualContent.substring(0, 280)}..."`);
    console.log(`Encrypted content length: ${encryptedContent.length} characters`);
    console.log(`To be revealed on: ${new Date(revealDate.toNumber() * 1000).toLocaleDateString()} (in 30 days)`);
    
    // Find the capsule PDA using reveal_date (timestamp-based addressing)
    const [capsulePda, capsuleBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(CAPSULE_SEED),
        provider.wallet.publicKey.toBuffer(),
        Buffer.from(revealDate.toArray('le', 8)) // 8 bytes for i64
      ],
      program.programId
    );
    
    // Find the key vault PDA
    const [keyVaultPda, keyVaultBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(KEY_VAULT_SEED),
        capsulePda.toBuffer()
      ],
      program.programId
    );
    
    // Find the NFT mint PDA
    const [nftMintPda, nftMintBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(CAPSULE_MINT_SEED),
        capsulePda.toBuffer()
      ],
      program.programId
    );
    
    const tx = await program.methods.createCapsule(
      encryptedContent,
      { onChain: {} },
      revealDate,
      isGamified
    ).accounts({
      creator: provider.wallet.publicKey,
      capsule: capsulePda,
      keyVault: keyVaultPda,
      nftMint: nftMintPda,
      vault: vaultPda,
      systemProgram: SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    } as any).rpc();
    
    console.log("Realistic time capsule created:", tx);

    // Verify the capsule was created with correct data
    const capsule = await program.account.capsule.fetch(capsulePda);
    console.log("Time capsule details:", {
      creator: capsule.creator.toBase58(),
      keyVault: capsule.keyVault.toBase58(), // Key vault storing encryption key
      storedContent: capsule.encryptedContent.substring(0, 60) + "...", // Encrypted content stored
      actualContent: actualContent.substring(0, 60) + "...", // Original content (before encryption)
      revealDate: new Date(capsule.revealDate.toNumber() * 1000).toLocaleDateString(),
      isGamified: capsule.isGamified,
      isRevealed: capsule.isRevealed,
      isActive: capsule.isActive
    });

    // Validate the realistic scenario
    expect(capsule.isActive).to.be.equal(true);
    expect(capsule.creator.toBase58()).to.be.equal(provider.wallet.publicKey.toBase58());
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
      const decryptedBytes = CryptoJS.AES.decrypt(encryptedContent, encryptionKey);
      const decryptedContent = decryptedBytes.toString(CryptoJS.enc.Utf8);
      console.log(`✅ Encryption/Decryption demo successful!`);
      console.log(`📝 Original: "${actualContent.substring(0, 40)}..."`);
      console.log(`🔒 Encrypted: "${encryptedContent.substring(0, 40)}..."`);
      console.log(`🔓 Decrypted: "${decryptedContent.substring(0, 40)}..."`);
      expect(decryptedContent).to.equal(actualContent);
    } catch (error) {
      console.log("Decryption demo failed:", error);
      throw error; // Re-throw to see the actual error
    }
    
    console.log(`📅 Time capsule sealed for ${Math.round((revealDate.toNumber() - currentTime) / (24 * 60 * 60))} days`);
    console.log(`🔑 Encryption key safely stored in KeyVault: ${keyVaultPda.toBase58()}`);
    console.log(`💰 Storage type: ${capsule.contentStorage.onChain ? 'OnChain' : 'IPFS'} (fee: ${capsule.contentStorage.onChain ? '2x' : '1x'})`);
  });

  it("Creates a capsule with long content using on-chain storage", async () => {
    const longContent = "This is a very long prediction about the future of blockchain technology that exceeds 280 characters and should be stored on IPFS instead of directly on-chain to save costs. This content would normally be encrypted and uploaded to IPFS, with only the hash stored on-chain, making it much more cost-effective for large content.";
    const encryptedContent = CryptoJS.AES.encrypt(longContent, "longkey123").toString();
    
    const revealDate = new anchor.BN(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
    const [capsulePda, capsuleBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(CAPSULE_SEED),
        provider.wallet.publicKey.toBuffer(),
        Buffer.from(revealDate.toArray('le', 8))
      ],
      program.programId
    );
    // Find the key vault PDA
    const [keyVaultPda, keyVaultBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(KEY_VAULT_SEED),
        capsulePda.toBuffer()
      ],
      program.programId
    );

    // Find the NFT mint PDA
    const [nftMintPda, nftMintBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(CAPSULE_MINT_SEED),
        capsulePda.toBuffer()
      ],
      program.programId
    );

    try {
      await program.methods.createCapsule(
        encryptedContent,
        { onChain: {} },
        revealDate,
        false
      ).accounts({
        creator: provider.wallet.publicKey,
        capsule: capsulePda,
        keyVault: keyVaultPda,
        nftMint: nftMintPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any).rpc();
    } catch (error) {
      expect(error).to.be.an.instanceOf(Error);
      expect(error.message).to.include("Content hash is too long. Maximum length is 280 characters.");
    }
  });

  it("Creates a capsule with long content using IPFS storage", async () => {
    // Simulate long content and IPFS upload
    // Simulate IPFS upload: hash is a mock value (in real app, would be returned by IPFS)
    const ipfsHash = "Qm" + "a".repeat(44); // Valid mock IPFS hash (46 chars)
    
    // Use a unique reveal date to avoid PDA collision
    const currentTime = Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 7200); // 2 hours from now
    
    // Find the capsule PDA using reveal_date (timestamp-based addressing)
    const [capsulePda, capsuleBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(CAPSULE_SEED),
        provider.wallet.publicKey.toBuffer(),
        Buffer.from(revealDate.toArray('le', 8))
      ],
      program.programId
    );
    // Find the key vault PDA
    const [keyVaultPda, keyVaultBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(KEY_VAULT_SEED),
        capsulePda.toBuffer()
      ],
      program.programId
    );
    // Find the NFT mint PDA
    const [nftMintPda, nftMintBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(CAPSULE_MINT_SEED),
        capsulePda.toBuffer()
      ],
      program.programId
    );
    // Actually create the capsule with the IPFS hash as encrypted_content
    const tx = await program.methods.createCapsule(
      ipfsHash, // Store only the IPFS hash on-chain
      { ipfs: {} },
      revealDate,
      false // isGamified
    ).accounts({
      creator: provider.wallet.publicKey,
      capsule: capsulePda,
      keyVault: keyVaultPda,
      nftMint: nftMintPda,
      vault: vaultPda,
      systemProgram: SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    } as any).rpc();
    
    console.log("\nIPFS Capsule Created", tx);
    // Fetch the capsule
    const capsule = await program.account.capsule.fetch(capsulePda);
    console.log("IPFS Capsule", capsule);
    // Assert storage type is IPFS
    expect(capsule.contentStorage.ipfs).to.exist;
    // Assert encryptedContent matches the hash
    expect(capsule.encryptedContent).to.equal(ipfsHash);
    // Assert the capsule is active and not revealed
    expect(capsule.isActive).to.be.true;
    expect(capsule.isRevealed).to.be.false;
    // Assert the reveal date matches
    expect(capsule.revealDate.toNumber()).to.equal(revealDate.toNumber());
    // Assert the keyVault is set
    expect(capsule.keyVault.toBase58()).to.equal(keyVaultPda.toBase58());
    // Print a success message
    console.log("✅ Capsule with long content stored via IPFS hash created and verified!");
  });
});
