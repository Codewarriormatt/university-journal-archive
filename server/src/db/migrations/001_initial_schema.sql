CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS journals (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  abbreviation TEXT,
  print_issn TEXT UNIQUE,
  online_issn TEXT UNIQUE,
  publisher_name TEXT NOT NULL,
  place_of_publication TEXT,
  journal_url TEXT,
  subject_area TEXT,
  description TEXT,
  default_cover_image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_volumes (
  id BIGSERIAL PRIMARY KEY,
  journal_id BIGINT NOT NULL,
  volume_number TEXT NOT NULL,
  publication_year INTEGER NOT NULL CHECK (publication_year BETWEEN 1800 AND 2999),
  volume_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE RESTRICT,
  UNIQUE (journal_id, volume_number)
);

CREATE TABLE IF NOT EXISTS journal_issues (
  id BIGSERIAL PRIMARY KEY,
  journal_id BIGINT NOT NULL,
  volume_id BIGINT NOT NULL,
  issue_number TEXT NOT NULL,
  issue_title TEXT,
  publication_month INTEGER CHECK (publication_month IS NULL OR publication_month BETWEEN 1 AND 12),
  date_published TEXT,
  issue_cover_image TEXT,
  issue_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE RESTRICT,
  FOREIGN KEY (volume_id) REFERENCES journal_volumes(id) ON DELETE RESTRICT,
  UNIQUE (volume_id, issue_number)
);

CREATE TABLE IF NOT EXISTS articles (
  id BIGSERIAL PRIMARY KEY,
  journal_id BIGINT NOT NULL,
  issue_id BIGINT,
  title TEXT NOT NULL,
  doi TEXT UNIQUE,
  abstract TEXT,
  page_start TEXT,
  page_end TEXT,
  article_url TEXT,
  pdf_file_path TEXT,
  apa_citation_cache TEXT,
  citation_count INTEGER NOT NULL DEFAULT 0 CHECK (citation_count >= 0),
  download_count INTEGER NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  average_rating NUMERIC(3,2) NOT NULL DEFAULT 0.00 CHECK (average_rating BETWEEN 0 AND 5),
  access_status TEXT NOT NULL DEFAULT 'Open Access' CHECK (access_status IN ('Open Access', 'Restricted', 'Unavailable')),
  date_published TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE RESTRICT,
  FOREIGN KEY (issue_id) REFERENCES journal_issues(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS authors (
  id BIGSERIAL PRIMARY KEY,
  display_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  suffix TEXT,
  affiliation TEXT,
  orcid TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_authors (
  id BIGSERIAL PRIMARY KEY,
  article_id BIGINT NOT NULL,
  author_id BIGINT NOT NULL,
  author_order INTEGER NOT NULL DEFAULT 1,
  is_corresponding BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (article_id, author_id),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS keywords (
  id BIGSERIAL PRIMARY KEY,
  name CITEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_keywords (
  id BIGSERIAL PRIMARY KEY,
  article_id BIGINT NOT NULL,
  keyword_id BIGINT NOT NULL,
  UNIQUE (article_id, keyword_id),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS announcements (
  id BIGSERIAL PRIMARY KEY,
  label TEXT NOT NULL CHECK (label IN ('Repository update','Access notice','Metadata quality','Service notice','Event','Maintenance')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  href TEXT,
  link_label TEXT,
  publish_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Published', 'Archived')),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (title, publish_date)
);

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGSERIAL PRIMARY KEY,
  username CITEXT NOT NULL UNIQUE,
  email CITEXT UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Super Admin' CHECK (role IN ('Super Admin', 'Content Admin', 'Member')),
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'disabled')),
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id BIGINT NOT NULL,
  session_token_hash TEXT NOT NULL UNIQUE,
  csrf_token_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  ip_address TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  was_successful BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS article_view_events (
  id BIGSERIAL PRIMARY KEY,
  article_id BIGINT NOT NULL,
  visitor_key TEXT NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS article_download_events (
  id BIGSERIAL PRIMARY KEY,
  article_id BIGINT NOT NULL,
  account_id BIGINT,
  visitor_key TEXT,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS search_logs (
  id BIGSERIAL PRIMARY KEY,
  search_term TEXT NOT NULL,
  record_type TEXT NOT NULL,
  search_field TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0 CHECK (result_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Triggers (PL/pgSQL)

CREATE OR REPLACE FUNCTION fn_check_issue_volume_journal() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM journal_volumes
    WHERE id = NEW.volume_id AND journal_id = NEW.journal_id
  ) THEN
    RAISE EXCEPTION 'ISSUE_VOLUME_JOURNAL_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_issues_volume_matches_journal
BEFORE INSERT OR UPDATE OF journal_id, volume_id ON journal_issues
FOR EACH ROW EXECUTE FUNCTION fn_check_issue_volume_journal();

CREATE OR REPLACE FUNCTION fn_check_volume_journal_move() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.journal_id IS DISTINCT FROM NEW.journal_id AND EXISTS (
    SELECT 1 FROM journal_issues WHERE volume_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'VOLUME_HAS_LINKED_ISSUES';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_volumes_prevent_journal_move_with_issues
BEFORE UPDATE OF journal_id ON journal_volumes
FOR EACH ROW EXECUTE FUNCTION fn_check_volume_journal_move();

CREATE OR REPLACE FUNCTION fn_check_issue_journal_move() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.journal_id IS DISTINCT FROM NEW.journal_id AND EXISTS (
    SELECT 1 FROM articles WHERE issue_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'ISSUE_HAS_LINKED_ARTICLES';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_issues_prevent_journal_move_with_articles
BEFORE UPDATE OF journal_id ON journal_issues
FOR EACH ROW EXECUTE FUNCTION fn_check_issue_journal_move();

CREATE OR REPLACE FUNCTION fn_check_article_issue_journal() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.issue_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM journal_issues
    WHERE id = NEW.issue_id AND journal_id = NEW.journal_id
  ) THEN
    RAISE EXCEPTION 'ARTICLE_ISSUE_JOURNAL_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_articles_issue_matches_journal
BEFORE INSERT OR UPDATE OF journal_id, issue_id ON articles
FOR EACH ROW EXECUTE FUNCTION fn_check_article_issue_journal();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_articles_title ON articles(title);
CREATE INDEX IF NOT EXISTS idx_articles_journal ON articles(journal_id);
CREATE INDEX IF NOT EXISTS idx_articles_issue ON articles(issue_id);
CREATE INDEX IF NOT EXISTS idx_article_authors_author ON article_authors(author_id);
CREATE INDEX IF NOT EXISTS idx_article_keywords_keyword ON article_keywords(keyword_id);
CREATE INDEX IF NOT EXISTS idx_authors_display_name ON authors(display_name);
CREATE INDEX IF NOT EXISTS idx_authors_orcid ON authors(orcid);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_username ON admin_login_attempts(username, attempted_at);
CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_ip ON admin_login_attempts(ip_address, attempted_at);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_status ON admin_users(account_status);
CREATE INDEX IF NOT EXISTS idx_article_view_events_article ON article_view_events(article_id, viewed_at);
CREATE INDEX IF NOT EXISTS idx_article_view_events_visitor ON article_view_events(article_id, visitor_key, viewed_at);
CREATE INDEX IF NOT EXISTS idx_article_download_events_article ON article_download_events(article_id, downloaded_at);
CREATE INDEX IF NOT EXISTS idx_search_logs_term ON search_logs(search_term, created_at);
CREATE INDEX IF NOT EXISTS idx_volumes_journal ON journal_volumes(journal_id);
CREATE INDEX IF NOT EXISTS idx_volumes_year ON journal_volumes(publication_year);
CREATE INDEX IF NOT EXISTS idx_issues_journal ON journal_issues(journal_id);
CREATE INDEX IF NOT EXISTS idx_issues_volume ON journal_issues(volume_id);
CREATE INDEX IF NOT EXISTS idx_journals_title ON journals(title);
CREATE INDEX IF NOT EXISTS idx_journals_subject_area ON journals(subject_area);
CREATE INDEX IF NOT EXISTS idx_keywords_name ON keywords(name);
CREATE INDEX IF NOT EXISTS idx_announcements_status_date ON announcements(status, publish_date);
CREATE INDEX IF NOT EXISTS idx_announcements_title ON announcements(title);
