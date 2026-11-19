CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id BIGINT,
  admin_display_name TEXT NOT NULL,
  admin_role TEXT NOT NULL,
  action TEXT NOT NULL CHECK (
    action IN ('create','update','delete','login','logout','password_change','bulk_action')
  ),
  resource_type TEXT CHECK (
    resource_type IS NULL OR resource_type IN (
      'journal','volume','issue','article','announcement',
      'author','keyword','account','trusted_domain','reader_account'
    )
  ),
  resource_id BIGINT,
  resource_label TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON admin_audit_logs(action);
