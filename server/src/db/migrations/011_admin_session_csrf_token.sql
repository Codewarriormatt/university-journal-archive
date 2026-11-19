ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS csrf_token TEXT;
