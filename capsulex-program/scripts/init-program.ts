import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Capsulex } from "../target/types/capsulex";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { VAULT_SEED } from "../tests/constants";

async function initializeProgram() {
  console.log("🚀 Initializing CapsuleX Program...");
  
  // Configure the client to use the environment cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.capsulex as Program<Capsulex>;
  
  console.log(`📡 Cluster: ${provider.connection.rpcEndpoint}`);
  console.log(`👤 Authority: ${provider.wallet.publicKey.toBase58()}`);
  console.log(`📦 Program ID: ${program.programId.toBase58()}`);

  // Find the vault PDA
  let vaultPda: PublicKey;
  let vaultBump: number;
  
  [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED)],
    program.programId
  );

  console.log(`🏦 Vault PDA: ${vaultPda.toBase58()}`);

  try {
    // Check if program is already initialized
    try {
      const existingVault = await program.account.programVault.fetch(vaultPda);
      console.log("✅ Program already initialized!");
      console.log(`   Authority: ${existingVault.authority.toBase58()}`);
      console.log(`   Total Fees Collected: ${existingVault.totalFeesCollected.toNumber()}`);
      return;
    } catch (fetchError) {
      // Vault doesn't exist, proceed with initialization
      console.log("🔧 Program not initialized yet, proceeding with initialization...");
    }

    // Initialize the program
    const tx = await program.methods.initializeProgram()
      .accounts({
        authority: provider.wallet.publicKey,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();
    
    console.log("🎉 Program initialized successfully!");
    console.log(`   Transaction: ${tx}`);
    
    // Verify the vault was created
    const vault = await program.account.programVault.fetch(vaultPda);
    console.log("✅ Verification completed:");
    console.log(`   Authority: ${vault.authority.toBase58()}`);
    console.log(`   Total Fees Collected: ${vault.totalFeesCollected.toNumber()}`);
    console.log(`   Vault PDA: ${vaultPda.toBase58()}`);
    
  } catch (error) {
    console.error("❌ Failed to initialize program:");
    console.error(error);
    process.exit(1);
  }
}

// Run the initialization
initializeProgram()
  .then(() => {
    console.log("🏁 Initialization script completed successfully!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("💥 Initialization script failed:", err);
    process.exit(1);
  });
