ALTER TABLE zernio_accounts ADD COLUMN user_id TEXT NOT NULL DEFAULT '';

CREATE INDEX idx_zernio_accounts_user_id ON zernio_accounts (user_id);
