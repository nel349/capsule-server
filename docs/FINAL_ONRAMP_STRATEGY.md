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
User Experience Flow:
1. User opens app
2. User fills out capsule form
3. User clicks "Create Capsule" → SOL BALANCE IS CHECKED
   - If sufficient SOL → Proceed with creation
   - If insufficient SOL → Show onramp modal

### **Onramp Modal Flow**
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

### **Post-Purchase Flow**
After Moonpay Success:
1. Moonpay confirms payment
2. SOL appears in user wallet
3. User returns to app → Auto-retry capsule creation
4. Success! Capsule created

## 🛠 **Implementation Notes**

### **Frontend Components (Mobile)**
We will adapt existing components for the SOL Onramp Modal, focusing on messaging and integrating the Moonpay SDK.

### **Backend Integration**
The backend will integrate with Moonpay's systems to handle currency conversion and webhook notifications.

### **Balance Checking Logic**
The system will check the user's SOL balance against the required amount for capsule creation.

## 📱 **UX Messaging Strategy**

### **Psychology: Frame as Investment, Not Cost**
- ❌ **Don't say**: "You need to pay $20"
- ✅ **Do say**: "One-time setup for unlimited future posting"

### **Value Proposition**
- Headline: "Fuel Your Time Capsules"
- Subtext: "One-time $20 SOL setup"
- Benefit: "Good for 2000+ time capsules"
- Value: "Less than $0.01 per future tweet"
- Comparison: "Cheaper than a coffee for years of scheduled tweets"
- Urgency: "Required to secure your content on blockchain"

### **Alternative Option**
- Button: "I already have SOL"
- Action: "Skip to manual wallet funding instructions"
- Target: "Existing crypto users who prefer self-funding"

## 🔧 **Environment Configuration**

### **Moonpay Environment Variables**
Necessary API keys and secrets for Moonpay will be configured as environment variables, with initial settings for a sandbox environment.

### **Integration with Existing Systems**
Wallet management will integrate with existing systems to identify the user's Solana address for the onramp process.

## 🎲 **Edge Cases & Error Handling**

### **Moonpay Failure Scenarios**
1. **User cancels payment** → Return to capsule form, no error
2. **Payment fails** → Show retry option + manual SOL instructions
3. **Webhook fails** → Backend retries, user sees "Payment processing..."
4. **Network errors** → Graceful degradation with manual SOL option

### **Balance Edge Cases**
1. **SOL price volatility** → Always check fresh balance before capsule creation
2. **Concurrent capsule creation** → Balance will be checked in the smart contract, not just the frontend
3. **Testnet vs mainnet** → Different SOL amounts and Moonpay behavior for different networks

## 📊 **Success Metrics**

### **Onramp Conversion Tracking**
We will track key metrics related to the onramp process, including:
- When the onramp modal is shown
- When a user starts the purchase process
- When a Moonpay payment is completed
- When a user successfully creates a capsule after funding
- When a user abandons the onramp process

### **Expected Conversion Rates**
- **Modal shown → Started**: 60-70% (due to good UX messaging)
- **Started → Completed**: 70-80% (Moonpay conversion rate)
- **Completed → Capsule created**: 90%+ (should be immediate)

## 🚀 **Implementation Priority**

### **Phase 1: Basic Integration**
1. Adapt existing Moonpay components.
2. Add SOL balance checking to capsule creation.
3. Implement a simple onramp modal with fixed $20 messaging.

### **Phase 2: UX Polish**
1. Optimize onramp messaging and design.
2. Add progress indicators for payment processing.
3. Implement retry logic and enhanced error handling.

### **Phase 3: Advanced Features**
1. Smart amount suggestions based on user behavior.
2. Explore alternative onramp providers if needed.
3. Implement SOL gifting functionality between users.

## ✅ **Ready for Implementation**

All decisions finalized:
- **Provider**: Moonpay (adapted from Cultivest)
- **Trigger**: Just-in-time when creating capsules
- **Amount**: $20 minimum with positive messaging
- **Integration**: Complete backend + mobile SDK available
- **Fallback**: Manual SOL option for existing crypto users

**Next step**: Set up Supabase database schema with SOL balance tracking!