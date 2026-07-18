CREATE TABLE zernio_page_admins
(
    id              TEXT PRIMARY KEY,
    social_account_id TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    username        TEXT,
    display_name    TEXT,
    role            TEXT NOT NULL DEFAULT 'admin',
    added_by        TEXT NOT NULL DEFAULT 'manual',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_zernio_page_admins_social_account ON zernio_page_admins (social_account_id);
CREATE INDEX idx_zernio_page_admins_user_id ON zernio_page_admins (user_id);
