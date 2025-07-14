# Final SOL Onramp Strategy - CapsuleX

## 🎯 **Decision: Moonpay Integration**

### **Why Moonpay?**
- ✅ **Proven integration** exists in Cultivest project
- ✅ **Complete implementation** available to adapt
- ✅ **Fastest development** for hackathon timeline
- ✅ **Multi-currency support** (already includes SOL)
- ✅ **Webhook infrastructure** for payment processing

### **Tradeoffs Accepted**
- ❌ **$20 minimum** purchase (higher than alternatives like Transak $15)
- ✅ **Mitigated by UX messaging**: "One-time setup for 2000+ capsules"

## 🔄 **User Flow Integration**

### **Just-in-Time SOL Checking**
```
User Experience Flow:
1. User opens app → (No SOL check here)
2. User fills out capsule form → (No SOL check here)  
3. User clicks "Create Capsule" → CHECK SOL BALANCE
   ├── If sufficient SOL (≥0.00005) → Proceed with creation
   └── If insufficient SOL → Show onramp modal
```

### **Onramp Modal Flow**
```
SOL Onramp Modal:
┌─────────────────────────────────────┐
│ 🚀 Fuel Your Time Capsules         │
│                                     │
│ You need SOL to create capsules     │
│                                     │
│ 💰 One-time $20 SOL setup          │
│ ⚡ Good for 2000+ time capsules     │
│ 💸 Less than $0.01 per future tweet│
│ 🔒 Secure payment via MoonPay      │
│                                     │
│ [Buy SOL - $20] [I Have SOL]       │
└─────────────────────────────────────┘
```

### **Post-Purchase Flow**
```
After Moonpay Success:
1. Moonpay webhook → Backend confirms payment
2. SOL appears in user wallet (via Moonpay)
3. User returns to app → Auto-retry capsule creation
4. Success! Capsule created
```

## 🛠 **Technical Implementation**

### **Frontend Components (Mobile)**
```typescript
// Adapt from Cultivest's FundingModal.tsx
const SOLOnrampModal = {
  trigger: 'Insufficient SOL balance',
  currency: 'SOL only (not multi-currency)',
  minimum: '$20 USD',
  messaging: 'One-time setup theme',
  integration: '@moonpay/react-native-moonpay-sdk'
};
```

### **Backend Integration**
```typescript
// Adapt from Cultivest's utils/moonpay.ts
const moonpayConfig = {
  currency: 'sol', // Fixed to SOL only
  sandbox: true,   // Switch to production later
  webhook: '/api/v1/moonpay/webhook',
  signing: '/api/v1/moonpay/sign-url'
};
```

### **Balance Checking Logic**
```typescript
const checkSOLBalance = async (walletAddress: string) => {
  const connection = new Connection(SOLANA_RPC_URL);
  const balance = await connection.getBalance(new PublicKey(walletAddress));
  const solBalance = balance / LAMPORTS_PER_SOL;
  
  const requiredSOL = 0.00005; // Capsule creation fee
  return {
    current: solBalance,
    required: requiredSOL,
    sufficient: solBalance >= requiredSOL
  };
};
```

## 📱 **UX Messaging Strategy**

### **Psychology: Frame as Investment, Not Cost**
- ❌ **Don't say**: "You need to pay $20"
- ✅ **Do say**: "One-time setup for unlimited future posting"

### **Value Proposition**
```typescript
const messaging = {
  headline: "Fuel Your Time Capsules",
  subtext: "One-time $20 SOL setup",
  benefit: "Good for 2000+ time capsules", 
  value: "Less than $0.01 per future tweet",
  comparison: "Cheaper than a coffee for years of scheduled tweets",
  urgency: "Required to secure your content on blockchain"
};
```

### **Alternative Option**
```typescript
const fallback = {
  button: "I already have SOL",
  action: "Skip to manual wallet funding instructions",
  target: "Existing crypto users who prefer self-funding"
};
```

## 🔧 **Environment Configuration**

### **Moonpay Environment Variables**
```env
# Moonpay Configuration (from Cultivest)
MOONPAY_API_KEY=pk_test_...         # Sandbox key initially
MOONPAY_SECRET_KEY=sk_test_...      # For URL signing
MOONPAY_WEBHOOK_SECRET=whsec_...    # For webhook verification
MOONPAY_BASE_URL=https://buy-sandbox.moonpay.com  # Sandbox initially

# SOL-specific settings
MOONPAY_DEFAULT_CURRENCY=sol        # Always SOL for CapsuleX
MOONPAY_MIN_AMOUNT=20              # $20 minimum
```

### **Integration with Existing Systems**
```typescript
// Wallet Management (Privy + Direct Wallet)
const getWalletForOnramp = (user) => {
  if (user.authType === 'privy') {
    return user.privyEmbeddedWallet.solanaAddress;
  } else {
    return user.connectedWallet.publicKey.toString();
  }
};
```

## 🎲 **Edge Cases & Error Handling**

### **Moonpay Failure Scenarios**
1. **User cancels payment** → Return to capsule form, no error
2. **Payment fails** → Show retry option + manual SOL instructions
3. **Webhook fails** → Backend retries, user sees "Payment processing..."
4. **Network errors** → Graceful degradation with manual SOL option

### **Balance Edge Cases**
1. **SOL price volatility** → Always check fresh balance before capsule creation
2. **Concurrent capsule creation** → Check balance in smart contract, not just frontend
3. **Testnet vs mainnet** → Different SOL amounts, different Moonpay behavior

## 📊 **Success Metrics**

### **Onramp Conversion Tracking**
```typescript
const onrampMetrics = {
  'onramp_modal_shown': 'User sees SOL funding modal',
  'onramp_started': 'User clicks Buy SOL button',
  'onramp_completed': 'Moonpay webhook confirms payment',
  'onramp_to_capsule': 'User creates capsule after funding',
  'onramp_abandonment': 'User closes modal without purchasing'
};
```

### **Expected Conversion Rates**
- **Modal shown → Started**: 60-70% (good UX messaging)
- **Started → Completed**: 70-80% (Moonpay conversion rate)
- **Completed → Capsule created**: 90%+ (should be immediate)

## 🚀 **Implementation Priority**

### **Phase 1: Basic Integration**
1. Adapt Cultivest's Moonpay components
2. Add SOL balance checking to capsule creation
3. Simple onramp modal with fixed $20 messaging

### **Phase 2: UX Polish**
1. Optimize onramp messaging and design
2. Add progress indicators for payment processing
3. Implement retry logic and error handling

### **Phase 3: Advanced Features**
1. Smart amount suggestions based on user behavior
2. Alternative onramp providers (if needed)
3. SOL gifting between users

## ✅ **Ready for Implementation**

All decisions finalized:
- **Provider**: Moonpay (adapted from Cultivest)
- **Trigger**: Just-in-time when creating capsules
- **Amount**: $20 minimum with positive messaging
- **Integration**: Complete backend + mobile SDK available
- **Fallback**: Manual SOL option for existing crypto users

**Next step**: Set up Supabase database schema with SOL balance tracking!