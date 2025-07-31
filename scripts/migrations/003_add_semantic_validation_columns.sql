-- Add semantic validation columns to guesses table
-- This supports the automated semantic oracle integration

ALTER TABLE guesses 
ADD COLUMN IF NOT EXISTS semantic_result BOOLEAN,
ADD COLUMN IF NOT EXISTS semantic_similarity FLOAT,
ADD COLUMN IF NOT EXISTS semantic_method TEXT,
ADD COLUMN IF NOT EXISTS oracle_signature TEXT,
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE;

-- Create index for semantic validation queries
CREATE INDEX IF NOT EXISTS idx_guesses_semantic_result ON guesses(semantic_result);
CREATE INDEX IF NOT EXISTS idx_guesses_validated_at ON guesses(validated_at);

-- Add check constraint for semantic similarity (should be between 0 and 1)
ALTER TABLE guesses 
ADD CONSTRAINT chk_semantic_similarity 
CHECK (semantic_similarity IS NULL OR (semantic_similarity >= 0 AND semantic_similarity <= 1));

-- Comments for documentation
COMMENT ON COLUMN guesses.semantic_result IS 'Boolean result from semantic oracle validation (NULL = not yet validated)';
COMMENT ON COLUMN guesses.semantic_similarity IS 'Similarity score from semantic service (0.0 to 1.0)';
COMMENT ON COLUMN guesses.semantic_method IS 'Method used by semantic service (exact, local, llm_basic, llm_premium)';
COMMENT ON COLUMN guesses.oracle_signature IS 'Cryptographic signature from semantic oracle for verification';
COMMENT ON COLUMN guesses.validated_at IS 'Timestamp when semantic validation was completed';