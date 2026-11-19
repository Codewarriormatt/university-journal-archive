UPDATE articles SET pdf_file_path = NULL WHERE pdf_file_path LIKE '%example.edu%' OR pdf_file_path LIKE '%example.com%';
UPDATE articles SET article_url = NULL WHERE article_url LIKE '%example.edu%' OR article_url LIKE '%example.com%';
UPDATE journals SET journal_url = NULL WHERE journal_url LIKE '%example.edu%' OR journal_url LIKE '%example.com%';
