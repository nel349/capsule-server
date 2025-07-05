import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Capsulex } from "../target/types/capsulex";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { describe, before, it } from "mocha";
import { expect } from "chai";
import { VAULT_SEED, CAPSULE_SEED, CAPSULE_MINT_SEED } from "./constants";

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
    const contentHash = "Hello, world!";
    const revealDate = new anchor.BN(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
    
    // Find the capsule PDA
    const [capsulePda, capsuleBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(CAPSULE_SEED),
        provider.wallet.publicKey.toBuffer(),
        Buffer.from(contentHash)
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
      contentHash,
      revealDate,
      false
    ).accounts({
      creator: provider.wallet.publicKey,
      capsule: capsulePda,
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
    expect(capsule.contentHash).to.be.equal(contentHash);
    console.log("Capsule content hash:", capsule.contentHash);
  });
});
