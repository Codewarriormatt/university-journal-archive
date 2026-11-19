import { getPool } from "../db/database.js";

export async function isDomainTrusted(domain) {
  const result = await getPool().query(
    "SELECT id FROM trusted_domains WHERE domain = $1 LIMIT 1",
    [domain]
  );
  return result.rows.length > 0;
}

export async function findOrCreateReaderAccount(email) {
  const pool = getPool();
  const domain = email.split("@")[1]?.toLowerCase() ?? "";

  const existing = await pool.query(
    `SELECT id, status, expires_at AS "expiresAt" FROM reader_accounts WHERE email = $1 LIMIT 1`,
    [email]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const result = await pool.query(
    "INSERT INTO reader_accounts (email, domain) VALUES ($1, $2) RETURNING id",
    [email, domain]
  );
  return { id: result.rows[0].id, status: "active", expiresAt: null };
}

export async function getReaderAccountById(id) {
  const result = await getPool().query(
    `SELECT id, email, domain, status, expires_at AS "expiresAt",
            created_at AS "createdAt", last_seen_at AS "lastSeenAt"
     FROM reader_accounts WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

// --- Admin management ---

export async function listTrustedDomains() {
  const result = await getPool().query(
    `SELECT id, domain, created_at AS "createdAt" FROM trusted_domains ORDER BY domain`
  );
  return result.rows;
}

export async function addTrustedDomain(domain) {
  const pool = getPool();
  const normalized = domain.trim().toLowerCase().replace(/^@/, "");

  if (!normalized || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(normalized)) {
    return { errors: { domain: "Enter a valid domain (e.g. students.example.edu)" } };
  }

  const existing = await pool.query(
    "SELECT id FROM trusted_domains WHERE domain = $1",
    [normalized]
  );
  if (existing.rows.length > 0) {
    return { errors: { domain: "This domain is already trusted." } };
  }

  const result = await pool.query(
    "INSERT INTO trusted_domains (domain) VALUES ($1) RETURNING id",
    [normalized]
  );
  return { id: result.rows[0].id, domain: normalized };
}

export async function deleteTrustedDomain(id) {
  const result = await getPool().query(
    "DELETE FROM trusted_domains WHERE id = $1",
    [id]
  );
  return result.rowCount > 0;
}

export async function listReaderAccounts({ status, search, limit = 50, offset = 0, sort = "createdAt", dir = "desc" } = {}) {
  const pool = getPool();
  const conditions = [];
  const params = [];
  const now = new Date().toISOString();

  if (status === "expired") {
    params.push(now);
    conditions.push("a.status = 'active'");
    conditions.push("a.expires_at IS NOT NULL");
    conditions.push(`a.expires_at < $${params.length}`);
  } else if (status === "active") {
    params.push(now);
    conditions.push("a.status = 'active'");
    conditions.push(`(a.expires_at IS NULL OR a.expires_at >= $${params.length})`);
  } else if (status === "disabled") {
    conditions.push("a.status = 'disabled'");
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`a.email ILIKE $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const SORT_MAP = {
    email: "a.email",
    createdAt: "a.created_at",
    lastSeenAt: "a.last_seen_at",
    expiresAt: "a.expires_at"
  };
  const sortCol = SORT_MAP[sort] ?? "a.created_at";
  const sortDir = dir === "asc" ? "ASC" : "DESC";

  const countParams = [...params];
  const countResult = await pool.query(
    `SELECT COUNT(*) AS count FROM reader_accounts a ${where}`,
    countParams
  );

  params.push(limit, offset);
  const rowsResult = await pool.query(
    `SELECT a.id, a.email, a.domain, a.status,
            a.expires_at AS "expiresAt",
            a.created_at AS "createdAt",
            a.last_seen_at AS "lastSeenAt"
     FROM reader_accounts a
     ${where}
     ORDER BY ${sortCol} ${sortDir}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { rows: rowsResult.rows, total: Number(countResult.rows[0].count) };
}

export async function updateReaderAccountStatus(id, status) {
  const pool = getPool();
  const result = await pool.query(
    "UPDATE reader_accounts SET status = $1 WHERE id = $2",
    [status, id]
  );
  if (result.rowCount > 0 && status === "disabled") {
    await revokeReaderAccess(pool, id);
  }
  return result.rowCount > 0;
}

export async function updateReaderAccountExpiry(id, expiresAt) {
  const pool = getPool();
  const normalizedExpiry = normalizeExpiry(expiresAt);
  const result = await pool.query(
    "UPDATE reader_accounts SET expires_at = $1 WHERE id = $2",
    [normalizedExpiry, id]
  );
  if (result.rowCount > 0 && normalizedExpiry && normalizedExpiry <= new Date().toISOString()) {
    await revokeReaderAccess(pool, id);
  }
  return result.rowCount > 0;
}

export async function bulkSetReaderExpiry(expiresAt) {
  const pool = getPool();
  const normalizedExpiry = normalizeExpiry(expiresAt);
  const result = await pool.query(
    "UPDATE reader_accounts SET expires_at = $1 WHERE status = 'active'",
    [normalizedExpiry]
  );
  if (normalizedExpiry && normalizedExpiry <= new Date().toISOString()) {
    await pool.query(
      "DELETE FROM reader_sessions WHERE reader_account_id IN (SELECT id FROM reader_accounts WHERE status = 'active')"
    );
    await pool.query(
      "DELETE FROM reader_login_tokens WHERE reader_account_id IN (SELECT id FROM reader_accounts WHERE status = 'active')"
    );
  }
  return result.rowCount;
}

function normalizeExpiry(expiresAt) {
  if (!expiresAt) return null;
  return new Date(expiresAt).toISOString();
}

async function revokeReaderAccess(pool, readerAccountId) {
  await pool.query("DELETE FROM reader_sessions WHERE reader_account_id = $1", [readerAccountId]);
  await pool.query("DELETE FROM reader_login_tokens WHERE reader_account_id = $1", [readerAccountId]);
}
