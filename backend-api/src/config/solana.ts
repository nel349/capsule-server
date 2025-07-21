import { PublicKey } from '@solana/web3.js';

// CapsuleX Program Configuration
export const CAPSULEX_PROGRAM_CONFIG = {
  cluster: 'https://api.devnet.solana.com',
  programId: 'J1r7tHjxEuCcSYVrikUKxzyeeccuC3QbyHjUbY8Pw7uH',
  authority: 'FnnLFxD5jZh9dhMbPBYvon3nBWm2gmJDaQnXJhYD2G12',
  vaultPda: '2c9QnE9n793XdjzmbWTAjbUFnhLzdgTAWBeV1o5WytXB',
  initializationTx:
    '51mxMwtmpuCUaArR68mm3b5H9T7GPhrVUfmn1tWp88L5VADVmorsKoETnXnJfqBJPM4Rrr5eXtP7WMNrjAcDz7wq',
} as const;

// Program Constants as PublicKey objects
export const PROGRAM_CONSTANTS = {
  PROGRAM_ID: new PublicKey(CAPSULEX_PROGRAM_CONFIG.programId),
  AUTHORITY: new PublicKey(CAPSULEX_PROGRAM_CONFIG.authority),
  VAULT_PDA: new PublicKey(CAPSULEX_PROGRAM_CONFIG.vaultPda),
} as const;

// Export individual constants for convenience
export const { PROGRAM_ID, AUTHORITY, VAULT_PDA } = PROGRAM_CONSTANTS; 