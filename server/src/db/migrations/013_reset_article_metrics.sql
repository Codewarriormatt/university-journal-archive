UPDATE articles SET view_count = 0, download_count = 0, citation_count = 0;
TRUNCATE article_view_events;
TRUNCATE article_download_events;
