-- Migration 006: Make reveal_date nullable and fix existing data
-- This fixes the issue where reveal_date was being set to NOW() on capsule creation
-- instead of being NULL until the capsule is actually revealed

BEGIN;

-- First, let's see what we're dealing with
-- (This is just for visibility during migration)
SELECT 
  COUNT(*) as total_capsules,
  COUNT(revealed_at) as actually_revealed_capsules,
  COUNT(CASE WHEN revealed_at IS NULL AND reveal_date <= NOW() THEN 1 END) as incorrectly_marked_revealed
FROM capsules;

-- Step 1: Make reveal_date column nullable
ALTER TABLE capsules 
ALTER COLUMN reveal_date DROP NOT NULL;

-- Step 2: Set reveal_date to NULL for capsules that haven't actually been revealed
-- (These are capsules where revealed_at is NULL, meaning they were never actually revealed)
UPDATE capsules 
SET reveal_date = NULL 
WHERE revealed_at IS NULL;

-- Step 3: Add a comment to document the expected behavior
COMMENT ON COLUMN capsules.reveal_date IS 'The date when this capsule was revealed. Should be NULL until capsule is actually revealed, then set to the reveal timestamp.';

-- Verify the changes
SELECT 
  COUNT(*) as total_capsules,
  COUNT(reveal_date) as capsules_with_reveal_date,
  COUNT(revealed_at) as actually_revealed_capsules,
  COUNT(CASE WHEN reveal_date IS NOT NULL AND revealed_at IS NULL THEN 1 END) as potential_data_issues
FROM capsules;

COMMIT;