-- Migration 007: Remove revealed_at column
-- This column is not being used, and reveal status should be determined by 
-- whether reveal_date is set (not null) after the reveal process

BEGIN;

-- Drop dependent policy first
DROP POLICY IF EXISTS "Users can view revealed capsules" ON capsules;

-- Check current usage before removing
SELECT 
  COUNT(*) as total_capsules,
  COUNT(revealed_at) as capsules_with_revealed_at,
  COUNT(reveal_date) as capsules_with_reveal_date
FROM capsules;

-- Drop the revealed_at column
ALTER TABLE capsules 
DROP COLUMN IF EXISTS revealed_at;

-- Re-create the policy to use reveal_date
CREATE POLICY "Users can view revealed capsules" ON capsules
  FOR SELECT USING (status IN ('revealed', 'posted') AND reveal_date IS NOT NULL AND reveal_date <= NOW());

-- Verify the column is removed
-- \d capsules;

-- Add comment explaining the new reveal logic
COMMENT ON COLUMN capsules.reveal_date IS 'The date when this capsule should be/was revealed. NULL until reveal is scheduled/processed, then set to the actual reveal timestamp.';

COMMIT;