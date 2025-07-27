-- Allow capsule_id to be NULL for social posts
-- This is needed because social posts don't have associated capsules
ALTER TABLE reveal_queue 
ALTER COLUMN capsule_id DROP NOT NULL;
