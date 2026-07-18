CREATE TABLE instagram_dm_sessions
(
    id                TEXT PRIMARY KEY,
    social_account_id TEXT NOT NULL,
    user_id           TEXT NOT NULL,
    username          TEXT,
    display_name      TEXT,
    step              TEXT NOT NULL DEFAULT 'idle',
    session_data      TEXT,
    last_message_at   TEXT NOT NULL DEFAULT (datetime('now')),
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ig_dm_sessions_social_account ON instagram_dm_sessions (social_account_id);
CREATE INDEX idx_ig_dm_sessions_user_id ON instagram_dm_sessions (user_id);
CREATE UNIQUE INDEX idx_ig_dm_sessions_unique ON instagram_dm_sessions (social_account_id, user_id);
