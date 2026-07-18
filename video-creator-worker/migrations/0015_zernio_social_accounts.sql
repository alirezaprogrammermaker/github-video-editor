CREATE TABLE zernio_social_accounts
(
    id            TEXT PRIMARY KEY,
    account_id    TEXT NOT NULL,
    platform      TEXT NOT NULL,
    username      TEXT,
    display_name  TEXT,
    profile_image TEXT,
    status        TEXT NOT NULL DEFAULT 'active',
    raw_data      TEXT,
    synced_at     TEXT NOT NULL DEFAULT (datetime('now')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_zernio_social_accounts_account_id ON zernio_social_accounts (account_id);
