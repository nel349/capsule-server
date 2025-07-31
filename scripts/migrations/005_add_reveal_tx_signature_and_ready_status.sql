-- Migration 005: Add reveal_tx_signature column and ready_to_reveal status
-- This fixes the capsule status synchronization issue between blockchain and database

-- Add reveal_tx_signature column to store the blockchain transaction signature when a capsule is revealed
ALTER TABLE capsules 
ADD COLUMN reveal_tx_signature TEXT NULL;

-- Update the status check constraint to include 'ready_to_reveal'
-- First, drop the existing constraint
ALTER TABLE capsules DROP CONSTRAINT IF EXISTS capsules_status_check;

-- Add the new constraint with 'ready_to_reveal' included
ALTER TABLE capsules 
ADD CONSTRAINT capsules_status_check 
CHECK (status IN ('pending', 'ready_to_reveal', 'revealed', 'posted', 'failed', 'cancelled'));

-- Add index for the new column for performance
CREATE INDEX idx_capsules_reveal_tx_signature ON capsules(reveal_tx_signature);

-- Add comments for documentation
COMMENT ON COLUMN capsules.reveal_tx_signature IS 'Solana transaction signature from the actual reveal transaction on-chain';

-- Update any existing capsules with status 'revealed' but null revealed_at to 'ready_to_reveal'
-- This fixes inconsistent data where time-based logic set status to 'revealed' without actual reveal transaction
UPDATE capsules 
SET status = 'ready_to_reveal' 
WHERE status = 'revealed' 
  AND revealed_at IS NULL 
  AND reveal_tx_signature IS NULL;

SELECT 'Migration 005 completed: Added reveal_tx_signature column and ready_to_reveal status' as message;
