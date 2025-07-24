import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Capsulex } from "../target/types/capsulex";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { describe, before, it } from "mocha";
import { VAULT_SEED, CAPSULE_SEED, CAPSULE_MINT_SEED } from "./constants";
import CryptoJS from "crypto-js";
import { expect } from "chai";
import axios from "axios";
import crypto from "crypto";

// Semantic service configuration
const SEMANTIC_SERVICE_URL = "http://localhost:5001";
const DEFAULT_THRESHOLD = 0.8;

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

// Helper function to get vault PDA
function getVaultPda(programId: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED)],
    programId
  );
  return pda;
}

const contentHash = createSHA256Hash("content");

// Helper function to call semantic service
async function callSemanticService(
  guess: string,
  answer: string,
  threshold: number = DEFAULT_THRESHOLD,
  provider?: any
) {
  try {
    // Get Solana validator timestamp for uniform time across systems
    let solanaTimestamp;
    if (provider) {
      try {
        const slot = await provider.connection.getSlot();
        const blockTime = await provider.connection.getBlockTime(slot);
        solanaTimestamp = blockTime || Math.floor(Date.now() / 1000);
      } catch (error) {
        console.warn(
          "Failed to get Solana time, using system time:",
          error.message
        );
        solanaTimestamp = Math.floor(Date.now() / 1000);
      }
    } else {
      solanaTimestamp = Math.floor(Date.now() / 1000);
    }

    const response = await axios.post(`${SEMANTIC_SERVICE_URL}/check-answer`, {
      guess: guess,
      answer: answer,
      threshold: threshold,
      timestamp: solanaTimestamp,
    });

    return {
      is_correct: response.data.is_correct,
      similarity: response.data.similarity,
      threshold: response.data.threshold,
      method: response.data.method,
      tier: response.data.tier || 2,
      oracle_timestamp: response.data.oracle_timestamp,
      oracle_nonce: response.data.oracle_nonce,
      oracle_signature: response.data.oracle_signature,
      oracle_enabled: response.data.oracle_enabled,
    };
  } catch (error) {
    // More detailed error reporting
    if (error.code === "ECONNREFUSED") {
      console.error(`❌ SEMANTIC SERVICE NOT RUNNING!`);
      console.error(`   Please start the service with:`);
      console.error(
        `   cd semantic-service && source .venv/bin/activate && python app-hybrid.py`
      );
      console.error(`   Then re-run the tests.`);
    } else if (error.response) {
      console.error(
        `❌ Semantic service error (${error.response.status}):`,
        error.response.data
      );
    } else {
      console.error(`❌ Semantic service error:`, error.message);
    }

    // Fallback to exact match if service unavailable
    const exact_match =
      guess.trim().toLowerCase() === answer.trim().toLowerCase();
    console.warn(
      `⚠️  Falling back to exact matching for: "${guess}" vs "${answer}"`
    );

    return {
      is_correct: exact_match,
      similarity: exact_match ? 1.0 : 0.0,
      threshold: threshold,
      method: "exact_match_fallback",
      tier: 1,
      oracle_timestamp: Math.floor(Date.now() / 1000),
      oracle_nonce: "fallback_nonce",
      oracle_signature: "",
      oracle_enabled: false,
    };
  }
}

// Helper functions from existing tests
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

describe("Semantic Answer Validation Integration", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.capsulex as Program<Capsulex>;

  before(async () => {
    console.log(
      "🔗 Testing semantic integration with service at:",
      SEMANTIC_SERVICE_URL
    );

    // Check semantic service first
    let serviceAvailable = false;
    try {
      const response = await axios.get(`${SEMANTIC_SERVICE_URL}/health`, {
        timeout: 2000,
      });
      console.log("✅ Semantic service is healthy:", response.data);
      serviceAvailable = true;
    } catch (error) {
      if (error.code === "ECONNREFUSED") {
        console.error("\n❌ SEMANTIC SERVICE NOT RUNNING!");
        console.error(
          "   The tests require the semantic service to be running."
        );
        console.error("   Please start it with:");
        console.error(
          "   cd semantic-service && source .venv/bin/activate && python app-hybrid.py"
        );
        console.error("   Then re-run the tests.\n");
        console.warn(
          "⚠️  Tests will continue but will use exact matching fallback"
        );
      } else {
        console.warn(
          "⚠️ Semantic service not available, tests will use fallback"
        );
      }
    }

    // Find the vault PDA
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(VAULT_SEED)],
      program.programId
    );

    // Initialize the program and vault if not already initialized
    try {
      await program.methods
        .initializeProgram()
        .accounts({
          authority: provider.wallet.publicKey,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();
      console.log("✅ Program and vault initialized.");
    } catch (error) {
      if (
        error.logs &&
        (error.logs.some((log: string) =>
          log.includes("Already initialized")
        ) ||
          error.logs.some((log: string) => log.includes("already in use")))
      ) {
        console.log("⚠️ Program and vault already initialized.");
      } else {
        console.error("❌ Failed to initialize program or vault:", error);
        throw error;
      }
    }

    // Initialize leaderboard once for the provider wallet
    const [leaderboardPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("leaderboard"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .initializeLeaderboard(provider.wallet.publicKey)
        .accounts({
          authority: provider.wallet.publicKey,
          user: provider.wallet.publicKey,
          leaderboard: leaderboardPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();
      console.log("✅ Leaderboard initialized for provider wallet.");
    } catch (error) {
      console.log("⚠️ Leaderboard already exists or failed to initialize:", error.message);
    }

    // If service not available, warn about test limitations
    if (!serviceAvailable) {
      console.warn("\n🚨 WARNING: Semantic validation tests will fail!");
      console.warn(
        "   Start the semantic service for proper integration testing.\n"
      );
    }
  });

  describe("Semantic Validation Test Cases", () => {
    it("✅ Accepts semantically equivalent answers", async () => {
      const capsuleCreator = provider.wallet; // Use provider wallet as capsule creator
      const gamePlayer = provider.wallet; // Same player for this test

      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 3 + Math.floor(Math.random() * 5)); // Short delay with some randomness
      const secretAnswer = "automobile"; // Semantic test case

      const capsulePda = getCapsulePda(
        capsuleCreator.publicKey,
        revealDate,
        program.programId
      );
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const accounts = {
        creator: capsuleCreator.publicKey,
        capsule: capsulePda,
        nftMint: nftMintPda,
        game: getGamePda(capsulePda, program.programId),
        vault: getVaultPda(program.programId),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      };

      // Create capsule and game (no encryption needed for on-chain content)
      await program.methods
        .createCapsule(
          secretAnswer, // Store plaintext content on-chain for testing
          { text: {} },
          contentHash,
          revealDate,
          true
        )
        .accounts(accounts as any)
        .rpc();

      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), capsulePda.toBuffer()],
        program.programId
      );

      // Test one semantic equivalent (since game ends after first winner)
      const testGuess = "car"; // direct synonym

      // Submit guess
      const [guessPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("guess"),
          gamePda.toBuffer(),
          gamePlayer.publicKey.toBuffer(),
          Buffer.from([0, 0, 0, 0]),
        ],
        program.programId
      );

      await program.methods
        .submitGuess(testGuess, false)
        .accounts({
          guesser: gamePlayer.publicKey,
          game: gamePda,
          guess: guessPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();

      // Wait for reveal time
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Reveal capsule
      await program.methods
        .revealCapsule(revealDate)
        .accounts({
          creator: capsuleCreator.publicKey,
          capsule: capsulePda,
        } as any)
        .rpc();

      // Call semantic service with Solana validator time
      const semanticResult = await callSemanticService(
        testGuess,
        secretAnswer,
        DEFAULT_THRESHOLD,
        provider
      );
      console.log(`📊 direct synonym: "${testGuess}" vs "${secretAnswer}"`);
      console.log(
        `   Similarity: ${semanticResult.similarity}, Method: ${semanticResult.method}, Tier: ${semanticResult.tier}`
      );

      // Initialize leaderboard
      const [leaderboardPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("leaderboard"), gamePlayer.publicKey.toBuffer()],
        program.programId
      );

      // Leaderboard already initialized in before() hook

      // Verify guess with semantic result and Oracle signature
      await program.methods
        .verifyGuess(
          secretAnswer,
          null, // verification_window_hours
          semanticResult.is_correct,
          new anchor.BN(
            semanticResult.oracle_timestamp || Math.floor(Date.now() / 1000)
          ),
          semanticResult.oracle_nonce || "fallback_nonce",
          semanticResult.oracle_signature || ""
        )
        .accounts({
          authority: gamePlayer.publicKey,
          guess: guessPda,
          game: gamePda,
          capsule: capsulePda,
          leaderboard: leaderboardPda,
        } as any)
        .rpc();

      // Verify result is correct
      const guess = await program.account.guess.fetch(guessPda);
      console.log(
        `   Result: ${guess.isCorrect ? "✅ CORRECT" : "❌ INCORRECT"}`
      );
      expect(guess.isCorrect).to.be.true;

      // Verify game state (should still be active since max_winners=3 and we only have 1 winner)
      const finalGame = await program.account.game.fetch(gamePda);
      expect(finalGame.winnerFound).to.be.true;
      expect(finalGame.winnersFound).to.equal(1);
      expect(finalGame.isActive).to.be.true; // Game stays active until max_winners reached
    });

    it("❌ Rejects semantically different answers", async () => {
      const capsuleCreator = provider.wallet; // Use provider wallet as capsule creator
      const gamePlayer = provider.wallet; // Same player for this test

      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 3 + Math.floor(Math.random() * 5));
      const secretAnswer = "pizza";

      const capsulePda = getCapsulePda(
        capsuleCreator.publicKey,
        revealDate,
        program.programId
      );
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const accounts = {
        creator: capsuleCreator.publicKey,
        capsule: capsulePda,
        nftMint: nftMintPda,
        game: getGamePda(capsulePda, program.programId),
        vault: getVaultPda(program.programId),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      };

      // Create capsule and game
      await program.methods
        .createCapsule(
          secretAnswer, // Store plaintext content on-chain for testing
          { text: {} },
          contentHash,
          revealDate,
          true
        )
        .accounts(accounts as any)
        .rpc();

      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), capsulePda.toBuffer()],
        program.programId
      );

      // Test obviously wrong answers
      const wrongAnswers = [
        { guess: "hamburger", description: "different food" },
        { guess: "bicycle", description: "completely different category" },
        { guess: "absolutely random text", description: "nonsensical answer" },
      ];

      for (let i = 0; i < wrongAnswers.length; i++) {
        const testCase = wrongAnswers[i];

        // Submit wrong guess
        const [guessPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("guess"),
            gamePda.toBuffer(),
            gamePlayer.publicKey.toBuffer(),
            Buffer.from([i, 0, 0, 0]),
          ],
          program.programId
        );

        await program.methods
          .submitGuess(testCase.guess, false)
          .accounts({
            guesser: gamePlayer.publicKey,
            game: gamePda,
            guess: guessPda,
            systemProgram: SystemProgram.programId,
          } as any)
          .signers([gamePlayer.payer])
          .rpc();

        // Wait and reveal (if first iteration)
        await new Promise((resolve) => setTimeout(resolve, 4000));
        if (i === 0) {
          await program.methods
            .revealCapsule(revealDate)
            .accounts({
              creator: capsuleCreator.publicKey,
              capsule: capsulePda,
            } as any)
            .signers([capsuleCreator.payer])
            .rpc();
        }

        // Call semantic service with Solana validator time
        const semanticResult = await callSemanticService(
          testCase.guess,
          secretAnswer,
          DEFAULT_THRESHOLD,
          provider
        );
        console.log(
          `📊 ${testCase.description}: "${testCase.guess}" vs "${secretAnswer}"`
        );
        console.log(
          `   Similarity: ${semanticResult.similarity}, Expected: ❌ INCORRECT`
        );

        // Initialize leaderboard if needed
        const [leaderboardPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("leaderboard"), gamePlayer.publicKey.toBuffer()],
          program.programId
        );

        // Leaderboard already initialized in before() hook

        // Verify guess with Oracle signature
        await program.methods
          .verifyGuess(
            secretAnswer,
            null,
            semanticResult.is_correct,
            new anchor.BN(
              semanticResult.oracle_timestamp || Math.floor(Date.now() / 1000)
            ),
            semanticResult.oracle_nonce || "fallback_nonce",
            semanticResult.oracle_signature || ""
          )
          .accounts({
            authority: gamePlayer.publicKey,
            guess: guessPda,
            game: gamePda,
            capsule: capsulePda,
            leaderboard: leaderboardPda,
          } as any)
          .signers([gamePlayer.payer])
          .rpc();

        // Verify it's marked as incorrect
        const guess = await program.account.guess.fetch(guessPda);
        console.log(
          `   Result: ${guess.isCorrect ? "✅ CORRECT" : "❌ INCORRECT"}`
        );
        expect(guess.isCorrect).to.be.false;
      }
    });

    it("📝 Handles verbose player answers", async () => {
      const capsuleCreator = provider.wallet; // Use provider wallet as capsule creator
      const gamePlayer = provider.wallet; // Same player for this test

      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 3 + Math.floor(Math.random() * 5));
      const secretAnswer = "Michael Jackson";

      // Verbose answer that should be recognized as correct
      const verboseGuess =
        "This person is widely regarded as the most influential pop artist of all time. He revolutionized music videos, broke racial barriers, and had this incredible stage presence with his signature dance moves like the moonwalk.";

      const capsulePda = getCapsulePda(
        capsuleCreator.publicKey,
        revealDate,
        program.programId
      );
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const accounts = {
        creator: capsuleCreator.publicKey,
        capsule: capsulePda,
        nftMint: nftMintPda,
        game: getGamePda(capsulePda, program.programId),
        vault: getVaultPda(program.programId),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      };

      // Create game setup
      const encryptionKey = "testkey1234567890123456789012345678";
      const encryptedContent = CryptoJS.AES.encrypt(
        secretAnswer,
        encryptionKey
      ).toString();

      await program.methods
        .createCapsule(
          encryptedContent,
          { text: {} },
          contentHash,
          revealDate,
          true
        )
        .accounts(accounts as any)
        .rpc();

      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), capsulePda.toBuffer()],
        program.programId
      );

      // Submit verbose guess
      const [guessPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("guess"),
          gamePda.toBuffer(),
          gamePlayer.publicKey.toBuffer(),
          Buffer.from([0, 0, 0, 0]),
        ],
        program.programId
      );

      await program.methods
        .submitGuess(verboseGuess, false)
        .accounts({
          guesser: gamePlayer.publicKey,
          game: gamePda,
          guess: guessPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();

      // Wait and reveal
      await new Promise((resolve) => setTimeout(resolve, 12000));
      await program.methods
        .revealCapsule(revealDate)
        .accounts({
          creator: capsuleCreator.publicKey,
          capsule: capsulePda,
        } as any)
        .rpc();

      // Test semantic service with verbose content using Solana validator time
      const semanticResult = await callSemanticService(
        verboseGuess,
        secretAnswer,
        DEFAULT_THRESHOLD,
        provider
      );
      console.log(`📊 Verbose answer test:`);
      console.log(`   Guess: "${verboseGuess.substring(0, 100)}..."`);
      console.log(`   Answer: "${secretAnswer}"`);
      console.log(
        `   Similarity: ${semanticResult.similarity}, Method: ${semanticResult.method}`
      );

      // Initialize leaderboard
      const [leaderboardPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("leaderboard"), gamePlayer.publicKey.toBuffer()],
        program.programId
      );

      // Leaderboard already initialized in before() hook

      // Verify verbose guess with Oracle signature
      await program.methods
        .verifyGuess(
          secretAnswer,
          null,
          semanticResult.is_correct,
          new anchor.BN(
            semanticResult.oracle_timestamp || Math.floor(Date.now() / 1000)
          ),
          semanticResult.oracle_nonce || "fallback_nonce",
          semanticResult.oracle_signature || ""
        )
        .accounts({
          authority: gamePlayer.publicKey,
          guess: guessPda,
          game: gamePda,
          capsule: capsulePda,
          leaderboard: leaderboardPda,
        } as any)
        .rpc();

      const guess = await program.account.guess.fetch(guessPda);
      console.log(
        `   Result: ${guess.isCorrect ? "✅ CORRECT" : "❌ INCORRECT"}`
      );

      // Verbose answers should be handled correctly by the hybrid system
      expect(guess.isCorrect).to.be.true;
    });

    it("🎯 Multiple players with different semantic validation types", async () => {
      const capsuleCreator = provider.wallet; // Use provider wallet as capsule creator
      const player1 = provider.wallet; // Same player for this test
      const player2 = provider.wallet; // Same player for this test
      const player3 = provider.wallet; // Same player for this test
      const player4 = provider.wallet; // Same player for this test

      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 3 + Math.floor(Math.random() * 5));
      const secretAnswer = "New York City";

      const capsulePda = getCapsulePda(
        capsuleCreator.publicKey,
        revealDate,
        program.programId
      );
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const accounts = {
        creator: capsuleCreator.publicKey,
        capsule: capsulePda,
        nftMint: nftMintPda,
        game: getGamePda(capsulePda, program.programId),
        vault: getVaultPda(program.programId),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      };

      // Create game with 3 max winners
      const encryptionKey = "testkey1234567890123456789012345678";
      const encryptedContent = CryptoJS.AES.encrypt(
        secretAnswer,
        encryptionKey
      ).toString();

      await program.methods
        .createCapsule(
          encryptedContent,
          { text: {} },
          contentHash,
          revealDate,
          true
        )
        .accounts(accounts as any)
        .rpc();

      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), capsulePda.toBuffer()],
        program.programId
      );

      // Different semantic validation scenarios
      const players = [
        {
          player: player1,
          guess: "NYC",
          description: "abbreviation",
          expectedWin: true,
        },
        {
          player: player2,
          guess: "The Big Apple",
          description: "cultural nickname",
          expectedWin: true,
        },
        {
          player: player3,
          guess: "Manhattan",
          description: "related location",
          expectedWin: true,
        },
        {
          player: player4,
          guess: "Los Angeles",
          description: "wrong city",
          expectedWin: false,
        },
      ];

      // Submit all guesses
      for (let i = 0; i < players.length; i++) {
        const { player, guess } = players[i];

        const [guessPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("guess"),
            gamePda.toBuffer(),
            player.publicKey.toBuffer(),
            Buffer.from([i, 0, 0, 0]),
          ],
          program.programId
        );

        await program.methods
          .submitGuess(guess, false)
          .accounts({
            guesser: player.publicKey,
            game: gamePda,
            guess: guessPda,
            systemProgram: SystemProgram.programId,
          } as any)
          .signers([player.payer])
          .rpc();
      }

      // Wait and reveal
      await new Promise((resolve) => setTimeout(resolve, 4000));
      await program.methods
        .revealCapsule(revealDate)
        .accounts({
          creator: capsuleCreator.publicKey,
          capsule: capsulePda,
        } as any)
        .rpc();

      let winnersCount = 0;

      // Verify all guesses
      for (let i = 0; i < players.length; i++) {
        const { player, guess, description, expectedWin } = players[i];

        const [guessPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("guess"),
            gamePda.toBuffer(),
            player.publicKey.toBuffer(),
            Buffer.from([i, 0, 0, 0]),
          ],
          program.programId
        );

        // Initialize leaderboard
        const [leaderboardPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("leaderboard"), player.publicKey.toBuffer()],
          program.programId
        );

        // Leaderboard already initialized in before() hook

        // Get semantic result using Solana validator time
        const semanticResult = await callSemanticService(
          guess,
          secretAnswer,
          DEFAULT_THRESHOLD,
          provider
        );
        console.log(
          `📊 Player ${i + 1} (${description}): "${guess}" vs "${secretAnswer}"`
        );
        console.log(
          `   Similarity: ${semanticResult.similarity}, Method: ${semanticResult.method}`
        );

        // Check if game is still active before verifying
        const gameState = await program.account.game.fetch(gamePda);
        if (gameState.isActive) {
          // Verify guess with Oracle signature
          await program.methods
            .verifyGuess(
              secretAnswer,
              null,
              semanticResult.is_correct,
              new anchor.BN(
                semanticResult.oracle_timestamp || Math.floor(Date.now() / 1000)
              ),
              semanticResult.oracle_nonce || "fallback_nonce",
              semanticResult.oracle_signature || ""
            )
            .accounts({
              authority: player.publicKey,
              guess: guessPda,
              game: gamePda,
              capsule: capsulePda,
              leaderboard: leaderboardPda,
            } as any)
            .signers([player.payer])
            .rpc();

          const guessResult = await program.account.guess.fetch(guessPda);
          console.log(
            `   Result: ${
              guessResult.isCorrect ? "✅ CORRECT" : "❌ INCORRECT"
            }`
          );

          if (guessResult.isCorrect) winnersCount++;

          if (expectedWin) {
            expect(guessResult.isCorrect).to.be.true;
          } else {
            expect(guessResult.isCorrect).to.be.false;
          }
        } else {
          console.log(
            `   ⚠️ Game ended - cannot verify more guesses (${winnersCount} winners found)`
          );
        }
      }

      // Check final game state
      const finalGame = await program.account.game.fetch(gamePda);
      expect(finalGame.winnersFound).to.equal(3); // Should have 3 winners (max_winners)
      expect(finalGame.winnerFound).to.be.true; // Backward compatibility
      expect(finalGame.isActive).to.be.false; // Game should be ended

      console.log(
        `🎉 Multi-player semantic validation completed! ${winnersCount} winners found.`
      );
    });

    it("🏆 Basic winner game flow", async () => {
      const capsuleCreator = provider.wallet; // Use provider wallet as capsule creator
      const gamePlayer = provider.wallet; // Same player for this test

      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 3 + Math.floor(Math.random() * 5));
      const secretAnswer = "automobile";

      const capsulePda = getCapsulePda(
        capsuleCreator.publicKey,
        revealDate,
        program.programId
      );
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const accounts = {
        creator: capsuleCreator.publicKey,
        capsule: capsulePda,
        nftMint: nftMintPda,
        game: getGamePda(capsulePda, program.programId),
        vault: getVaultPda(program.programId),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      };

      // Create game with default settings (max_winners = 3, max_guesses = 50)
      const encryptionKey = "testkey1234567890123456789012345678";
      const encryptedContent = CryptoJS.AES.encrypt(
        secretAnswer,
        encryptionKey
      ).toString();

      await program.methods
        .createCapsule(
          encryptedContent,
          { text: {} },
          contentHash,
          revealDate,
          true
        )
        .accounts(accounts as any)
        .rpc();

      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), capsulePda.toBuffer()],
        program.programId
      );

      // Submit guess
      const [guessPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("guess"),
          gamePda.toBuffer(),
          gamePlayer.publicKey.toBuffer(),
          Buffer.from([0, 0, 0, 0]),
        ],
        program.programId
      );

      await program.methods
        .submitGuess("car", false)
        .accounts({
          guesser: gamePlayer.publicKey,
          game: gamePda,
          guess: guessPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();

      // Wait and reveal
      await new Promise((resolve) => setTimeout(resolve, 12000));
      await program.methods
        .revealCapsule(revealDate)
        .accounts({
          creator: capsuleCreator.publicKey,
          capsule: capsulePda,
        } as any)
        .rpc();

      // Initialize leaderboard
      const [leaderboardPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("leaderboard"), gamePlayer.publicKey.toBuffer()],
        program.programId
      );

      // Leaderboard already initialized in before() hook

      // Get semantic result and verify using Solana validator time
      const semanticResult = await callSemanticService(
        "car",
        secretAnswer,
        DEFAULT_THRESHOLD,
        provider
      );
      console.log(`📊 Single winner test: "car" vs "${secretAnswer}"`);
      console.log(
        `   Similarity: ${semanticResult.similarity}, Method: ${semanticResult.method}`
      );

      await program.methods
        .verifyGuess(
          secretAnswer,
          null,
          semanticResult.is_correct,
          new anchor.BN(
            semanticResult.oracle_timestamp || Math.floor(Date.now() / 1000)
          ),
          semanticResult.oracle_nonce || "fallback_nonce",
          semanticResult.oracle_signature || ""
        )
        .accounts({
          authority: gamePlayer.publicKey,
          guess: guessPda,
          game: gamePda,
          capsule: capsulePda,
          leaderboard: leaderboardPda,
        } as any)
        .rpc();

      // Verify results
      const guess = await program.account.guess.fetch(guessPda);
      expect(guess.isCorrect).to.be.true;

      const finalGame = await program.account.game.fetch(gamePda);
      expect(finalGame.winnersFound).to.equal(1);
      expect(finalGame.winnerFound).to.be.true;
      expect(finalGame.isActive).to.be.true; // Game stays active with default max_winners = 3

      console.log("🏆 Basic winner game completed successfully!");
    });
  });

  describe("Error Handling", () => {
    it("✅ Simplified semantic interface works", async () => {
      const capsuleCreator = provider.wallet; // Use provider wallet as capsule creator
      const gamePlayer = provider.wallet; // Same player for this test

      const currentTime = Math.floor(Date.now() / 1000);
      const revealDate = new anchor.BN(currentTime + 3 + Math.floor(Math.random() * 5));
      const secretAnswer = "test";

      // Create minimal game setup
      const capsulePda = getCapsulePda(
        capsuleCreator.publicKey,
        revealDate,
        program.programId
      );
      const nftMintPda = getNftMintPda(capsulePda, program.programId);
      const gamePda = getGamePda(capsulePda, program.programId);
      const accounts = {
        creator: capsuleCreator.publicKey,
        capsule: capsulePda,
        nftMint: nftMintPda,
        game: gamePda,
        vault: getVaultPda(program.programId),
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      };

      await program.methods
        .createCapsule(
          secretAnswer, // Store plaintext content on-chain for testing
          { text: {} },
          contentHash,
          revealDate,
          true
        )
        .accounts(accounts as any)
        .rpc();

      const [guessPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("guess"),
          gamePda.toBuffer(),
          gamePlayer.publicKey.toBuffer(),
          Buffer.from([0, 0, 0, 0]),
        ],
        program.programId
      );

      await program.methods
        .submitGuess("test", false)
        .accounts({
          guesser: gamePlayer.publicKey,
          game: gamePda,
          guess: guessPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();

      await new Promise((resolve) => setTimeout(resolve, 12000));
      await program.methods
        .revealCapsule(revealDate)
        .accounts({
          creator: capsuleCreator.publicKey,
          capsule: capsulePda,
        } as any)
        .rpc();

      const [leaderboardPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("leaderboard"), gamePlayer.publicKey.toBuffer()],
        program.programId
      );

      // Leaderboard already initialized in before() hook

      // Test semantic result with Oracle signature (should pass with simplified interface)
      await program.methods
        .verifyGuess(
          secretAnswer,
          null,
          true, // semantic_result
          new anchor.BN(Math.floor(Date.now() / 1000)), // oracle_timestamp
          "test_nonce", // oracle_nonce
          "" // oracle_signature (empty for fallback test)
        )
        .accounts({
          authority: gamePlayer.publicKey,
          guess: guessPda,
          game: gamePda,
          capsule: capsulePda,
          leaderboard: leaderboardPda,
        } as any)
        .rpc();

      const guess = await program.account.guess.fetch(guessPda);
      expect(guess.isCorrect).to.be.true;
      console.log("✅ Semantic validation with simplified interface works");
    });
  });
});
