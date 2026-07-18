CREATE TABLE instagram_videos
(
    id                TEXT PRIMARY KEY,
    social_account_id TEXT NOT NULL,
    shortcode         TEXT NOT NULL,
    video_url         TEXT NOT NULL,
    proxied_url       TEXT NOT NULL,
    original_caption  TEXT,
    user_caption      TEXT,
    status            TEXT NOT NULL DEFAULT 'pending',
    scheduled_at      TEXT,
    published_at      TEXT,
    raw_data          TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ig_videos_social_account ON instagram_videos (social_account_id);
CREATE INDEX idx_ig_videos_status ON instagram_videos (status);
