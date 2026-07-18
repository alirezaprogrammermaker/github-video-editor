-- Add caption_template field to social accounts
ALTER TABLE zernio_social_accounts ADD COLUMN caption_template TEXT DEFAULT '{caption}';
