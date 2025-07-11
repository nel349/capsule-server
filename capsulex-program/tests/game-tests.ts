import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Capsulex } from "../target/types/capsulex";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { describe, before, it } from "mocha";
import { VAULT_SEED, CAPSULE_SEED, CAPSULE_MINT_SEED } from "./constants";
import CryptoJS from "crypto-js";
import { expect } from "chai";

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

// KeyVault removed - no longer needed
// function getKeyVaultPda(capsule: PublicKey, programId: PublicKey) {
//   const [pda] = PublicKey.findProgramAddressSync(
//     [Buffer.from(KEY_VAULT_SEED), capsule.toBuffer()],
//     programId
//   );
//   return pda;
// }

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

describe("CapsuleX Game Instructions", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.capsulex as Program<Capsulex>;

  before(async () => {
    console.log("Starting tests with device-side encryption");
    
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

  it("Game: Initialize game with correct parameters", async () => {
    // Clear naming: capsule creator vs game player/guesser
    const capsuleCreator = provider.wallet; // Use provider wallet as capsule creator
    
    const currentTime = Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 100); // Unique timestamp
    const capsulePda = getCapsulePda(capsuleCreator.publicKey, revealDate, program.programId);
    const nftMintPda = getNftMintPda(capsulePda, program.programId);
    const accounts = {
      creator: capsuleCreator.publicKey,
      capsule: capsulePda,
      nftMint: nftMintPda,
      vault: getVaultPda(program.programId),
      systemProgram: SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    };
    
    // Create gamified capsule first (capsule creator creates their capsule)
    await program.methods.createCapsule(
      "test content for game",
      { onChain: {} },
      revealDate,
      true // is_gamified
    ).accounts(accounts as any).rpc();
    
    // Initialize game
    const [gamePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("game"), capsulePda.toBuffer()],
      program.programId
    );
    
    // Initialize game (capsule creator initializes their game)
    await program.methods.initializeGame(
      capsulePda,
      50, // max_guesses (no more guess fees!)
      3 // max_winners
    ).accounts({
      creator: capsuleCreator.publicKey,
      capsule: capsulePda,
      game: gamePda,
      systemProgram: SystemProgram.programId,
    } as any).rpc();
    
    // Verify game initialization
    const game = await program.account.game.fetch(gamePda);
    expect(game.capsuleId.toBase58()).to.equal(capsulePda.toBase58());
    expect(game.creator.toBase58()).to.equal(capsuleCreator.publicKey.toBase58());
    expect(game.maxGuesses).to.equal(50);
    expect(game.isActive).to.be.true;
    expect(game.currentGuesses).to.equal(0);
    expect(game.totalParticipants).to.equal(0);
    expect(game.winnerFound).to.be.false;
    
    // console.log("✅ Game initialized successfully");
  });

  it("Game: Submit guesses with anonymity options", async () => {
    // Clear naming: capsule creator vs game player/guesser
    const capsuleCreator = provider.wallet; // Use provider wallet as capsule creator
    const gamePlayer = provider.wallet; // Same player for this test
    
    const currentTime = Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 200); // Unique timestamp
    const capsulePda = getCapsulePda(capsuleCreator.publicKey, revealDate, program.programId);
    const nftMintPda = getNftMintPda(capsulePda, program.programId);
    const accounts = {
      creator: capsuleCreator.publicKey,
      capsule: capsulePda,
      nftMint: nftMintPda,
      vault: getVaultPda(program.programId),
      systemProgram: SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    };
    
    // Create and initialize game (capsule creator creates capsule and game)
    await program.methods.createCapsule("test content", { onChain: {} }, revealDate, true).accounts(accounts as any).rpc();
    
    const [gamePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("game"), capsulePda.toBuffer()],
      program.programId
    );
    
    await program.methods.initializeGame(capsulePda,
       10, // max_guesses
        3
      ).accounts({
      creator: capsuleCreator.publicKey,
      capsule: capsulePda,
      game: gamePda,
      systemProgram: SystemProgram.programId,
    } as any).rpc();
    
    // Submit public guess (game player submits guess)
    const [freePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("guess"), gamePda.toBuffer(), gamePlayer.publicKey.toBuffer(), Buffer.from([0, 0, 0, 0])],
      program.programId
    );
    
    await program.methods.submitGuess("public guess", false).accounts({
      guesser: gamePlayer.publicKey,
      game: gamePda,
      guess: freePda,
      vault: getVaultPda(program.programId),
      systemProgram: SystemProgram.programId,
    } as any).rpc();
    
    // Submit anonymous guess (game player submits anonymous guess)
    const [paidPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("guess"), gamePda.toBuffer(), gamePlayer.publicKey.toBuffer(), Buffer.from([1, 0, 0, 0])],
      program.programId
    );
    
    await program.methods.submitGuess("anonymous guess", true).accounts({
      guesser: gamePlayer.publicKey,
      game: gamePda,
      guess: paidPda,
      vault: getVaultPda(program.programId),
      systemProgram: SystemProgram.programId,
    } as any).rpc();
    
    // Verify guess properties
    const publicGuess = await program.account.guess.fetch(freePda);
    expect(publicGuess.isPaid).to.be.true; // All guesses now pay service fee
    expect(publicGuess.isAnonymous).to.be.false;
    expect(publicGuess.guessContent).to.equal("public guess");
    
    const anonymousGuess = await program.account.guess.fetch(paidPda);
    expect(anonymousGuess.isPaid).to.be.true; // All guesses now pay service fee
    expect(anonymousGuess.isAnonymous).to.be.true;
    expect(anonymousGuess.guessContent).to.equal("anonymous guess");
    
    const game = await program.account.game.fetch(gamePda);
    expect(game.currentGuesses).to.equal(2);
    
    // console.log("✅ Guesses submitted with correct anonymity settings");
  });

  it("Game: Multiple users submit guesses", async () => {
    // Clear naming: capsule creator vs game players
    const capsuleCreator = provider.wallet; // Use provider wallet as capsule creator
    
    const currentTime = Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 300); // Unique timestamp
    const capsulePda = getCapsulePda(capsuleCreator.publicKey, revealDate, program.programId);
    const nftMintPda = getNftMintPda(capsulePda, program.programId);
    const accounts = {
      creator: capsuleCreator.publicKey,
      capsule: capsulePda,
      nftMint: nftMintPda,
      vault: getVaultPda(program.programId),
      systemProgram: SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    };
    
    // Create gamified capsule and game
    await program.methods.createCapsule("secret answer", { onChain: {} }, revealDate, true).accounts(accounts as any).rpc();
    
    const [gamePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("game"), capsulePda.toBuffer()],
      program.programId
    );
    
    await program.methods.initializeGame(capsulePda, 
      5, // max_guesses
      3 // max_winners
    ).accounts({
      creator: capsuleCreator.publicKey,
      capsule: capsulePda,
      game: gamePda,
      systemProgram: SystemProgram.programId,
    } as any).rpc();
    
    // Create multiple game players
    const gamePlayer1 = anchor.web3.Keypair.generate();
    const gamePlayer2 = anchor.web3.Keypair.generate();
    
    // Fund game players
    await provider.connection.requestAirdrop(gamePlayer1.publicKey, 1000000000); // 1 SOL
    await provider.connection.requestAirdrop(gamePlayer2.publicKey, 1000000000);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 
    
    // Game Player 1: Public guess (first guess, so current_guesses = 0)
    const [guess1Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("guess"), gamePda.toBuffer(), gamePlayer1.publicKey.toBuffer(), Buffer.from(new Uint32Array([0]).buffer)],
      program.programId
    );
    
    await program.methods.submitGuess(
      "wrong guess from gamePlayer1",
      false // is_anonymous (public)
    ).accounts({
      guesser: gamePlayer1.publicKey,
      game: gamePda,
      guess: guess1Pda,
      vault: getVaultPda(program.programId),
      systemProgram: SystemProgram.programId,
    } as any)
    .signers([gamePlayer1])
    .rpc();
    
    // Game Player 2: Anonymous guess (second guess, so current_guesses = 1)
    const [guess2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("guess"), gamePda.toBuffer(), gamePlayer2.publicKey.toBuffer(), Buffer.from(new Uint32Array([1]).buffer)],
      program.programId
    );
    
    await program.methods.submitGuess(
      "another wrong guess",
      true // is_anonymous
    ).accounts({
      guesser: gamePlayer2.publicKey,
      game: gamePda,
      guess: guess2Pda,
      vault: getVaultPda(program.programId),
      systemProgram: SystemProgram.programId,
    } as any)
    .signers([gamePlayer2])
    .rpc();
    
    // Verify game state
    const game = await program.account.game.fetch(gamePda);
    expect(game.currentGuesses).to.equal(2);
    // expect(game.totalFeesCollected.toNumber()).to.equal(20000); // 2 paid guesses * 10000 fee each
    
    // Verify individual guesses
    const guess1 = await program.account.guess.fetch(guess1Pda);
    expect(guess1.guesser.toBase58()).to.equal(gamePlayer1.publicKey.toBase58());
    expect(guess1.isPaid).to.be.true;
    expect(guess1.isAnonymous).to.be.false;
    
    const guess2 = await program.account.guess.fetch(guess2Pda);
    expect(guess2.guesser.toBase58()).to.equal(gamePlayer2.publicKey.toBase58());
    expect(guess2.isPaid).to.be.true;
    expect(guess2.isAnonymous).to.be.true;
    
    // console.log("✅ Multiple users submitted guesses successfully");
  });

  it("Game: Verify guess after capsule reveal (delayed verification)", async () => {
    // Clear naming: capsule creator vs game player/guesser
    const capsuleCreator = provider.wallet; // Use provider wallet as capsule creator
    const gamePlayer = anchor.web3.Keypair.generate(); // Same player for this test
    await provider.connection.requestAirdrop(gamePlayer.publicKey, 1000000000);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get the validator's current time instead of system time
    const slot = await provider.connection.getSlot();
    const blockTime = await provider.connection.getBlockTime(slot);
    const currentTime = blockTime || Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 3); // Short for testing
    const secretAnswer = "The answer is 42";
    const capsulePda = getCapsulePda(capsuleCreator.publicKey, revealDate, program.programId);
    const nftMintPda = getNftMintPda(capsulePda, program.programId);
    const accounts = {
      creator: capsuleCreator.publicKey,
      capsule: capsulePda,
      nftMint: nftMintPda,
      vault: getVaultPda(program.programId),
      systemProgram: SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    };
    
    // Create gamified capsule with encrypted content
    const encryptionKey = "testkey1234567890123456789012345678";
    const encryptedContent = CryptoJS.AES.encrypt(secretAnswer, encryptionKey).toString();
    
    await program.methods.createCapsule(encryptedContent, { onChain: {} }, revealDate, true).accounts(accounts as any).signers([capsuleCreator.payer]).rpc();
    
    // Initialize game
    const [gamePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("game"), capsulePda.toBuffer()],
      program.programId
    );
    
    await program.methods.initializeGame(capsulePda, 
      10, // max_guesses
      3 // max_winners
    ).accounts({
      creator: capsuleCreator.publicKey,
      capsule: capsulePda,
      game: gamePda,
      systemProgram: SystemProgram.programId,
    } as any).signers([capsuleCreator.payer]).rpc();
    
    // Submit correct guess (game player submits guess)
    const [correctGuessPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("guess"), gamePda.toBuffer(), gamePlayer.publicKey.toBuffer(), Buffer.from([0, 0, 0, 0])],
      program.programId
    );
    
    await program.methods.submitGuess(secretAnswer, true).accounts({
      guesser: gamePlayer.publicKey,
      game: gamePda,
      guess: correctGuessPda,
      vault: getVaultPda(program.programId),
      systemProgram: SystemProgram.programId,
    } as any).signers([gamePlayer]).rpc();
    
    // Submit wrong guess (game player submits another guess)
    const [wrongGuessPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("guess"), gamePda.toBuffer(), gamePlayer.publicKey.toBuffer(), Buffer.from([1, 0, 0, 0])],
      program.programId
    );
    
    await program.methods.submitGuess("Wrong answer", true).accounts({
      guesser: gamePlayer.publicKey,
      game: gamePda,
      guess: wrongGuessPda,
      vault: getVaultPda(program.programId),
      systemProgram: SystemProgram.programId,
    } as any).signers([gamePlayer]).rpc();
    
    // Wait for reveal date (extra buffer for timing)
    // console.log(`Reveal date: ${revealDate.toNumber()}, Current time: ${Math.floor(Date.now() / 1000)}`);
    await new Promise(resolve => setTimeout(resolve, 5000)); // Increased to 2
    // console.log(`After wait - Current time: ${Math.floor(Date.now() / 1000)}`);
    

    //check if the capsule is active 
    const capsule = await program.account.capsule.fetch(capsulePda);
    // console.log(`Capsule state: active=${capsule.isActive}, revealed=${capsule.isRevealed}, revealDate=${capsule.revealDate.toNumber()}`);
    expect(capsule.isActive).to.be.true;
    expect(capsule.isRevealed).to.be.false;

    // Reveal capsule (capsule creator reveals their capsule)
    await program.methods.revealCapsule(revealDate).accounts({
      creator: capsuleCreator.publicKey,
      capsule: capsulePda,
    } as any).signers([capsuleCreator.payer]).rpc();
    
    // Initialize leaderboard for verification (game player initializes their leaderboard)
    const [leaderboardPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("leaderboard"), gamePlayer.publicKey.toBuffer()],
      program.programId
    );
    
    // Try to initialize leaderboard (skip if already exists)
    try {
      await program.methods.initializeLeaderboard(gamePlayer.publicKey).accounts({
        authority: gamePlayer.publicKey,
        user: gamePlayer.publicKey,
        leaderboard: leaderboardPda,
        systemProgram: SystemProgram.programId,
      } as any).signers([gamePlayer]).rpc();
    } catch (error) {
      console.log("Leaderboard already exists, continuing...");
    }
    
    // Verify wrong guess first (game player verifies their guess)
    await program.methods.verifyGuess(
      secretAnswer, // decrypted_content
      null, // verification_window_hours
      false, // semantic_result
      new anchor.BN(Math.floor(Date.now() / 1000)), // oracle_timestamp
      "test_nonce_wrong", // oracle_nonce
      "" // oracle_signature (empty for fallback test)
    ).accounts({
      authority: gamePlayer.publicKey,
      guess: wrongGuessPda,
      game: gamePda,
      capsule: capsulePda,
      leaderboard: leaderboardPda,
    } as any).signers([gamePlayer]).rpc();
    
    // Verify correct guess (game player verifies their winning guess)
    await program.methods.verifyGuess(
      secretAnswer, // decrypted_content
      null, // verification_window_hours (default 1 hour)
      true, // semantic_result
      new anchor.BN(Math.floor(Date.now() / 1000)), // oracle_timestamp
      "test_nonce_correct", // oracle_nonce
      "" // oracle_signature (empty for fallback test)
    ).accounts({
      authority: gamePlayer.publicKey,
      guess: correctGuessPda,
      game: gamePda,
      capsule: capsulePda,
      leaderboard: leaderboardPda,
    } as any).signers([gamePlayer]).rpc();
    
    // Check results
    const finalGame = await program.account.game.fetch(gamePda);
    expect(finalGame.winnerFound).to.be.true;
    expect(finalGame.winner.toBase58()).to.equal(gamePlayer.publicKey.toBase58());
    
    const winningGuess = await program.account.guess.fetch(correctGuessPda);
    expect(winningGuess.isCorrect).to.be.true;
    
    const losingGuess = await program.account.guess.fetch(wrongGuessPda);
    expect(losingGuess.isCorrect).to.be.false;
    });

  it("Game: Distribute rewards after winner found", async () => {
    // Clear naming: capsule creator vs game player/guesser
    const capsuleCreator = provider.wallet; // Use provider wallet as capsule creator
    
    const slot = await provider.connection.getSlot();
    const blockTime = await provider.connection.getBlockTime(slot);
    const currentTime = blockTime || Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 3); // Short for testing
    const capsulePda = getCapsulePda(capsuleCreator.publicKey, revealDate, program.programId);
    const nftMintPda = getNftMintPda(capsulePda, program.programId);
    const accounts = {
      creator: capsuleCreator.publicKey,
      capsule: capsulePda,
      nftMint: nftMintPda,
      vault: getVaultPda(program.programId),
      systemProgram: SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    };
    
    // Create gamified capsule
    await program.methods.createCapsule("reward test", { onChain: {} }, revealDate, true).accounts(accounts as any).rpc();
    
    // Initialize game with higher fees for testing
    const [gamePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("game"), capsulePda.toBuffer()],
      program.programId
    );
    
    await program.methods.initializeGame(capsulePda, 
      5, // max_guesses
      3 // max_winners
    ).accounts({
      creator: capsuleCreator.publicKey,
      capsule: capsulePda,
      game: gamePda,
      systemProgram: SystemProgram.programId,
    } as any).rpc();
    
    // Create game player who will be the winner
    const gamePlayerWinner = anchor.web3.Keypair.generate();
    await provider.connection.requestAirdrop(gamePlayerWinner.publicKey, 1000000000);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Submit winning guess (game player submits guess)
    const [guessPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("guess"), gamePda.toBuffer(), gamePlayerWinner.publicKey.toBuffer(), Buffer.from([0, 0, 0, 0])],
      program.programId
    );
    
    await program.methods.submitGuess("reward test", true).accounts({
      guesser: gamePlayerWinner.publicKey,
      game: gamePda,
      guess: guessPda,
      vault: getVaultPda(program.programId),
      systemProgram: SystemProgram.programId,
    } as any)
    .signers([gamePlayerWinner])
    .rpc();
    
    // Wait and reveal (capsule creator reveals capsule)
    await new Promise(resolve => setTimeout(resolve, 5000));
    await program.methods.revealCapsule(revealDate).accounts({
      creator: capsuleCreator.publicKey,
      capsule: capsulePda,
    } as any).rpc();
    
    // Initialize leaderboard and verify guess (game player manages their leaderboard)
    const [leaderboardPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("leaderboard"), gamePlayerWinner.publicKey.toBuffer()],
      program.programId
    );
    
    await program.methods.initializeLeaderboard(gamePlayerWinner.publicKey).accounts({
      authority: gamePlayerWinner.publicKey,
      user: gamePlayerWinner.publicKey,
      leaderboard: leaderboardPda,
      systemProgram: SystemProgram.programId,
    } as any).signers([gamePlayerWinner]).rpc();
    
    await program.methods.verifyGuess("reward test", null, true,
      new anchor.BN(Math.floor(Date.now() / 1000)), // oracle_timestamp
      "test_nonce_reward", // oracle_nonce
      "" // oracle_signature (empty for fallback test)
    ).accounts({
      authority: gamePlayerWinner.publicKey,
      guess: guessPda,
      game: gamePda,
      capsule: capsulePda,
      leaderboard: leaderboardPda,
    } as any).signers([gamePlayerWinner]).rpc();
    
    // Initialize creator leaderboard for complete game (capsule creator manages their leaderboard)
    const [creatorLeaderboardPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("leaderboard"), capsuleCreator.publicKey.toBuffer()],
      program.programId
    );
    
    try {
      await program.methods.initializeLeaderboard(capsuleCreator.publicKey).accounts({
        authority: capsuleCreator.publicKey,
        user: capsuleCreator.publicKey,
        leaderboard: creatorLeaderboardPda,
        systemProgram: SystemProgram.programId,
      } as any).rpc();
    } catch (error) {
      // Creator leaderboard might already exist
      // console.log("Creator leaderboard already exists, continuing...");
    }

    // Complete game and distribute rewards (capsule creator completes their game)
    await program.methods.completeGame().accounts({
      authority: capsuleCreator.publicKey,
      game: gamePda,
      capsule: capsulePda,
      creator_leaderboard: creatorLeaderboardPda,
      systemProgram: SystemProgram.programId,
    } as any).rpc();
    
    // Verify game state after rewards
    // rewards are now points
    const finalGame = await program.account.game.fetch(gamePda);
    expect(finalGame.isActive).to.be.false;

    // Verify final leaderboard state for the winner
    const leaderboard = await program.account.leaderboardEntry.fetch(leaderboardPda);
    
    // The winner should get 5 (participation) + 100 (winner) = 105 points
    expect(leaderboard.totalPoints.toNumber()).to.equal(105);
    expect(leaderboard.gamesWon).to.be.equal(1);
    expect(leaderboard.gamesPlayed).to.be.equal(1);
    expect(leaderboard.capsulesCreated).to.be.equal(0);
    
  });

  it("Game: Error handling - Cannot verify guess before reveal", async () => {
    // Clear naming: capsule creator vs game player/guesser
    const capsuleCreator = anchor.web3.Keypair.generate();
    const gamePlayer = anchor.web3.Keypair.generate(); // Use unique keypair for each test
    
    await provider.connection.requestAirdrop(capsuleCreator.publicKey, 1000000000);
    await provider.connection.requestAirdrop(gamePlayer.publicKey, 1000000000);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const currentTime = Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 700); // Unique timestamp - far in future
    const capsulePda = getCapsulePda(capsuleCreator.publicKey, revealDate, program.programId);
    const nftMintPda = getNftMintPda(capsulePda, program.programId);
    const accounts = {
      creator: capsuleCreator.publicKey,
      capsule: capsulePda,
      nftMint: nftMintPda,
      vault: getVaultPda(program.programId),
      systemProgram: SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    };

    // Create game (capsule creator creates the capsule and game)
    await program.methods.createCapsule("test", { onChain: {} }, revealDate, true).accounts(accounts as any).signers([capsuleCreator]).rpc();
    
    const [gamePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("game"), capsulePda.toBuffer()],
      program.programId
    );
    await program.methods.initializeGame(capsulePda,
      5, // max_guesses
      3 // max_winners
    ).accounts({
      creator: capsuleCreator.publicKey,
      capsule: capsulePda,
      game: gamePda,
      systemProgram: SystemProgram.programId,
    } as any).signers([capsuleCreator]).rpc();
    
    // Submit guess (game player submits their own guess)
    const [guessPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("guess"), gamePda.toBuffer(), gamePlayer.publicKey.toBuffer(), Buffer.from([0, 0, 0, 0])],
      program.programId
    );
    
    await program.methods.submitGuess("test", true).accounts({
      guesser: gamePlayer.publicKey,
      game: gamePda,
      guess: guessPda,
      vault: getVaultPda(program.programId),
      systemProgram: SystemProgram.programId,
    } as any).signers([gamePlayer]).rpc();
    

    // Initialize leaderboard (game player initializes their own leaderboard entry)
    const [leaderboardPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("leaderboard"), gamePlayer.publicKey.toBuffer()],
      program.programId
    );
    
    await program.methods.initializeLeaderboard(gamePlayer.publicKey).accounts({
      authority: gamePlayer.publicKey,        // Player is authority for their own entry
      user: gamePlayer.publicKey,            // Player's stats are being tracked
      leaderboard: leaderboardPda,
      systemProgram: SystemProgram.programId,
    } as any).signers([gamePlayer]).rpc();
    
    // Try to verify guess before reveal (should fail)
    try {
      await program.methods.verifyGuess("test", null, false,
        new anchor.BN(Math.floor(Date.now() / 1000)), // oracle_timestamp
        "test_nonce_fail", // oracle_nonce
        "" // oracle_signature (empty for fallback test)
      ).accounts({
        authority: gamePlayer.publicKey,        // Player verifies their own guess
        guess: guessPda,
        game: gamePda,
        capsule: capsulePda,
        leaderboard: leaderboardPda,
      } as any).signers([gamePlayer]).rpc();
      
      expect.fail("Expected verification to fail before reveal");
    } catch (error) {
      expect(error.message).to.include("CapsuleNotReady");
      // console.log("✅ Correctly prevented verification before reveal");
    }
  });

  describe("Game Completion Scenarios", () => {
    
    it("Complete Game: Creator cancels game with no guesses", async () => {
      const capsuleCreator = provider.wallet;
      
      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 100);
      const capsulePda = getCapsulePda(capsuleCreator.publicKey, revealDate, program.programId);
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const accounts = {
        creator: capsuleCreator.publicKey,
        capsule: capsulePda,
        nftMint: nftMintPda,
        vault: getVaultPda(program.programId),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      };
      
      // Create game
      await program.methods.createCapsule("no guesses test", { onChain: {} }, revealDate, true).accounts(accounts as any).rpc();
      
      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), capsulePda.toBuffer()],
        program.programId
      );
      
      await program.methods.initializeGame(capsulePda, 5, 2).accounts({
        creator: capsuleCreator.publicKey,
        capsule: capsulePda,
        game: gamePda,
        systemProgram: SystemProgram.programId,
      } as any).rpc();
      
      // Creator should be able to complete game immediately (no guesses yet)
      const [creatorLeaderboardPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("leaderboard"), capsuleCreator.publicKey.toBuffer()],
        program.programId
      );
      
      try {
        await program.methods.initializeLeaderboard(capsuleCreator.publicKey).accounts({
          authority: capsuleCreator.publicKey,
          user: capsuleCreator.publicKey,
          leaderboard: creatorLeaderboardPda,
          systemProgram: SystemProgram.programId,
        } as any).rpc();
      } catch (error) {
        // May already exist
      }
      
      await program.methods.completeGame().accounts({
        authority: capsuleCreator.publicKey,
        game: gamePda,
        capsule: capsulePda,
        creator_leaderboard: creatorLeaderboardPda,
        systemProgram: SystemProgram.programId,
      } as any).rpc();
      
      const finalGame = await program.account.game.fetch(gamePda);
      expect(finalGame.isActive).to.be.false;
      expect(finalGame.currentGuesses).to.equal(0);
    });

    it("Complete Game: After reveal date (creator can end anytime)", async () => {
      const capsuleCreator = provider.wallet;
      const gamePlayer = anchor.web3.Keypair.generate();
      
      await provider.connection.requestAirdrop(gamePlayer.publicKey, 1000000000);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 3); // Short reveal time
      const capsulePda = getCapsulePda(capsuleCreator.publicKey, revealDate, program.programId);
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const accounts = {
        creator: capsuleCreator.publicKey,
        capsule: capsulePda,
        nftMint: nftMintPda,
        vault: getVaultPda(program.programId),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      };
      
      // Create game with guesses
      await program.methods.createCapsule("after reveal test", { onChain: {} }, revealDate, true).accounts(accounts as any).rpc();
      
      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), capsulePda.toBuffer()],
        program.programId
      );
      
      await program.methods.initializeGame(capsulePda,
         5, // max_guesses
         2 // max_winners
      ).accounts({
        creator: capsuleCreator.publicKey,
        capsule: capsulePda,
        game: gamePda,
        systemProgram: SystemProgram.programId,
      } as any).rpc();
      
      // Submit a guess but don't find winner
      const [guessPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("guess"), gamePda.toBuffer(), gamePlayer.publicKey.toBuffer(), Buffer.from([0, 0, 0, 0])],
        program.programId
      );
      
      await program.methods.submitGuess("wrong guess", false).accounts({
        guesser: gamePlayer.publicKey,
        game: gamePda,
        guess: guessPda,
        vault: getVaultPda(program.programId),
        systemProgram: SystemProgram.programId,
      } as any).signers([gamePlayer]).rpc();
      
      // Cannot complete before reveal
      const [creatorLeaderboardPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("leaderboard"), capsuleCreator.publicKey.toBuffer()],
        program.programId
      );
      
      try {
        await program.methods.initializeLeaderboard(capsuleCreator.publicKey).accounts({
          authority: capsuleCreator.publicKey,
          user: capsuleCreator.publicKey,
          leaderboard: creatorLeaderboardPda,
          systemProgram: SystemProgram.programId,
        } as any).rpc();
      } catch (error) {}
      
      try {
        await program.methods.completeGame().accounts({
          authority: capsuleCreator.publicKey,
          game: gamePda,
          capsule: capsulePda,
          creator_leaderboard: creatorLeaderboardPda,
          systemProgram: SystemProgram.programId,
        } as any).rpc();
        expect.fail("Should not be able to complete before reveal");
      } catch (error) {
        expect(error.message).to.include("GameNotEnded");
      }
      
      // Wait for reveal time and reveal
      await new Promise(resolve => setTimeout(resolve, 4000));
      await program.methods.revealCapsule(revealDate).accounts({
        creator: capsuleCreator.publicKey,
        capsule: capsulePda,
      } as any).rpc();
      
      // Now should be able to complete after reveal
      await program.methods.completeGame().accounts({
        authority: capsuleCreator.publicKey,
        game: gamePda,
        capsule: capsulePda,
        creator_leaderboard: creatorLeaderboardPda,
        systemProgram: SystemProgram.programId,
      } as any).rpc();
      
      const finalGame = await program.account.game.fetch(gamePda);
      expect(finalGame.isActive).to.be.false;
      expect(finalGame.currentGuesses).to.equal(1);
      expect(finalGame.winnersFound).to.equal(0); // No winners found
    });

    it("Complete Game: Max guesses reached", async () => {
      const capsuleCreator = provider.wallet;
      
      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 3);
      const capsulePda = getCapsulePda(capsuleCreator.publicKey, revealDate, program.programId);
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const accounts = {
        creator: capsuleCreator.publicKey,
        capsule: capsulePda,
        nftMint: nftMintPda,
        vault: getVaultPda(program.programId),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      };
      
      // Create game with low max_guesses
      await program.methods.createCapsule("max guesses test", { onChain: {} }, revealDate, true).accounts(accounts as any).rpc();
      
      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), capsulePda.toBuffer()],
        program.programId
      );
      
      await program.methods.initializeGame(capsulePda, 2, 1).accounts({ // max_guesses=2, max_winners=1
        creator: capsuleCreator.publicKey,
        capsule: capsulePda,
        game: gamePda,
        systemProgram: SystemProgram.programId,
      } as any).rpc();
      
      // Submit 2 guesses to reach max
      for (let i = 0; i < 2; i++) {
        const [guessPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("guess"), gamePda.toBuffer(), capsuleCreator.publicKey.toBuffer(), Buffer.from([i, 0, 0, 0])],
          program.programId
        );
        
        await program.methods.submitGuess(`guess ${i}`, false).accounts({
          guesser: capsuleCreator.publicKey,
          game: gamePda,
          guess: guessPda,
          vault: getVaultPda(program.programId),
          systemProgram: SystemProgram.programId,
        } as any).rpc();
      }
      
      // Wait and reveal
      await new Promise(resolve => setTimeout(resolve, 4000));
      await program.methods.revealCapsule(revealDate).accounts({
        creator: capsuleCreator.publicKey,
        capsule: capsulePda,
      } as any).rpc();
      
      // Game should be ready for completion (max_guesses reached)
      const gameBeforeCompletion = await program.account.game.fetch(gamePda);
      expect(gameBeforeCompletion.currentGuesses).to.equal(2);
      
      // Complete game (max_guesses condition met)
      const [creatorLeaderboardPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("leaderboard"), capsuleCreator.publicKey.toBuffer()],
        program.programId
      );
      
      try {
        await program.methods.initializeLeaderboard(capsuleCreator.publicKey).accounts({
          authority: capsuleCreator.publicKey,
          user: capsuleCreator.publicKey,
          leaderboard: creatorLeaderboardPda,
          systemProgram: SystemProgram.programId,
        } as any).rpc();
      } catch (error) {}
      
      await program.methods.completeGame().accounts({
        authority: capsuleCreator.publicKey,
        game: gamePda,
        capsule: capsulePda,
        creator_leaderboard: creatorLeaderboardPda,
        systemProgram: SystemProgram.programId,
      } as any).rpc();
      
      const finalGame = await program.account.game.fetch(gamePda);
      expect(finalGame.isActive).to.be.false;
    });

  });
});