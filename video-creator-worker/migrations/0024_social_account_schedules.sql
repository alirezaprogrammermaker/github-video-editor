CREATE TABLE social_account_schedules
(
    id                TEXT PRIMARY KEY,
    social_account_id TEXT NOT NULL,
    time_slots        TEXT NOT NULL DEFAULT '[]',
    active_days       TEXT NOT NULL DEFAULT '["1","2","3","4","5","6","0"]',
    is_active         INTEGER NOT NULL DEFAULT 1,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_schedules_social_account ON social_account_schedules (social_account_id);

ALTER TABLE instagram_videos ADD COLUMN published_post_id TEXT;
