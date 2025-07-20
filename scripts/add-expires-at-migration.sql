-- Migration: Add expires_at column to social_connections table
-- This adds OAuth token expiration tracking for social media connections

ALTER TABLE social_connections 
ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE NULL;

-- Add index for expires_at for efficient expiration queries
CREATE INDEX idx_social_connections_expires_at ON social_connections(expires_at);

-- Add comment
COMMENT ON COLUMN social_connections.expires_at IS 'OAuth access token expiration timestamp';

SELECT 'Added expires_at column to social_connections table' as migration_result;