-- Add post_type column to reveal_queue table
ALTER TABLE reveal_queue 
ADD COLUMN post_type VARCHAR(20) DEFAULT 'capsule_reveal' CHECK (post_type IN ('capsule_reveal', 'social_post'));

-- Add content column for social posts (content to be posted directly)
ALTER TABLE reveal_queue 
ADD COLUMN post_content TEXT;

-- Add user_id column for social posts (since they don't have capsules)
ALTER TABLE reveal_queue 
ADD COLUMN user_id UUID REFERENCES users(user_id);
