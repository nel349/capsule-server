-- Add encryption metadata columns to capsules table
-- These fields are required for the unified encryption service to decrypt capsules

ALTER TABLE capsules 
ADD COLUMN encryption_version TEXT,
ADD COLUMN encryption_platform TEXT CHECK (encryption_platform IN ('ios', 'android')),
ADD COLUMN encryption_key_id TEXT,
ADD COLUMN encryption_seed_name TEXT,
ADD COLUMN encryption_derivation_path TEXT;

-- Add comments to document the fields
COMMENT ON COLUMN capsules.encryption_version IS 'Version of encryption system used (e.g., "2.0" for unified encryption)';
COMMENT ON COLUMN capsules.encryption_platform IS 'Platform where encryption was performed (ios/android)';
COMMENT ON COLUMN capsules.encryption_key_id IS 'iOS Keychain vault key identifier';
COMMENT ON COLUMN capsules.encryption_seed_name IS 'Android Seed Vault seed name';
COMMENT ON COLUMN capsules.encryption_derivation_path IS 'Android Seed Vault derivation path';

-- Create index for efficient lookups by encryption metadata
CREATE INDEX idx_capsules_encryption_platform ON capsules(encryption_platform);
CREATE INDEX idx_capsules_encryption_version ON capsules(encryption_version);

SELECT 'Encryption metadata columns added to capsules table successfully!' as message;