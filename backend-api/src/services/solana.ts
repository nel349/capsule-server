import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  sendAndConfirmTransaction,
  ConfirmOptions,
  Commitment,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { AnchorProvider, Program, Wallet, BN, utils } from '@coral-xyz/anchor';
import { Capsulex } from '@capsulex/types';
import crypto from 'crypto';

// Constants from tests
const VAULT_SEED = "vault";
const CAPSULE_SEED = "capsule";
const CAPSULE_MINT_SEED = "capsule_mint";
const GAME_SEED = "game";
const GUESS_SEED = "guess";
const LEADERBOARD_SEED = "leaderboard";

export interface CapsuleData {
  contentHash: string;
  revealDate: BN;
  isRevealed: boolean;
  creator: PublicKey;
  nftMint?: PublicKey;
}

export interface CreateCapsuleParams {
  content: string;
  contentHash: string;
  revealDate: Date;
  isGamified?: boolean;
}

export interface RevealCapsuleParams {
  capsuleId: string;
  revealDate: BN;
}

export class SolanaService {
  private connection: Connection;
  private program: Program<Capsulex> | null = null;
  private provider: AnchorProvider | null = null;

  constructor(rpcUrl?: string, commitment: Commitment = 'confirmed') {
    this.connection = new Connection(rpcUrl || clusterApiUrl('devnet'), commitment);
  }

  /**
   * Get the connection instance
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Initialize the program with a wallet
   */
  async initializeProgram(wallet: Keypair, idl: Capsulex): Promise<void> {
    const anchorWallet = new Wallet(wallet);
    this.provider = new AnchorProvider(this.connection, anchorWallet, {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    });
    this.program = new Program<Capsulex>(idl, this.provider);
  }

  /**
   * Get the program instance
   */
  getProgram(): Program<Capsulex> {
    if (!this.program) {
      throw new Error('Program not initialized. Call initializeProgram first.');
    }
    return this.program;
  }

  /**
   * Get the provider instance
   */
  getProvider(): AnchorProvider {
    if (!this.provider) {
      throw new Error('Provider not initialized. Call initializeProgram first.');
    }
    return this.provider;
  }

  // =============================================================================
  // PDA DERIVATION UTILITIES (matching test patterns)
  // =============================================================================

  /**
   * Get capsule PDA (matching test pattern)
   */
  getCapsulePda(creator: PublicKey, revealDate: BN): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(CAPSULE_SEED),
        creator.toBuffer(),
        Buffer.from(revealDate.toArray('le', 8))
      ],
      this.getProgram().programId
    );
    return pda;
  }

  /**
   * Get NFT mint PDA (matching test pattern)
   */
  getNftMintPda(capsule: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from(CAPSULE_MINT_SEED), capsule.toBuffer()],
      this.getProgram().programId
    );
    return pda;
  }

  /**
   * Get vault PDA (matching test pattern)
   */
  getVaultPda(): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from(VAULT_SEED)],
      this.getProgram().programId
    );
    return pda;
  }

  /**
   * Get game PDA (matching test pattern)
   */
  getGamePda(capsule: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from(GAME_SEED), capsule.toBuffer()],
      this.getProgram().programId
    );
    return pda;
  }

  /**
   * Get guess PDA (matching test pattern)
   */
  getGuessPda(game: PublicKey, guesser: PublicKey, guessIndex: number): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(GUESS_SEED),
        game.toBuffer(),
        guesser.toBuffer(),
        Buffer.from(new Uint32Array([guessIndex]).buffer)
      ],
      this.getProgram().programId
    );
    return pda;
  }

  /**
   * Get leaderboard PDA (matching test pattern)
   */
  getLeaderboardPda(user: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from(LEADERBOARD_SEED), user.toBuffer()],
      this.getProgram().programId
    );
    return pda;
  }

  // =============================================================================
  // UTILITY FUNCTIONS
  // =============================================================================

  /**
   * Get SOL balance for a public key
   */
  async getBalance(publicKey: PublicKey): Promise<number> {
    const balance = await this.connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  }

  /**
   * Transfer SOL between accounts
   */
  async transferSol(
    from: Keypair,
    to: PublicKey,
    amount: number,
    options?: ConfirmOptions
  ): Promise<string> {
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: from.publicKey,
        toPubkey: to,
        lamports: amount * LAMPORTS_PER_SOL,
      })
    );

    return await sendAndConfirmTransaction(this.connection, transaction, [from], options);
  }

  /**
   * Create SHA-256 hash (matching test pattern)
   */
  createSHA256Hash(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Convert Date to BN timestamp
   */
  dateToBN(date: Date): BN {
    return new BN(Math.floor(date.getTime() / 1000));
  }

  /**
   * Convert BN timestamp to Date
   */
  timestampToDate(timestamp: BN): Date {
    return new Date(timestamp.toNumber() * 1000);
  }

  /**
   * Create a content hash using SHA-256
   */
  createContentHash(content: string): string {
    return this.createSHA256Hash(content);
  }

  /**
   * Validate a public key string
   */
  isValidPublicKey(publicKeyString: string): boolean {
    try {
      new PublicKey(publicKeyString);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get account info for a public key
   */
  async getAccountInfo(publicKey: PublicKey) {
    return await this.connection.getAccountInfo(publicKey);
  }

  /**
   * Check if an account exists
   */
  async accountExists(publicKey: PublicKey): Promise<boolean> {
    const account = await this.getAccountInfo(publicKey);
    return account !== null;
  }

  // =============================================================================
  // CONTRACT CALL METHODS (matching test patterns)
  // =============================================================================

  /**
   * Initialize the program vault (one-time setup)
   */
  async initializeProgramVault(payer: Keypair): Promise<string> {
    const program = this.getProgram();
    const vaultPda = this.getVaultPda();

    try {
      const tx = await program.methods
        .initializeProgram()
        .accounts({
          authority: payer.publicKey,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([payer])
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error initializing program vault:', error);
      throw error;
    }
  }

  /**
   * Create a capsule on-chain (matching test pattern)
   */
  async createCapsule(params: {
    content: string;
    contentHash: string;
    revealDate: Date;
    payer: Keypair;
    isGamified?: boolean;
  }): Promise<string> {
    const program = this.getProgram();
    const { content, contentHash, revealDate, payer, isGamified = false } = params;

    // Convert reveal date to BN (Unix timestamp)
    const revealTimestamp = this.dateToBN(revealDate);

    // Derive PDAs (matching test pattern)
    const capsulePda = this.getCapsulePda(payer.publicKey, revealTimestamp);
    const nftMintPda = this.getNftMintPda(capsulePda);
    const vaultPda = this.getVaultPda();

    try {
      const tx = await program.methods
        .createCapsule(
          content,
          { text: {} }, // content_storage
          contentHash,
          revealTimestamp,
          isGamified
        )
        .accounts({
          creator: payer.publicKey,
          capsule: capsulePda,
          nftMint: nftMintPda,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: utils.token.TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        } as any)
        .signers([payer])
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error creating capsule:', error);
      throw error;
    }
  }

  /**
   * Reveal a capsule on-chain (matching test pattern)
   */
  async revealCapsule(params: {
    creator: PublicKey;
    revealDate: BN;
    payer: Keypair;
  }): Promise<string> {
    const program = this.getProgram();
    const { creator, revealDate, payer } = params;

    // Derive capsule PDA
    const capsulePda = this.getCapsulePda(creator, revealDate);

    try {
      const tx = await program.methods
        .revealCapsule(revealDate)
        .accounts({
          creator: payer.publicKey,
          capsule: capsulePda,
        } as any)
        .signers([payer])
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error revealing capsule:', error);
      throw error;
    }
  }

  /**
   * Initialize a game (matching test pattern)
   */
  async initializeGame(params: {
    capsule: PublicKey;
    maxGuesses: number;
    maxWinners: number;
    payer: Keypair;
  }): Promise<string> {
    const program = this.getProgram();
    const { capsule, maxGuesses, maxWinners, payer } = params;

    // Derive game PDA
    const gamePda = this.getGamePda(capsule);

    try {
      const tx = await program.methods
        .initializeGame(capsule, maxGuesses, maxWinners)
        .accounts({
          creator: payer.publicKey,
          capsule: capsule,
          game: gamePda,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([payer])
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error initializing game:', error);
      throw error;
    }
  }

  /**
   * Submit a guess for a game (matching test pattern)
   */
  async submitGuess(params: {
    game: PublicKey;
    guess: string;
    isAnonymous: boolean;
    payer: Keypair;
    guessIndex: number;
  }): Promise<string> {
    const program = this.getProgram();
    const { game, guess, isAnonymous, payer, guessIndex } = params;

    // Derive PDAs
    const guessPda = this.getGuessPda(game, payer.publicKey, guessIndex);
    const vaultPda = this.getVaultPda();

    try {
      const tx = await program.methods
        .submitGuess(guess, isAnonymous)
        .accounts({
          guesser: payer.publicKey,
          game: game,
          guess: guessPda,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([payer])
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error submitting guess:', error);
      throw error;
    }
  }

  /**
   * Initialize leaderboard (matching test pattern)
   */
  async initializeLeaderboard(params: {
    user: PublicKey;
    payer: Keypair;
  }): Promise<string> {
    const program = this.getProgram();
    const { user, payer } = params;

    // Derive leaderboard PDA
    const leaderboardPda = this.getLeaderboardPda(user);

    try {
      const tx = await program.methods
        .initializeLeaderboard(user)
        .accounts({
          authority: payer.publicKey,
          user: user,
          leaderboard: leaderboardPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([payer])
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error initializing leaderboard:', error);
      throw error;
    }
  }

  /**
   * Verify a guess (matching test pattern)
   */
  async verifyGuess(params: {
    guess: PublicKey;
    game: PublicKey;
    capsule: PublicKey;
    leaderboard: PublicKey;
    decryptedContent: string;
    semanticResult: boolean;
    oracleTimestamp: BN;
    oracleNonce: string;
    oracleSignature: string;
    payer: Keypair;
    verificationWindowHours?: number;
  }): Promise<string> {
    const program = this.getProgram();
    const {
      guess,
      game,
      capsule,
      leaderboard,
      decryptedContent,
      semanticResult,
      oracleTimestamp,
      oracleNonce,
      oracleSignature,
      payer,
      verificationWindowHours = null,
    } = params;

    try {
      const tx = await program.methods
        .verifyGuess(
          decryptedContent,
          verificationWindowHours,
          semanticResult,
          oracleTimestamp,
          oracleNonce,
          oracleSignature
        )
        .accounts({
          authority: payer.publicKey,
          guess: guess,
          game: game,
          capsule: capsule,
          leaderboard: leaderboard,
        } as any)
        .signers([payer])
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error verifying guess:', error);
      throw error;
    }
  }

  /**
   * Complete a game (matching test pattern)
   */
  async completeGame(params: {
    game: PublicKey;
    capsule: PublicKey;
    creatorLeaderboard: PublicKey;
    payer: Keypair;
  }): Promise<string> {
    const program = this.getProgram();
    const { game, capsule, creatorLeaderboard, payer } = params;

    try {
      const tx = await program.methods
        .completeGame()
        .accounts({
          authority: payer.publicKey,
          game: game,
          capsule: capsule,
          creator_leaderboard: creatorLeaderboard,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([payer])
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error completing game:', error);
      throw error;
    }
  }

  // =============================================================================
  // DATA FETCHING METHODS
  // =============================================================================

  /**
   * Fetch capsule data from on-chain
   */
  async getCapsuleData(creator: PublicKey, revealDate: BN): Promise<CapsuleData | null> {
    const program = this.getProgram();
    const capsulePda = this.getCapsulePda(creator, revealDate);

    try {
      const capsuleAccount = await program.account.capsule.fetch(capsulePda);
      return {
        contentHash: capsuleAccount.contentIntegrityHash,
        revealDate: capsuleAccount.revealDate,
        isRevealed: capsuleAccount.isRevealed,
        creator: capsuleAccount.creator,
        nftMint: capsuleAccount.nftMint,
      };
    } catch (error) {
      console.error('Error fetching capsule data:', error);
      return null;
    }
  }

  /**
   * Fetch game data from on-chain
   */
  async getGameData(capsule: PublicKey): Promise<any | null> {
    const program = this.getProgram();
    const gamePda = this.getGamePda(capsule);

    try {
      const gameAccount = await program.account.game.fetch(gamePda);
      return gameAccount;
    } catch (error) {
      console.error('Error fetching game data:', error);
      return null;
    }
  }

  /**
   * Fetch guess data from on-chain
   */
  async getGuessData(game: PublicKey, guesser: PublicKey, guessIndex: number): Promise<any | null> {
    const program = this.getProgram();
    const guessPda = this.getGuessPda(game, guesser, guessIndex);

    try {
      const guessAccount = await program.account.guess.fetch(guessPda);
      return guessAccount;
    } catch (error) {
      console.error('Error fetching guess data:', error);
      return null;
    }
  }

  /**
   * Fetch leaderboard data from on-chain
   */
  async getLeaderboardData(user: PublicKey): Promise<any | null> {
    const program = this.getProgram();
    const leaderboardPda = this.getLeaderboardPda(user);

    try {
      const leaderboardAccount = await program.account.leaderboardEntry.fetch(leaderboardPda);
      return leaderboardAccount;
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
      return null;
    }
  }

  /**
   * Get all games for a capsule
   */
  async getGamesForCapsule(capsule: PublicKey): Promise<any[]> {
    const program = this.getProgram();
    
    try {
      const games = await program.account.game.all([
        {
          memcmp: {
            offset: 8, // Skip discriminator
            bytes: capsule.toBase58(),
          },
        },
      ]);
      return games;
    } catch (error) {
      console.error('Error fetching games:', error);
      return [];
    }
  }
} 