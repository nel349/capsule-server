-- CapsuleX Database Schema
-- Based on documented requirements: dual auth, social connections, SOL onramp

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (dual authentication: Privy + Wallet)
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE NOT NULL,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('privy', 'wallet')),
  privy_user_id TEXT UNIQUE,
  email TEXT,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social connections table (X required, others optional)
CREATE TABLE social_connections (
  connection_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'farcaster', 'instagram', 'tiktok')),
  platform_user_id TEXT NOT NULL,
  platform_username TEXT,
  access_token TEXT, -- Will be encrypted at application level
  refresh_token TEXT, -- Will be encrypted at application level
  is_active BOOLEAN DEFAULT TRUE,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- Capsules table (time capsules with content)
CREATE TABLE capsules (
  capsule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- Content fields
  content_encrypted TEXT NOT NULL,
  content_hash TEXT NOT NULL, -- SHA256 for integrity
  has_media BOOLEAN DEFAULT FALSE,
  media_urls TEXT[], -- Array of media URLs (IPFS CIDs)
  
  -- Timing fields
  reveal_date TIMESTAMP WITH TIME ZONE NOT NULL,
  revealed_at TIMESTAMP WITH TIME ZONE NULL,
  
  -- Social posting fields
  posted_to_social BOOLEAN DEFAULT FALSE,
  social_post_id TEXT NULL, -- Twitter post ID, etc.
  social_platform TEXT DEFAULT 'twitter',
  
  -- Blockchain fields
  on_chain_tx TEXT NOT NULL, -- Solana transaction signature
  sol_fee_amount NUMERIC(20, 9) DEFAULT 0.00005, -- SOL amount charged
  
  -- Management fields
  can_edit BOOLEAN DEFAULT TRUE, -- Allow edit before reveal
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'revealed', 'posted', 'failed', 'cancelled'))
);

-- Reveal processing queue (for automated reveals)
CREATE TABLE reveal_queue (
  queue_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  capsule_id UUID NOT NULL REFERENCES capsules(capsule_id) ON DELETE CASCADE,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt TIMESTAMP WITH TIME ZONE NULL,
  next_attempt TIMESTAMP WITH TIME ZONE NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SOL transactions table (for onramp tracking)
CREATE TABLE sol_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('onramp', 'capsule_fee', 'refund')),
  
  -- Transaction details
  sol_amount NUMERIC(20, 9) NOT NULL,
  usd_amount NUMERIC(10, 2) NULL, -- For onramp transactions
  solana_tx_signature TEXT NULL, -- Actual Solana transaction
  
  -- Moonpay integration
  moonpay_transaction_id TEXT NULL,
  moonpay_status TEXT NULL,
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE NULL
);

-- Indexes for performance
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_privy_id ON users(privy_user_id);
CREATE INDEX idx_social_connections_user_platform ON social_connections(user_id, platform);
CREATE INDEX idx_capsules_user_id ON capsules(user_id);
CREATE INDEX idx_capsules_reveal_date ON capsules(reveal_date);
CREATE INDEX idx_capsules_status ON capsules(status);
CREATE INDEX idx_reveal_queue_scheduled ON reveal_queue(scheduled_for);
CREATE INDEX idx_reveal_queue_status ON reveal_queue(status);
CREATE INDEX idx_sol_transactions_user ON sol_transactions(user_id);
CREATE INDEX idx_sol_transactions_moonpay ON sol_transactions(moonpay_transaction_id);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE capsules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sol_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = user_id::text OR auth.role() = 'service_role');

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Social connections policies
CREATE POLICY "Users can manage own social connections" ON social_connections
  FOR ALL USING (user_id IN (SELECT user_id FROM users WHERE auth.uid()::text = user_id::text));

-- Capsules policies (users can see their own + public revealed capsules)
CREATE POLICY "Users can view own capsules" ON capsules
  FOR SELECT USING (user_id IN (SELECT user_id FROM users WHERE auth.uid()::text = user_id::text));

CREATE POLICY "Users can view revealed capsules" ON capsules
  FOR SELECT USING (status IN ('revealed', 'posted') AND revealed_at IS NOT NULL);

CREATE POLICY "Users can create own capsules" ON capsules
  FOR INSERT WITH CHECK (user_id IN (SELECT user_id FROM users WHERE auth.uid()::text = user_id::text));

CREATE POLICY "Users can update own pending capsules" ON capsules
  FOR UPDATE USING (user_id IN (SELECT user_id FROM users WHERE auth.uid()::text = user_id::text) AND can_edit = true);

-- SOL transactions policies
CREATE POLICY "Users can view own transactions" ON sol_transactions
  FOR SELECT USING (user_id IN (SELECT user_id FROM users WHERE auth.uid()::text = user_id::text));

-- Functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing (optional)
-- This will be populated via API calls in real usage

COMMENT ON TABLE users IS 'User accounts supporting both Privy and direct wallet authentication';
COMMENT ON TABLE social_connections IS 'Social media account connections (X required, others optional)';
COMMENT ON TABLE capsules IS 'Time capsules with encrypted content and reveal scheduling';
COMMENT ON TABLE reveal_queue IS 'Queue for processing automatic reveals and X posting';
COMMENT ON TABLE sol_transactions IS 'SOL transaction tracking including Moonpay onramp purchases';

-- Sample environment check
SELECT 'CapsuleX database schema created successfully!' as message;