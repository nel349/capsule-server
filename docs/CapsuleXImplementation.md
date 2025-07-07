# CapsuleX Implementation Documentation

## Project Overview
**CapsuleX** is a decentralized mobile application for the Solana Mobile Hackathon, enabling users to create encrypted time capsules (messages, photos, videos) stored on IPFS with Filecoin, minted as NFTs on Solana, and shared as gamified hints on X with auto-posting reveals on a user-defined date. The app integrates Solana's advanced features (Alpenglow, TEEPIN, SKR, Blinks), ElevenLabs AI audio, AR hints via Expo, and a monetized guessing game, with a future vision for modular DePIN storage. This document outlines the implementation details for developers, aligning with Solana's ecosystem and hackathon judging criteria (functionality, novelty, impact, UX, composability).

## Core Features and Implementation

### 1. Time Capsule Creation
- **Functionality**:
  - Users upload a message, photo, or video, encrypted with AES using their Solana wallet's private key.
  - Capsules are minted as NFTs on Solana with a user-set reveal date.
  - Content is stored on IPFS, with Filecoin ensuring persistence via a one-time payment.
- **Implementation**:
  - **Encryption**: Use `@noble/ciphers` for AES encryption, tying keys to the user's Solana wallet (via `@solana/web3.js`).
  - **NFT Minting**: Use Solana's `@solana/spl-token` library to mint capsules as NFTs, leveraging Alpenglow's ~150ms finality for instant transactions.
  - **Storage**: Integrate IPFS via `@helia/unixfs` for content upload; use Filecoin's API (e.g., `nft.storage`) for pinning, funded by a ~0.00005 SOL service fee (10x base fee per Helius fee analysis).
  - **Reveal Logic**: Store reveal date in the NFT metadata; use a Solana Anchor program to trigger decryption and X posting on the set date.
  - **Solana Program**: Build with `@coral-xyz/anchor` framework to handle:
    - Time capsule creation and metadata storage
    - Reveal date validation and automated triggers  
    - NFT minting with custom metadata
    - Reward distribution logic
    - Base transaction fee: 0.000005 SOL per Helius fee analysis
- **Tech Stack**:
  - Solana: `@solana/web3.js`, `@solana/spl-token`, `@coral-xyz/anchor`
  - IPFS: `@helia/unixfs`
  - Filecoin: `nft.storage`
  - Encryption: `@noble/ciphers`

### 2. Gamified Guessing Game
- **Functionality**:
  - Two modes: **Locked** (no guessing) or **Gamified** (hints shared on X, guessing enabled).
  - All guesses require small service fee (~0.000005 SOL) to cover gas + platform costs (no gambling).
  - First correct guess wins **100 points** and an NFT badge.
  - All participants get **5 points** for playing.
  - Capsule creators get **50 points per participant** as engagement bonus.
- **Implementation**:
  - **Hint Sharing**: Users create text/emoji hints or use ElevenLabs API for AI audio hints, posted to X via `@x-api-sdk/core` with a clickable Blink URL.
  - **Guess Tracking**: Use X API to monitor replies to hint posts; verify guesses against the capsule's decrypted content (stored in the Anchor program).
  - **Reward System**: Anchor program logs guesses, verifies correct ones, and awards points to leaderboard.
  - **Program Instructions**:
    - `initialize_game()` - Set up guessing game with participant limits
    - `submit_guess()` - Record guesses with small service fee
    - `verify_guess()` - Check correct guesses and award points
    - `complete_game()` - Finalize game and award creator bonus points
    - `mint_badge()` - Create NFT badges for winners
  - **Service Fee**: Small ~0.000005 SOL (1x base fee) covers gas + platform costs (not gambling).
- **Tech Stack**:
  - Solana: `@solana/web3.js`, Solana Pay
  - X API: `@x-api-sdk/core` for OAuth and reply tracking
  - ElevenLabs: API for text-to-speech audio hints

### 3. X Integration
- **Functionality**:
  - Users authorize X via OAuth to post hints and reveals.
  - Hints include text, audio (MP3 from ElevenLabs), or Blinks for one-tap guessing.
  - Capsules auto-post to X on the reveal date, with optional audio or visual flair.
- **Implementation**:
  - **OAuth**: Use `@x-api-sdk/core` to authenticate users and get posting permissions.
  - **Auto-Posting**: Schedule posts via a Solana Anchor program that triggers X API calls on the reveal date, using decrypted content.
  - **Blinks**: Integrate Solana's Blinks (`@solana/actions`) to embed one-tap links in X posts for guessing or capsule creation.
  - **Media Posts**: Upload images with ElevenLabs-generated audio converted to video format, as X API doesn't support direct audio uploads.
  - **API Costs**: Minimum $100/month for Basic tier required for meaningful usage
- **Tech Stack**:
  - X API: `@x-api-sdk/core`
  - Solana Blinks: `@solana/actions`
  - ElevenLabs: API for audio uploads

### 4. AR Hints at Geofenced Events
- **Functionality**:
  - Users at events unlock 3D AR hints (riddles, emojis) via phone camera, triggered by geofencing.
  - Enhances guessing game with immersive, location-based clues.
- **Implementation**:
  - **AR**: Use `expo-three-ar` or `viro-react` for 3D holographic hints (e.g., spinning emojis).
  - **Geofencing**: Use `expo-location` to detect when users enter event coordinates, unlocking AR content.
  - **Storage**: Store AR hint metadata on IPFS, pinned via Filecoin (~0.000025 SOL (5x base fee per Helius) fee).
  - **Integration**: Tie AR unlocks to Solana Anchor programs for verification and reward eligibility.
- **Tech Stack**:
  - Expo: `expo-three-ar`, `expo-location`
  - Solana: `@solana/web3.js`
  - IPFS/Filecoin: `@helia/unixfs`, `nft.storage`

### 5. Security and Privacy
- **Functionality**:
  - TEEPIN secures encryption keys and wallet interactions.
  - SKR manages private keys for seamless signing.
  - AES encryption ensures only authorized users decrypt capsules.
- **Implementation**:
  - **TEEPIN**: Use Solana Mobile SDK to integrate Trusted Execution Environment for key storage.
  - **SKR**: Implement Solana Key Relayer for secure wallet interactions, compatible with Phantom or other wallets.
  - **Encryption**: Apply `@noble/ciphers` for AES, tying keys to Solana wallet addresses.
  - **Compliance**: Ensure OAuth for X posts; store only user-consented data on IPFS.
- **Tech Stack**:
  - Solana Mobile: TEEPIN, SKR via Solana SDK
  - Encryption: `@noble/ciphers`

### 6. Monetization and Rewards
- **Functionality**:
  - **Capsule Creation Fee**: ~0.00005 SOL for NFT minting and IPFS storage.
  - **Service Fee**: ~0.000005 SOL (1x base fee) per guess covers gas + platform costs.
  - **Premium Features**: ~0.000025 SOL (5x base fee per Helius) for AR hints, custom reveal themes, or NFT badges.
  - **Points-Based Rewards**: 100 points for winners, 5 points for participants, 50 points per participant to creators.
  - **NFT Badges**: Winners get tradeable NFTs; automatic minting for game winners.
  - **Legal Compliance**: Points-based system avoids gambling regulations while maintaining engagement.
- **Implementation**:
  - **Service Fees**: Use Solana Pay for minimal service fee collection via `@solana/web3.js`.
  - **Points Distribution**: Smart contract handles points awards to leaderboard accounts.
  - **Fee Management**: Minimal service fees cover operational costs; focus on user engagement over revenue.
- **Tech Stack**:
  - Solana: `@solana/web3.js`, Solana Pay
  - NFT: `@solana/spl-token`

### 7. Engagement Features
- **Functionality**:
  - **Leaderboard**: Tracks top guessers/creators by points earned with Solana-minted NFT trophies (~0.00001 SOL to mint).
  - **Capsule Vault**: Users browse past capsules, share stats on X for ~0.000025 SOL (5x base fee per Helius) (premium designs).
  - **Push Notifications**: Firebase alerts for new hints, guesses, or reveals.
  - **Achievement System**: Milestone rewards encourage continued engagement through points collection.
- **Implementation**:
  - **Leaderboard**: Store stats in a Solana program for transparency; mint trophies via `@solana/spl-token`.
  - **Vault**: Build a React Native UI with `expo` to display capsule history; use Tailwind CSS for styling.
  - **Notifications**: Integrate `firebase-admin` for push alerts triggered by Solana events or X replies.
- **Tech Stack**:
  - Solana: `@solana/web3.js`, `@solana/spl-token`, `@coral-xyz/anchor`
  - Firebase: `firebase-admin`
  - Expo: `expo`, `react-native`

### Hybrid Storage Validation Update (2024-06)
- CapsuleX now supports both on-chain and IPFS storage for encrypted capsule content.
- **OnChain:** Encrypted content must be ≤280 characters.
- **IPFS:** Hash must start with 'Qm' and be 46-59 characters (supports v0/v1 CIDs).
- This ensures compatibility with current and future IPFS hash formats.
- The test suite uses a valid mock IPFS hash: `"Qm" + "a".repeat(44)` (46 chars) to ensure compliance with validation logic.

## Technical Stack Summary
- **Blockchain**: Solana (`@solana/web3.js`, `@solana/spl-token`, `@solana/actions`, Solana Pay)
- **Storage**: IPFS (`@helia/unixfs`), Filecoin (`nft.storage`)
- **Security**: TEEPIN, SKR (Solana Mobile SDK), AES (`@noble/ciphers`)
- **AI**: ElevenLabs API for text-to-speech audio
- **AR/Geofencing**: Expo (`expo-three-ar`, `expo-location`)
- **UI/UX**: Expo, React Native, Tailwind CSS
- **Social**: X API (`@x-api-sdk/core`) for OAuth, posting, reply tracking
- **Notifications**: Firebase (`firebase-admin`)

## Wishlist for Future Enhancements
- **Modular DePIN Storage**:
  - Allow users to contribute phone storage to pin CapsuleX's IPFS data, earning ~0.001 SOL rewards per MB.
  - Implementation: Use a Solana program to track storage contributions; integrate with IPFS nodes.
  - Why: Reduces Filecoin costs, enhances decentralization, aligns with Mert's DePIN interest (per DePitch Academy).
  - Status: Use regular IPFS/Filecoin for hackathon; DePIN is a post-hackathon goal for app-specific storage scalability.
- **Ephemeral NFTs**:
  - Mint temporary NFTs that auto-destruct post-reveal, saving storage costs.
  - Implementation: Use `@solana/spl-token` with a burn function triggered by reveal date.
  - Why: Aligns with Mert's Hyperdrive judging (epPlex win), adds novelty.
- **Multi-Recipient Capsules**:
  - Allow multiple wallet addresses to unlock a capsule.
  - Implementation: Update Anchor program to support multi-key decryption.
  - Why: Enhances social use cases, boosts adoption.
- **AI Analytics**:
  - Use TensorFlow Lite for on-device analysis of X reply patterns, suggesting better hints.
  - Implementation: Integrate `tensorflow-lite` for lightweight processing.
  - Why: Appeals to Mert's AI hackathon judging interest.
- **On-Chain Leaderboard Expansion**:
  - Store detailed stats on Solana for transparency.
  - Implementation: Extend Solana program to log engagement metrics.
  - Why: Matches Mert's transparency focus.

## Implementation Timeline and Feature Availability (2025)
- **Immediately Available**: Basic Solana features, IPFS/Filecoin, X API, AR (with Expo Bare Workflow)
- **Q3 2025**: Alpenglow (150ms finality), improved performance  
- **August 2025**: TEEPIN and SKR with Seeker phone launch
- **Ongoing**: X API compliance review required for automated posting

## Corrected Technical Details

### Pricing Structure (Based on Helius Fee Analysis)
**Solana Base Fee**: 0.000005 SOL (~$0.00077 at $153/SOL)
- **Capsule Creation**: 0.00005 SOL (~$0.008) - 10x base fee
- **Service Fee per Guess**: 0.000005 SOL (~$0.00077) - 1x base fee (gas + platform)
- **Premium Features**: 0.000025 SOL (~$0.004) - 5x base fee

### Package Updates (2025 Current)
- **IPFS**: `@helia/unixfs` (replaces deprecated `ipfs-http-client`)
- **Filecoin**: `nft.storage` or `filebase` (replaces deprecated `web3.storage`)
- **X API**: `@x-api-sdk/core` (official X API TypeScript SDK)
- **Solana Program**: `@coral-xyz/anchor` framework required

### Major Corrections Made
1. **Legal compliance**: Switched from gambling model to points-based entertainment
2. **Updated deprecated packages**: Modern alternatives for IPFS/Filecoin
3. **Fixed X API**: Correct package, removed unsupported audio uploads  
4. **Added Solana program details**: Anchor framework, instructions, account structure
5. **Timeline clarifications**: Noted when features become available
6. **Service fee structure**: Minimal fees cover operational costs, no gambling

**Source**: [Solana Fees in Theory and Practice - Helius](https://www.helius.dev/blog/solana-fees-in-theory-and-practice)

## User Flow