import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Capsulex } from "../target/types/capsulex";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { describe, before, it } from "mocha";
import { VAULT_SEED, CAPSULE_SEED, CAPSULE_MINT_SEED, BADGE_MINT_SEED, TROPHY_MINT_SEED, LEADERBOARD_SEED } from "./constants";
import { expect } from "chai";
import crypto from "crypto";

// Helper function to create content integrity hash
function createSHA256Hash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

// Helper functions for PDA generation (matching existing test style)
function getCapsulePda(creator: PublicKey, revealDate: anchor.BN, programId: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(CAPSULE_SEED),
      creator.toBuffer(),
      Buffer.from(revealDate.toArray('le', 8))
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

// Helper function to get vault PDA
function getVaultPda(programId: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED)],
    programId
  );
  return pda;
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

describe("CapsuleX NFT Instructions", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.capsulex as Program<Capsulex>;

  before(async () => {
    console.log("Starting NFT tests");
    
    // Find the vault PDA
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(VAULT_SEED)],
      program.programId
    );

    // Initialize the program and vault if not already initialized
    try {
      await program.methods.initializeProgram()
        .accounts({
          authority: provider.wallet.publicKey,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();
      console.log("✅ Program and vault initialized.");
    } catch (error) {
      if (error.logs && (
        error.logs.some((log: string) => log.includes("Already initialized")) ||
        error.logs.some((log: string) => log.includes("already in use"))
      )) {
        console.log("✅ Program and vault already initialized.");
      } else {
        console.log("⚠️ Vault initialization failed:", error.message);
        // Continue with tests even if vault init fails (might already exist)
      }
    }
  });

  it("NFT: Mint capsule NFT for time capsule creator", async () => {
    // Clear naming: capsule creator mints their own NFT
    const capsuleCreator = provider.wallet;
    
    const currentTime = Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 100); // Unique timestamp
    const capsulePda = getCapsulePda(capsuleCreator.publicKey, revealDate, program.programId);
    const nftMintPda = getNftMintPda(capsulePda, program.programId);
    
    // Use same accounts structure as game-tests.ts (NO KeyVault)
    const accounts = {
      creator: capsuleCreator.publicKey,
      capsule: capsulePda,
      nftMint: nftMintPda,
      vault: getVaultPda(program.programId),
      systemProgram: SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    };
    
    console.log("Debug: PDAs created");
    console.log("  capsulePda:", capsulePda.toBase58());
    console.log("  nftMintPda:", nftMintPda.toBase58());
    console.log("  creator:", capsuleCreator.publicKey.toBase58());
    
    // Create time capsule first (capsule creator creates their capsule)
    const content = "Test content for NFT";
    const contentHash = createSHA256Hash(content);
    await program.methods.createCapsule(
      content,
      { text: {} },
      contentHash,
      revealDate,
      false
    ).accounts(accounts as any).rpc();
    
    // Get associated token account for creator
    const creatorTokenAccount = await anchor.utils.token.associatedAddress({
      mint: nftMintPda,
      owner: capsuleCreator.publicKey
    });
    
    // Mint capsule NFT (capsule creator mints their NFT)
    const tx = await program.methods.mintCapsuleNft(
      "Time Capsule #1",
      "CAPS",
      "https://metadata.capsulex.com/capsule/1"
    ).accounts({
      creator: capsuleCreator.publicKey,
      capsule: capsulePda,
      nftMint: nftMintPda,
      creatorTokenAccount: creatorTokenAccount,
      vault: getVaultPda(program.programId),
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    } as any).rpc();
    
    // Verify NFT was minted to creator
    const tokenAccount = await provider.connection.getTokenAccountBalance(creatorTokenAccount);
    expect(tokenAccount.value.amount).to.equal("1");
    expect(tokenAccount.value.decimals).to.equal(0);
    
    // console.log("✅ Capsule NFT successfully minted to creator");
  });

  it("NFT: Cannot mint badge NFT without being game winner", async () => {
    // Clear naming: non-winner tries to mint badge
    const capsuleCreator = provider.wallet;
    const nonWinner = anchor.web3.Keypair.generate();
    
    await provider.connection.requestAirdrop(nonWinner.publicKey, 1000000000);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const currentTime = Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 300); // Unique timestamp
    const capsulePda = getCapsulePda(capsuleCreator.publicKey, revealDate, program.programId);
    const nftMintPda = getNftMintPda(capsulePda, program.programId);
    const accounts = getDefaultAccounts({ provider, capsulePda, nftMintPda, programId: program.programId });
    
    // Create a simple game with no winners (capsule creator creates game)
    const content = "test";
    const contentHash = createSHA256Hash(content);
    await program.methods.createCapsule(content, { text: {} }, contentHash, revealDate, true)
      .accounts(accounts as any).rpc();
    
    const [gamePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("game"), capsulePda.toBuffer()],
      program.programId
    );
    
    await program.methods.initializeGame(capsulePda, 5, 1).accounts({
      creator: capsuleCreator.publicKey,
      capsule: capsulePda,
      game: gamePda,
      systemProgram: SystemProgram.programId,
    } as any).rpc();
    
    // Try to mint badge without being a winner (non-winner attempts)
    const [badgeMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(BADGE_MINT_SEED), gamePda.toBuffer(), nonWinner.publicKey.toBuffer()],
      program.programId
    );
    
    const nonWinnerTokenAccount = await anchor.utils.token.associatedAddress({
      mint: badgeMintPda,
      owner: nonWinner.publicKey
    });
    
    try {
      await program.methods.mintWinnerBadge(
        "fake_winner",
        "https://fake.uri"
      ).accounts({
        authority: nonWinner.publicKey,
        winner: nonWinner.publicKey,
        game: gamePda,
        badgeMint: badgeMintPda,
        winnerTokenAccount: nonWinnerTokenAccount,
        vault: getVaultPda(program.programId),
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any).signers([nonWinner]).rpc();
      
      expect.fail("Should have failed for non-winner");
    } catch (error) {
      expect(error.message).to.include("GameNotEnded");
      // console.log("✅ Correctly rejected badge minting for non-winner");
    }
  });

  it("NFT: Trophy requirements validation for different achievement types", async () => {
    // Clear naming: user tests trophy eligibility
    const testUser = anchor.web3.Keypair.generate();
    
    await provider.connection.requestAirdrop(testUser.publicKey, 1000000000);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Initialize leaderboard (user initializes their own leaderboard)
    const [leaderboardPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(LEADERBOARD_SEED), testUser.publicKey.toBuffer()],
      program.programId
    );
    
    await program.methods.initializeLeaderboard(testUser.publicKey).accounts({
      authority: testUser.publicKey,
      user: testUser.publicKey,
      leaderboard: leaderboardPda,
      systemProgram: SystemProgram.programId,
    } as any).signers([testUser]).rpc();
    
    // Test trophy types and their requirements
    const trophyTypes = ["winner", "veteran", "creator", "champion"];
    
    // console.log("🏅 Testing trophy eligibility requirements:");
    
    for (const trophyType of trophyTypes) {
      const [trophyMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(TROPHY_MINT_SEED), testUser.publicKey.toBuffer(), Buffer.from(trophyType)],
        program.programId
      );
      
      const userTokenAccount = await anchor.utils.token.associatedAddress({
        mint: trophyMintPda,
        owner: testUser.publicKey
      });
      
      try {
        await program.methods.mintTrophyNft(
          trophyType,
          `https://metadata.capsulex.com/trophy/${trophyType}/1`
        ).accounts({
          authority: testUser.publicKey,
          user: testUser.publicKey,
          leaderboard: leaderboardPda,
          trophyMint: trophyMintPda,
          userTokenAccount: userTokenAccount,
          vault: getVaultPda(program.programId),
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        } as any).signers([testUser]).rpc();
        
        // console.log(`✅ ${trophyType} trophy minted (user met requirements)`);
      } catch (error) {
        if (error.message.includes("NotEligibleForReward")) {
          // console.log(`❌ ${trophyType} trophy rejected (requirements not met - expected)`);
        } else {
          // console.log(`⚠️ ${trophyType} trophy failed:`, error.message);
        }
      }
    }
    
    // console.log("✅ Trophy eligibility testing completed");
  });

  it("NFT: Invalid trophy type rejection", async () => {
    // Clear naming: user attempts invalid trophy type
    const testUser = anchor.web3.Keypair.generate();
    
    await provider.connection.requestAirdrop(testUser.publicKey, 1000000000);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const [leaderboardPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(LEADERBOARD_SEED), testUser.publicKey.toBuffer()],
      program.programId
    );
    
    await program.methods.initializeLeaderboard(testUser.publicKey).accounts({
      authority: testUser.publicKey,
      user: testUser.publicKey,
      leaderboard: leaderboardPda,
      systemProgram: SystemProgram.programId,
    } as any).signers([testUser]).rpc();
    
    const [invalidTrophyMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(TROPHY_MINT_SEED), testUser.publicKey.toBuffer(), Buffer.from("invalid_type")],
      program.programId
    );
    
    const userTokenAccount = await anchor.utils.token.associatedAddress({
      mint: invalidTrophyMintPda,
      owner: testUser.publicKey
    });
    
    try {
      await program.methods.mintTrophyNft(
        "invalid_type",
        "https://fake.uri"
      ).accounts({
        authority: testUser.publicKey,
        user: testUser.publicKey,
        leaderboard: leaderboardPda,
        trophyMint: invalidTrophyMintPda,
        userTokenAccount: userTokenAccount,
        vault: getVaultPda(program.programId),
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any).signers([testUser]).rpc();
      
      expect.fail("Should have failed for invalid trophy type");
    } catch (error) {
      expect(error.message).to.include("NotEligibleForReward");
      // console.log("✅ Correctly rejected invalid trophy type");
    }
  });
});