CREATE TABLE IF NOT EXISTS journals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journal_volumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_id INTEGER NOT NULL,
  volume_number TEXT NOT NULL,
  publication_year INTEGER NOT NULL CHECK (
    publication_year BETWEEN 1800 AND 2999
  ),
  volume_title TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE RESTRICT,
  UNIQUE (journal_id, volume_number)
);

CREATE TABLE IF NOT EXISTS journal_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_id INTEGER NOT NULL,
  volume_id INTEGER NOT NULL,
  issue_number TEXT NOT NULL,
  issue_title TEXT,
  publication_month INTEGER CHECK (
    publication_month IS NULL OR publication_month BETWEEN 1 AND 12
  ),
  date_published TEXT,
  issue_cover_image TEXT,
  issue_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE RESTRICT,
  FOREIGN KEY (volume_id) REFERENCES journal_volumes(id) ON DELETE RESTRICT,
  UNIQUE (volume_id, issue_number)
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_id INTEGER NOT NULL,
  issue_id INTEGER,
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
  average_rating REAL NOT NULL DEFAULT 0.00 CHECK (
    average_rating BETWEEN 0 AND 5
  ),
  access_status TEXT NOT NULL DEFAULT 'Open Access' CHECK (
    access_status IN ('Open Access', 'Restricted', 'Unavailable')
  ),
  date_published TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE RESTRICT,
  FOREIGN KEY (issue_id) REFERENCES journal_issues(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS authors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  suffix TEXT,
  affiliation TEXT,
  orcid TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS article_authors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  author_order INTEGER NOT NULL DEFAULT 1,
  is_corresponding INTEGER NOT NULL DEFAULT 0 CHECK (is_corresponding IN (0, 1)),
  UNIQUE (article_id, author_id),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS article_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  keyword_id INTEGER NOT NULL,
  UNIQUE (article_id, keyword_id),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL CHECK (
    label IN (
      'Repository update',
      'Access notice',
      'Metadata quality',
      'Service notice',
      'Event',
      'Maintenance'
    )
  ),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  href TEXT,
  link_label TEXT,
  publish_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (
    status IN ('Draft', 'Published', 'Archived')
  ),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (title, publish_date)
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email TEXT COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Super Admin' CHECK (
    role IN ('Super Admin', 'Content Admin', 'Member')
  ),
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (
    account_status IN ('active', 'disabled')
  ),
  must_change_password INTEGER NOT NULL DEFAULT 1 CHECK (
    must_change_password IN (0, 1)
  ),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER NOT NULL,
  session_token_hash TEXT NOT NULL UNIQUE,
  csrf_token_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  ip_address TEXT,
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  was_successful INTEGER NOT NULL DEFAULT 0 CHECK (was_successful IN (0, 1))
);

CREATE TABLE IF NOT EXISTS article_view_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  visitor_key TEXT NOT NULL,
  viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS article_download_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  account_id INTEGER,
  visitor_key TEXT,
  downloaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS search_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_term TEXT NOT NULL,
  record_type TEXT NOT NULL,
  search_field TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0 CHECK (result_count >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_issues_volume_matches_journal_insert
BEFORE INSERT ON journal_issues
WHEN NOT EXISTS (
  SELECT 1
  FROM journal_volumes
  WHERE journal_volumes.id = NEW.volume_id
    AND journal_volumes.journal_id = NEW.journal_id
)
BEGIN
  SELECT RAISE(ABORT, 'ISSUE_VOLUME_JOURNAL_MISMATCH');
END;

CREATE TRIGGER IF NOT EXISTS trg_issues_volume_matches_journal_update
BEFORE UPDATE OF journal_id, volume_id ON journal_issues
WHEN NOT EXISTS (
  SELECT 1
  FROM journal_volumes
  WHERE journal_volumes.id = NEW.volume_id
    AND journal_volumes.journal_id = NEW.journal_id
)
BEGIN
  SELECT RAISE(ABORT, 'ISSUE_VOLUME_JOURNAL_MISMATCH');
END;

CREATE TRIGGER IF NOT EXISTS trg_volumes_prevent_journal_move_with_issues
BEFORE UPDATE OF journal_id ON journal_volumes
WHEN OLD.journal_id != NEW.journal_id
  AND EXISTS (
    SELECT 1
    FROM journal_issues
    WHERE journal_issues.volume_id = OLD.id
  )
BEGIN
  SELECT RAISE(ABORT, 'VOLUME_HAS_LINKED_ISSUES');
END;

CREATE TRIGGER IF NOT EXISTS trg_issues_prevent_journal_move_with_articles
BEFORE UPDATE OF journal_id ON journal_issues
WHEN OLD.journal_id != NEW.journal_id
  AND EXISTS (
    SELECT 1
    FROM articles
    WHERE articles.issue_id = OLD.id
  )
BEGIN
  SELECT RAISE(ABORT, 'ISSUE_HAS_LINKED_ARTICLES');
END;

CREATE TRIGGER IF NOT EXISTS trg_articles_issue_matches_journal_insert
BEFORE INSERT ON articles
WHEN NEW.issue_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM journal_issues
    WHERE journal_issues.id = NEW.issue_id
      AND journal_issues.journal_id = NEW.journal_id
  )
BEGIN
  SELECT RAISE(ABORT, 'ARTICLE_ISSUE_JOURNAL_MISMATCH');
END;

CREATE TRIGGER IF NOT EXISTS trg_articles_issue_matches_journal_update
BEFORE UPDATE OF journal_id, issue_id ON articles
WHEN NEW.issue_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM journal_issues
    WHERE journal_issues.id = NEW.issue_id
      AND journal_issues.journal_id = NEW.journal_id
  )
BEGIN
  SELECT RAISE(ABORT, 'ARTICLE_ISSUE_JOURNAL_MISMATCH');
END;

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
