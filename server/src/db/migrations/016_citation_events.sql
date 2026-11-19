CREATE TABLE IF NOT EXISTS article_citation_events (
  id BIGSERIAL PRIMARY KEY,
  article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  visitor_key TEXT NOT NULL,
  cited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_article_citation_events_article ON article_citation_events(article_id, cited_at);
CREATE INDEX IF NOT EXISTS idx_article_citation_events_visitor ON article_citation_events(article_id, visitor_key, cited_at);
