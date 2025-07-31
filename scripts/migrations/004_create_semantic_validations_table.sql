-- Create semantic_validations table for audit trail
-- This table stores the complete semantic validation results for transparency and debugging
-- while the guesses table stores the final validation state

CREATE TABLE IF NOT EXISTS semantic_validations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guess_pda TEXT NOT NULL REFERENCES guesses(guess_pda) ON DELETE CASCADE,
    capsule_id UUID NOT NULL REFERENCES capsules(capsule_id) ON DELETE CASCADE,
    creator_wallet TEXT NOT NULL,
    
    -- Validation inputs
    guess_content TEXT NOT NULL,
    answer_content TEXT NOT NULL,
    
    -- Semantic validation results
    is_correct BOOLEAN NOT NULL,
    similarity FLOAT NOT NULL,
    method TEXT NOT NULL, -- exact, local, llm_basic, llm_premium, etc.
    confidence FLOAT,
    
    -- Oracle data for on-chain verification
    oracle_timestamp BIGINT,
    oracle_nonce TEXT,
    oracle_signature TEXT,
    oracle_enabled BOOLEAN DEFAULT FALSE,
    
    -- Audit fields
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_semantic_validations_guess_pda ON semantic_validations(guess_pda);
CREATE INDEX IF NOT EXISTS idx_semantic_validations_capsule_id ON semantic_validations(capsule_id);
CREATE INDEX IF NOT EXISTS idx_semantic_validations_creator ON semantic_validations(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_semantic_validations_processed_at ON semantic_validations(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_semantic_validations_is_correct ON semantic_validations(is_correct);

-- Add check constraint for similarity (should be between 0 and 1)
ALTER TABLE semantic_validations 
ADD CONSTRAINT chk_semantic_validations_similarity 
CHECK (similarity >= 0 AND similarity <= 1);

-- Add check constraint for confidence (should be between 0 and 1 if not null)
ALTER TABLE semantic_validations 
ADD CONSTRAINT chk_semantic_validations_confidence 
CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1));

-- RLS (Row Level Security) policies
ALTER TABLE semantic_validations ENABLE ROW LEVEL SECURITY;

-- Policy: Creators can read validations for their own capsules
CREATE POLICY "Creators can read own validations" ON semantic_validations FOR SELECT USING (
    creator_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address'
);

-- Policy: System/backend can insert validation results
CREATE POLICY "System can insert validations" ON semantic_validations FOR INSERT WITH CHECK (true);

-- Policy: System/backend can read all validations (for admin/debugging)
CREATE POLICY "System can read all validations" ON semantic_validations FOR SELECT USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
);

-- Comments for documentation
COMMENT ON TABLE semantic_validations IS 'Audit trail of semantic validation results for transparency and debugging';
COMMENT ON COLUMN semantic_validations.guess_pda IS 'References the specific guess that was validated';
COMMENT ON COLUMN semantic_validations.method IS 'Semantic validation method used (exact, local, llm_basic, llm_premium, etc.)';
COMMENT ON COLUMN semantic_validations.oracle_timestamp IS 'Timestamp from semantic oracle for on-chain verification';
COMMENT ON COLUMN semantic_validations.oracle_signature IS 'Cryptographic signature from semantic oracle';
COMMENT ON COLUMN semantic_validations.oracle_enabled IS 'Whether oracle signature validation is enabled';
