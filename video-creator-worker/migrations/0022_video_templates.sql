CREATE TABLE video_templates
(
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    fields      TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE instagram_videos ADD COLUMN template_id TEXT;
ALTER TABLE instagram_videos ADD COLUMN output_url TEXT;
ALTER TABLE instagram_videos ADD COLUMN build_log TEXT;
