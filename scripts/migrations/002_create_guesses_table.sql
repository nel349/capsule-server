-- Create guesses table for tracking game submissions
CREATE TABLE IF NOT EXISTS guesses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    capsule_id UUID NOT NULL REFERENCES capsules(capsule_id) ON DELETE CASCADE,
    guesser_wallet TEXT NOT NULL,
    guess_content TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    guess_pda TEXT NOT NULL UNIQUE, -- Key for matching with on-chain data
    game_pda TEXT, -- Additional validation
    transaction_signature TEXT, -- Filled when matched with on-chain data
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE, -- When matched with blockchain
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_guesses_capsule_id ON guesses(capsule_id);
CREATE INDEX IF NOT EXISTS idx_guesses_guesser_wallet ON guesses(guesser_wallet);
CREATE INDEX IF NOT EXISTS idx_guesses_guess_pda ON guesses(guess_pda);
CREATE INDEX IF NOT EXISTS idx_guesses_status ON guesses(status);
CREATE INDEX IF NOT EXISTS idx_guesses_submitted_at ON guesses(submitted_at DESC);

-- RLS (Row Level Security) policies
ALTER TABLE guesses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all non-anonymous guesses and their own anonymous guesses
CREATE POLICY "Users can read guesses" ON guesses FOR SELECT USING (
    NOT is_anonymous OR 
    guesser_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address'
);

-- Policy: Users can insert their own guesses (based on JWT wallet address)
CREATE POLICY "Users can insert their own guesses" ON guesses FOR INSERT WITH CHECK (
    guesser_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address'
);

-- Policy: System/backend can update any guess (for transaction signature matching)
CREATE POLICY "System can update guesses" ON guesses FOR UPDATE USING (true);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_guesses_updated_at BEFORE UPDATE ON guesses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE guesses IS 'Stores game guess submissions with PDA matching for blockchain synchronization';
COMMENT ON COLUMN guesses.guess_pda IS 'Deterministic PDA derived from game + guesser + guess_index for blockchain matching';
COMMENT ON COLUMN guesses.transaction_signature IS 'Populated when matched with confirmed on-chain transaction';
COMMENT ON COLUMN guesses.status IS 'pending: just submitted, confirmed: matched with blockchain, failed: transaction failed';