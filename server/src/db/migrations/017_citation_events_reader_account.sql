ALTER TABLE article_citation_events
  ADD COLUMN IF NOT EXISTS reader_account_id BIGINT REFERENCES reader_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_article_citation_events_reader ON article_citation_events(article_id, reader_account_id, cited_at);
