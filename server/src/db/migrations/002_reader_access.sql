-- Trusted email domains — managed by Super Admin
CREATE TABLE IF NOT EXISTS trusted_domains (
  id BIGSERIAL PRIMARY KEY,
  domain CITEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per registered reader (auto-created on first magic-link request)
CREATE TABLE IF NOT EXISTS reader_accounts (
  id BIGSERIAL PRIMARY KEY,
  email CITEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ
);

-- Active reader sessions (30-day, persistent)
CREATE TABLE IF NOT EXISTS reader_sessions (
  id BIGSERIAL PRIMARY KEY,
  reader_account_id BIGINT NOT NULL,
  session_token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (reader_account_id) REFERENCES reader_accounts(id) ON DELETE CASCADE
);

-- Short-lived magic-link tokens (15-minute expiry, single-use)
CREATE TABLE IF NOT EXISTS reader_login_tokens (
  id BIGSERIAL PRIMARY KEY,
  reader_account_id BIGINT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  FOREIGN KEY (reader_account_id) REFERENCES reader_accounts(id) ON DELETE CASCADE
);

-- Track which reader account made each download
ALTER TABLE article_download_events ADD COLUMN IF NOT EXISTS reader_account_id BIGINT REFERENCES reader_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trusted_domains_domain ON trusted_domains(domain);
CREATE INDEX IF NOT EXISTS idx_reader_accounts_email ON reader_accounts(email);
CREATE INDEX IF NOT EXISTS idx_reader_accounts_domain ON reader_accounts(domain);
CREATE INDEX IF NOT EXISTS idx_reader_accounts_status ON reader_accounts(status);
CREATE INDEX IF NOT EXISTS idx_reader_sessions_token ON reader_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_reader_sessions_account ON reader_sessions(reader_account_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_reader_login_tokens_hash ON reader_login_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_reader_login_tokens_account ON reader_login_tokens(reader_account_id);
