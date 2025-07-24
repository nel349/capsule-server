-- Migration: Add gamification support to capsules table
-- Created: 2025-07-23
-- Description: Adds is_gamified column to support game functionality

-- Add is_gamified column to capsules table
ALTER TABLE capsules ADD COLUMN IF NOT EXISTS is_gamified BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN capsules.is_gamified IS 'Whether this capsule has a guessing game enabled';

-- Verify the migration was successful
SELECT 
  column_name, 
  data_type, 
  column_default, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'capsules' 
  AND column_name = 'is_gamified';

-- Migration complete confirmation
SELECT 'Migration 001_add_gamification_column.sql completed successfully!' as message;