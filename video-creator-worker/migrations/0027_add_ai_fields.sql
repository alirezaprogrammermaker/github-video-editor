-- Add AI analysis fields to instagram_videos
ALTER TABLE instagram_videos ADD COLUMN ai_analysis TEXT;
ALTER TABLE instagram_videos ADD COLUMN ai_title TEXT;
ALTER TABLE instagram_videos ADD COLUMN ai_caption TEXT;
ALTER TABLE instagram_videos ADD COLUMN ai_hashtags TEXT;
