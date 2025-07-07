import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Capsulex } from "../target/types/capsulex";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { describe, before, it } from "mocha";
import { VAULT_SEED, CAPSULE_SEED, CAPSULE_MINT_SEED, KEY_VAULT_SEED } from "./constants";
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

function getKeyVaultPda(capsule: PublicKey, programId: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(KEY_VAULT_SEED), capsule.toBuffer()],
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

function getDefaultAccounts({ provider, capsulePda, keyVaultPda, nftMintPda, vaultPda }) {
  return {
    creator: provider.wallet.publicKey,
    capsule: capsulePda,
    keyVault: keyVaultPda,
    nftMint: nftMintPda,
    vault: vaultPda,
    systemProgram: SystemProgram.programId,
    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  };
}

describe("CapsuleX Game Instructions", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.capsulex as Program<Capsulex>;
  let vaultPda: PublicKey;

  before(async () => {
    // Initialize program vault (matching existing test style)
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(VAULT_SEED)],
      program.programId
    );

    try {
      await program.methods.initializeProgram().accounts({
        authority: provider.wallet.publicKey,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      } as any).rpc();
    } catch (e) {
      // Vault might already be initialized
      console.log("Vault already initialized or error:", e.message.substring(0, 50));
    }
  });

  it("Game: Initialize game with correct parameters", async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 100); // Unique timestamp
    const capsulePda = getCapsulePda(provider.wallet.publicKey, revealDate, program.programId);
    const keyVaultPda = getKeyVaultPda(capsulePda, program.programId);
    const nftMintPda = getNftMintPda(capsulePda, program.programId);
    const accounts = getDefaultAccounts({ provider, capsulePda, keyVaultPda, nftMintPda, vaultPda });
    
    // Create gamified capsule first
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
    
    await program.methods.initializeGame(
      capsulePda,
      50 // max_guesses (no more guess fees!)
    ).accounts({
      creator: provider.wallet.publicKey,
      capsule: capsulePda,
      game: gamePda,
      vault: vaultPda,
      systemProgram: SystemProgram.programId,
    } as any).rpc();
    
    const game = await program.account.game.fetch(gamePda);
    expect(game.capsuleId.toBase58()).to.equal(capsulePda.toBase58());
    expect(game.creator.toBase58()).to.equal(provider.wallet.publicKey.toBase58());
    expect(game.maxGuesses).to.equal(50);
    expect(game.isActive).to.be.true;
    expect(game.currentGuesses).to.equal(0);
    expect(game.totalParticipants).to.equal(0);
    expect(game.winnerFound).to.be.false;
    
    // console.log("✅ Game initialized successfully");
  });

  it("Game: Submit guesses with anonymity options", async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 200); // Unique timestamp
    const capsulePda = getCapsulePda(provider.wallet.publicKey, revealDate, program.programId);
    const keyVaultPda = getKeyVaultPda(capsulePda, program.programId);
    const nftMintPda = getNftMintPda(capsulePda, program.programId);
    const accounts = getDefaultAccounts({ provider, capsulePda, keyVaultPda, nftMintPda, vaultPda });
    
    // Create and initialize game
    await program.methods.createCapsule("test content", { onChain: {} }, revealDate, true).accounts(accounts as any).rpc();
    
    const [gamePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("game"), capsulePda.toBuffer()],
      program.programId
    );
    
    await program.methods.initializeGame(capsulePda, 10).accounts({
      creator: provider.wallet.publicKey,
      capsule: capsulePda,
      game: gamePda,
      vault: vaultPda,
      systemProgram: SystemProgram.programId,
    } as any).rpc();
    
    // public guess
    const [freePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("guess"), gamePda.toBuffer(), provider.wallet.publicKey.toBuffer(), Buffer.from([0, 0, 0, 0])],
      program.programId
    );
    
    await program.methods.submitGuess("public guess", false).accounts({
      guesser: provider.wallet.publicKey,
      game: gamePda,
      guess: freePda,
      vault: vaultPda,
      systemProgram: SystemProgram.programId,
    } as any).rpc();
    
    // anonymous guess
    const [paidPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("guess"), gamePda.toBuffer(), provider.wallet.publicKey.toBuffer(), Buffer.from([1, 0, 0, 0])],
      program.programId
    );
    
    await program.methods.submitGuess("anonymous guess", true).accounts({
      guesser: provider.wallet.publicKey,
      game: gamePda,
      guess: paidPda,
      vault: vaultPda,
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
    const currentTime = Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 300); // Unique timestamp
    const capsulePda = getCapsulePda(provider.wallet.publicKey, revealDate, program.programId);
    const keyVaultPda = getKeyVaultPda(capsulePda, program.programId);
    const nftMintPda = getNftMintPda(capsulePda, program.programId);
    const accounts = getDefaultAccounts({ provider, capsulePda, keyVaultPda, nftMintPda, vaultPda });
    
    // Create gamified capsule and game
    await program.methods.createCapsule("secret answer", { onChain: {} }, revealDate, true).accounts(accounts as any).rpc();
    
    const [gamePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("game"), capsulePda.toBuffer()],
      program.programId
    );
    
    await program.methods.initializeGame(capsulePda, 5).accounts({
      creator: provider.wallet.publicKey,
      capsule: capsulePda,
      game: gamePda,
      vault: vaultPda,
      systemProgram: SystemProgram.programId,
    } as any).rpc();
    
    // Create multiple guessers
    const guesser1 = anchor.web3.Keypair.generate();
    const guesser2 = anchor.web3.Keypair.generate();
    
    // Fund guessers
    await provider.connection.requestAirdrop(guesser1.publicKey, 1000000000); // 1 SOL
    await provider.connection.requestAirdrop(guesser2.publicKey, 1000000000);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 
    
    // Guesser 1: Paid guess, public (first guess, so current_guesses = 0)
    const [guess1Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("guess"), gamePda.toBuffer(), guesser1.publicKey.toBuffer(), Buffer.from(new Uint32Array([0]).buffer)],
      program.programId
    );
    
    await program.methods.submitGuess(
      "wrong guess from guesser 1",
      false // is_anonymous (public)
    ).accounts({
      guesser: guesser1.publicKey,
      game: gamePda,
      guess: guess1Pda,
      vault: vaultPda,
      systemProgram: SystemProgram.programId,
    } as any)
    .signers([guesser1])
    .rpc();
    
    // Guesser 2: Paid guess, anonymous (second guess, so current_guesses = 1)
    const [guess2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("guess"), gamePda.toBuffer(), guesser2.publicKey.toBuffer(), Buffer.from(new Uint32Array([1]).buffer)],
      program.programId
    );
    
    await program.methods.submitGuess(
      "another wrong guess",
      true // is_anonymous
    ).accounts({
      guesser: guesser2.publicKey,
      game: gamePda,
      guess: guess2Pda,
      vault: vaultPda,
      systemProgram: SystemProgram.programId,
    } as any)
    .signers([guesser2])
    .rpc();
    
    // Verify game state
    const game = await program.account.game.fetch(gamePda);
    expect(game.currentGuesses).to.equal(2);
    // expect(game.totalFeesCollected.toNumber()).to.equal(20000); // 2 paid guesses * 10000 fee each
    
    // Verify individual guesses
    const guess1 = await program.account.guess.fetch(guess1Pda);
    expect(guess1.guesser.toBase58()).to.equal(guesser1.publicKey.toBase58());
    expect(guess1.isPaid).to.be.true;
    expect(guess1.isAnonymous).to.be.false;
    
    const guess2 = await program.account.guess.fetch(guess2Pda);
    expect(guess2.guesser.toBase58()).to.equal(guesser2.publicKey.toBase58());
    expect(guess2.isPaid).to.be.true;
    expect(guess2.isAnonymous).to.be.true;
    
    // console.log("✅ Multiple users submitted guesses successfully");
  });

  it("Game: Verify guess after capsule reveal (delayed verification)", async () => {
    // Get the validator's current time instead of system time
    const slot = await provider.connection.getSlot();
    const blockTime = await provider.connection.getBlockTime(slot);
    const currentTime = blockTime || Math.floor(Date.now() / 1000);
    const revealDate = new anchor.BN(currentTime + 3); // Short for testing
    const secretAnswer = "The answer is 42";
    const capsulePda = getCapsulePda(provider.wallet.publicKey, revealDate, program.programId);
    const keyVaultPda = getKeyVaultPda(capsulePda, program.programId);
    const nftMintPda = getNftMintPda(capsulePda, program.programId);
    const accounts = getDefaultAccounts({ provider, capsulePda, keyVaultPda, nftMintPda, vaultPda });
    
    // Create gamified capsule with encrypted content
    const encryptionKey = "testkey1234567890123456789012345678";
    const encryptedContent = CryptoJS.AES.encrypt(secretAnswer, encryptionKey).toString();
    
    await program.methods.createCapsule(encryptedContent, { onChain: {} }, revealDate, true).accounts(accounts as any).rpc();
    
    // Initialize game
    const [gamePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("game"), capsulePda.toBuffer()],
      program.programId
    );
    
    await program.methods.initializeGame(capsulePda, 10).accounts({
      creator: provider.wallet.publicKey,
      capsule: capsulePda,
      game: gamePda,
      vault: vaultPda,
      systemProgram: SystemProgram.programId,
    } as any).rpc();
    
    // Submit correct guess
    const [correctGuessPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("guess"), gamePda.toBuffer(), provider.wallet.publicKey.toBuffer(), Buffer.from([0, 0, 0, 0])],
      program.programId
    );
    
    await program.methods.submitGuess(secretAnswer, true).accounts({
      guesser: provider.wallet.publicKey,
      game: gamePda,
      guess: correctGuessPda,
      vault: vaultPda,
      systemProgram: SystemProgram.programId,
    } as any).rpc();
    
    // Submit wrong guess
    const [wrongGuessPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("guess"), gamePda.toBuffer(), provider.wallet.publicKey.toBuffer(), Buffer.from([1, 0, 0, 0])],
      program.programId
    );
    
    await program.methods.submitGuess("Wrong answer", true).accounts({
      guesser: provider.wallet.publicKey,
      game: gamePda,
      guess: wrongGuessPda,
      vault: vaultPda,
      systemProgram: SystemProgram.programId,
    } as any).rpc();
    
    // Wait for reveal date (extra buffer for timing)
    console.log(`Reveal date: ${revealDate.toNumber()}, Current time: ${Math.floor(Date.now() / 1000)}`);
    await new Promise(resolve => setTimeout(resolve, 5000)); // Increased to 2
    console.log(`After wait - Current time: ${Math.floor(Date.now() / 1000)}`);
    

    //check if the capsule is active 
    const capsule = await program.account.capsule.fetch(capsulePda);
    console.log(`Capsule state: active=${capsule.isActive}, revealed=${capsule.isRevealed}, revealDate=${capsule.revealDate.toNumber()}`);
    expect(capsule.isActive).to.be.true;
    expect(capsule.isRevealed).to.be.false;

    // console.log("Revealing capsule");
    // Reveal capsule
    await program.methods.revealCapsule(revealDate).accounts({
      creator: provider.wallet.publicKey,
      capsule: capsulePda,
      keyVault: keyVaultPda,
    } as any).rpc();
    
    // Initialize leaderboard for verification
    const [leaderboardPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("leaderboard"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );
    
    // Try to initialize leaderboard (skip if already exists)
    try {
      await program.methods.initializeLeaderboard(provider.wallet.publicKey).accounts({
        authority: provider.wallet.publicKey,
        user: provider.wallet.publicKey,
        leaderboard: leaderboardPda,
        systemProgram: SystemProgram.programId,
      } as any).rpc();
      console.log("✅ Leaderboard initialized");
    } catch (error) {
      console.log("Leaderboard already exists, continuing...");
    }
    
    console.log("Verifying wrong guess");
    // Verify wrong guess first (should not win)
    await program.methods.verifyGuess(
      secretAnswer, // decrypted_content
      null // verification_window_hours
    ).accounts({
      authority: provider.wallet.publicKey,
      guess: wrongGuessPda,
      game: gamePda,
      capsule: capsulePda,
      leaderboard: leaderboardPda,
    } as any).rpc();
    
    console.log("Verifying correct guess");
    // Verify correct guess (should win)
    await program.methods.verifyGuess(
      secretAnswer, // decrypted_content
      null // verification_window_hours (default 1 hour)
    ).accounts({
      authority: provider.wallet.publicKey,
      guess: correctGuessPda,
      game: gamePda,
      capsule: capsulePda,
      leaderboard: leaderboardPda,
    } as any).rpc();
    
    // Check results
    const finalGame = await program.account.game.fetch(gamePda);
    expect(finalGame.winnerFound).to.be.true;
    expect(finalGame.winner.toBase58()).to.equal(provider.wallet.publicKey.toBase58());
    
    const winningGuess = await program.account.guess.fetch(correctGuessPda);
    expect(winningGuess.isCorrect).to.be.true;
    
    const losingGuess = await program.account.guess.fetch(wrongGuessPda);
    expect(losingGuess.isCorrect).to.be.false;
    
    console.log("✅ Delayed verification working correctly");
  });

  // it("Game: Distribute rewards after winner found", async () => {
  //   const currentTime = Math.floor(Date.now() / 1000);
  //   const revealDate = new anchor.BN(currentTime + 3); // Short for testing
  //   const capsulePda = getCapsulePda(provider.wallet.publicKey, revealDate, program.programId);
  //   const keyVaultPda = getKeyVaultPda(capsulePda, program.programId);
  //   const nftMintPda = getNftMintPda(capsulePda, program.programId);
  //   const accounts = getDefaultAccounts({ provider, capsulePda, keyVaultPda, nftMintPda, vaultPda });
    
  //   // Create gamified capsule
  //   await program.methods.createCapsule("reward test", { onChain: {} }, revealDate, true).accounts(accounts as any).rpc();
    
  //   // Initialize game with higher fees for testing
  //   const [gamePda] = PublicKey.findProgramAddressSync(
  //     [Buffer.from("game"), capsulePda.toBuffer()],
  //     program.programId
  //   );
    
  //   await program.methods.initializeGame(capsulePda, 5).accounts({
  //     creator: provider.wallet.publicKey,
  //     capsule: capsulePda,
  //     game: gamePda,
  //     vault: vaultPda,
  //     systemProgram: SystemProgram.programId,
  //   } as any).rpc();
    
  //   // Create winner
  //   const winner = anchor.web3.Keypair.generate();
  //   await provider.connection.requestAirdrop(winner.publicKey, 1000000000);
  //   await new Promise(resolve => setTimeout(resolve, 1000));
    
  //   // Submit winning guess
  //   const [guessPda] = PublicKey.findProgramAddressSync(
  //     [Buffer.from("guess"), gamePda.toBuffer(), winner.publicKey.toBuffer(), Buffer.from([0, 0, 0, 0])],
  //     program.programId
  //   );
    
  //   await program.methods.submitGuess("reward test", true).accounts({
  //     guesser: winner.publicKey,
  //     game: gamePda,
  //     guess: guessPda,
  //     vault: vaultPda,
  //     systemProgram: SystemProgram.programId,
  //   } as any)
  //   .signers([winner])
  //   .rpc();
    
  //   // Wait and reveal
  //   await new Promise(resolve => setTimeout(resolve, 4000));
  //   await program.methods.revealCapsule(revealDate).accounts({
  //     creator: provider.wallet.publicKey,
  //     capsule: capsulePda,
  //     keyVault: keyVaultPda,
  //   } as any).rpc();
    
  //   // Initialize leaderboard and verify guess
  //   const [leaderboardPda] = PublicKey.findProgramAddressSync(
  //     [Buffer.from("leaderboard"), winner.publicKey.toBuffer()],
  //     program.programId
  //   );
    
  //   await program.methods.initializeLeaderboard(winner.publicKey).accounts({
  //     authority: provider.wallet.publicKey,
  //     user: winner.publicKey,
  //     leaderboard: leaderboardPda,
  //     systemProgram: SystemProgram.programId,
  //   } as any).rpc();
    
  //   await program.methods.verifyGuess("reward test", null).accounts({
  //     authority: provider.wallet.publicKey,
  //     guess: guessPda,
  //     game: gamePda,
  //     capsule: capsulePda,
  //     leaderboard: leaderboardPda,
  //   } as any).rpc();
    
  //   // Get balances before reward distribution
  //   const vaultBalanceBefore = await provider.connection.getBalance(vaultPda);
  //   const winnerBalanceBefore = await provider.connection.getBalance(winner.publicKey);
  //   const creatorBalanceBefore = await provider.connection.getBalance(provider.wallet.publicKey);
    
  //   // Distribute rewards
  //   await program.methods.completeGame().accounts({
  //     authority: provider.wallet.publicKey,
  //     game: gamePda,
  //     creator_leaderboard: leaderboardPda,
  //     systemProgram: SystemProgram.programId,
  //   } as any).rpc();
    
  //   // Verify game state after rewards
  //   const finalGame = await program.account.game.fetch(gamePda);
  //   expect(finalGame.isActive).to.be.false;
    
  //   // Get balances after reward distribution
  //   const vaultBalanceAfter = await provider.connection.getBalance(vaultPda);
  //   const winnerBalanceAfter = await provider.connection.getBalance(winner.publicKey);
  //   const creatorBalanceAfter = await provider.connection.getBalance(provider.wallet.publicKey);
    
  //   // Calculate expected rewards (50% to winner, 20% to creator, 30% to app)
  //   const totalFees = 20000; // 1 guess * 20000 fee
  //   const expectedWinnerReward = Math.floor(totalFees * 0.5);
  //   const expectedCreatorReward = Math.floor(totalFees * 0.2);
  //   const expectedAppReward = totalFees - expectedWinnerReward - expectedCreatorReward;
    
  //   // Verify rewards were distributed correctly
  //   expect(winnerBalanceAfter).to.be.greaterThan(winnerBalanceBefore);
  //   expect(creatorBalanceAfter).to.be.greaterThan(creatorBalanceBefore);
  //   expect(vaultBalanceAfter).to.be.lessThan(vaultBalanceBefore);
    
  //   console.log("✅ Rewards distributed successfully");
  //   console.log(`Winner received: ${winnerBalanceAfter - winnerBalanceBefore} lamports`);
  //   console.log(`Creator received: ${creatorBalanceAfter - creatorBalanceBefore} lamports`);
  // });

  // it("Retrieve encryption key after reveal", async () => {
  //   const currentTime = Math.floor(Date.now() / 1000);
  //   const revealDate = new anchor.BN(currentTime + 3); // Short for testing
  //   const capsulePda = getCapsulePda(provider.wallet.publicKey, revealDate, program.programId);
  //   const keyVaultPda = getKeyVaultPda(capsulePda, program.programId);
  //   const nftMintPda = getNftMintPda(capsulePda, program.programId);
  //   const accounts = getDefaultAccounts({ provider, capsulePda, keyVaultPda, nftMintPda, vaultPda });
    
  //   // Create capsule
  //   await program.methods.createCapsule("secret content", { onChain: {} }, revealDate, false).accounts(accounts as any).rpc();
    
  //   // Wait and reveal
  //   await new Promise(resolve => setTimeout(resolve, 4000));
  //   await program.methods.revealCapsule(revealDate).accounts({
  //     creator: provider.wallet.publicKey,
  //     capsule: capsulePda,
  //     keyVault: keyVaultPda,
  //   } as any).rpc();
    
  //   // Retrieve encryption key
  //   await program.methods.retrieveEncryptionKey(revealDate).accounts({
  //     user: provider.wallet.publicKey,
  //     capsule: capsulePda,
  //     keyVault: keyVaultPda,
  //   } as any).rpc();
    
  //   console.log("✅ Encryption key retrieved successfully");
  // });

  // it("Game: Error handling - Cannot verify guess before reveal", async () => {
  //   const testUser = anchor.web3.Keypair.generate();
  //   await provider.connection.requestAirdrop(testUser.publicKey, 1000000000);
  //   await new Promise(resolve => setTimeout(resolve, 1000));
    
  //   const currentTime = Math.floor(Date.now() / 1000);
  //   const revealDate = new anchor.BN(currentTime + 700); // Unique timestamp - far in future
  //   const capsulePda = getCapsulePda(testUser.publicKey, revealDate, program.programId);
  //   const keyVaultPda = getKeyVaultPda(capsulePda, program.programId);
  //   const nftMintPda = getNftMintPda(capsulePda, program.programId);
  //   const accounts = {
  //     creator: testUser.publicKey,
  //     capsule: capsulePda,
  //     keyVault: keyVaultPda,
  //     nftMint: nftMintPda,
  //     vault: vaultPda,
  //     systemProgram: SystemProgram.programId,
  //     tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
  //     rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //   };
    
  //   // Create game
  //   await program.methods.createCapsule("test", { onChain: {} }, revealDate, true).accounts(accounts as any).rpc();
    
  //   const [gamePda] = PublicKey.findProgramAddressSync(
  //     [Buffer.from("game"), capsulePda.toBuffer()],
  //     program.programId
  //   );
    
  //   await program.methods.initializeGame(capsulePda, 5).accounts({
  //     creator: provider.wallet.publicKey,
  //     capsule: capsulePda,
  //     game: gamePda,
  //     vault: vaultPda,
  //     systemProgram: SystemProgram.programId,
  //   } as any).rpc();
    
  //   // Submit guess
  //   const [guessPda] = PublicKey.findProgramAddressSync(
  //     [Buffer.from("guess"), gamePda.toBuffer(), provider.wallet.publicKey.toBuffer(), Buffer.from([0, 0, 0, 0])],
  //     program.programId
  //   );
    
  //   await program.methods.submitGuess("test", true).accounts({
  //     guesser: provider.wallet.publicKey,
  //     game: gamePda,
  //     guess: guessPda,
  //     vault: vaultPda,
  //     systemProgram: SystemProgram.programId,
  //   } as any).rpc();
    
  //   // Initialize leaderboard
  //   const [leaderboardPda] = PublicKey.findProgramAddressSync(
  //     [Buffer.from("leaderboard"), provider.wallet.publicKey.toBuffer()],
  //     program.programId
  //   );
    
  //   await program.methods.initializeLeaderboard(provider.wallet.publicKey).accounts({
  //     authority: provider.wallet.publicKey,
  //     user: provider.wallet.publicKey,
  //     leaderboard: leaderboardPda,
  //     systemProgram: SystemProgram.programId,
  //   } as any).rpc();
    
  //   // Try to verify guess before reveal (should fail)
  //   try {
  //     await program.methods.verifyGuess("test", null).accounts({
  //       authority: provider.wallet.publicKey,
  //       guess: guessPda,
  //       game: gamePda,
  //       capsule: capsulePda,
  //       leaderboard: leaderboardPda,
  //     } as any).rpc();
      
  //     expect.fail("Expected verification to fail before reveal");
  //   } catch (error) {
  //     expect(error.message).to.include("CapsuleNotReady");
  //     console.log("✅ Correctly prevented verification before reveal");
  //   }
  // });

  // it("Game: Error handling - Only paid guesses can win", async () => {
  //   const currentTime = Math.floor(Date.now() / 1000);
  //   const revealDate = new anchor.BN(currentTime + 3); // Short for testing
  //   const capsulePda = getCapsulePda(provider.wallet.publicKey, revealDate, program.programId);
  //   const keyVaultPda = getKeyVaultPda(capsulePda, program.programId);
  //   const nftMintPda = getNftMintPda(capsulePda, program.programId);
  //   const accounts = getDefaultAccounts({ provider, capsulePda, keyVaultPda, nftMintPda, vaultPda });
    
  //   // Create game
  //   await program.methods.createCapsule("free test", { onChain: {} }, revealDate, true).accounts(accounts as any).rpc();
    
  //   const [gamePda] = PublicKey.findProgramAddressSync(
  //     [Buffer.from("game"), capsulePda.toBuffer()],
  //     program.programId
  //   );
    
  //   await program.methods.initializeGame(capsulePda, 5).accounts({
  //     creator: provider.wallet.publicKey,
  //     capsule: capsulePda,
  //     game: gamePda,
  //     vault: vaultPda,
  //     systemProgram: SystemProgram.programId,
  //   } as any).rpc();
    
  //   // Submit FREE guess (not paid)
  //   const [guessPda] = PublicKey.findProgramAddressSync(
  //     [Buffer.from("guess"), gamePda.toBuffer(), provider.wallet.publicKey.toBuffer(), Buffer.from([0, 0, 0, 0])],
  //     program.programId
  //   );
    
  //   await program.methods.submitGuess("free test", false).accounts({
  //     guesser: provider.wallet.publicKey,
  //     game: gamePda,
  //     guess: guessPda,
  //     vault: vaultPda,
  //     systemProgram: SystemProgram.programId,
  //   } as any).rpc();
    
  //   // Wait and reveal
  //   await new Promise(resolve => setTimeout(resolve, 4000));
  //   await program.methods.revealCapsule(revealDate).accounts({
  //     creator: provider.wallet.publicKey,
  //     capsule: capsulePda,
  //     keyVault: keyVaultPda,
  //   } as any).rpc();
    
  //   // Initialize leaderboard
  //   const [leaderboardPda] = PublicKey.findProgramAddressSync(
  //     [Buffer.from("leaderboard"), provider.wallet.publicKey.toBuffer()],
  //     program.programId
  //   );
    
  //   await program.methods.initializeLeaderboard(provider.wallet.publicKey).accounts({
  //     authority: provider.wallet.publicKey,
  //     user: provider.wallet.publicKey,
  //     leaderboard: leaderboardPda,
  //     systemProgram: SystemProgram.programId,
  //   } as any).rpc();
    
  //   // Try to verify free guess (should fail)
  //   try {
  //     await program.methods.verifyGuess("free test", null).accounts({
  //       authority: provider.wallet.publicKey,
  //       guess: guessPda,
  //       game: gamePda,
  //       capsule: capsulePda,
  //       leaderboard: leaderboardPda,
  //     } as any).rpc();
      
  //     expect.fail("Expected free guess verification to fail");
  //   } catch (error) {
  //     expect(error.message).to.include("OnlyPaidGuessesEligible");
  //     console.log("✅ Correctly prevented free guess from winning");
  //   }
  // });
});