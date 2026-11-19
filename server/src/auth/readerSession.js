import { createHash, randomBytes } from "node:crypto";
import { getPool } from "../db/database.js";

const SESSION_COOKIE_NAME = "reader_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_DURATION_MS = 15 * 60 * 1000;

export async function createLoginToken(readerAccountId) {
  const pool = getPool();
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_DURATION_MS).toISOString();

  await pool.query(
    "DELETE FROM reader_login_tokens WHERE reader_account_id = $1 AND used_at IS NULL",
    [readerAccountId]
  );
  await pool.query(
    "INSERT INTO reader_login_tokens (reader_account_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [readerAccountId, hashToken(rawToken), expiresAt]
  );
  return rawToken;
}

export async function consumeLoginToken(rawToken) {
  const pool = getPool();
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const result = await pool.query(
    `SELECT id, reader_account_id AS "readerAccountId", expires_at AS "expiresAt", used_at AS "usedAt"
     FROM reader_login_tokens WHERE token_hash = $1 LIMIT 1`,
    [tokenHash]
  );
  const row = result.rows[0];

  if (!row || row.usedAt || new Date(row.expiresAt) <= now) {
    return null;
  }

  await pool.query(
    "UPDATE reader_login_tokens SET used_at = $1 WHERE id = $2",
    [now.toISOString(), row.id]
  );
  return row.readerAccountId;
}

export async function createReaderSession(readerAccountId) {
  const pool = getPool();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  await pool.query(
    "INSERT INTO reader_sessions (reader_account_id, session_token_hash, expires_at) VALUES ($1, $2, $3)",
    [readerAccountId, hashToken(token), expiresAt]
  );
  return { token, expiresAt };
}

export function setReaderSessionCookie(response, token) {
  response.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "Strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(SESSION_DURATION_MS / 1000)
    })
  );
}

export function clearReaderSessionCookie(response) {
  response.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "Strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0
    })
  );
}

export async function destroyCurrentReaderSession(request, response) {
  const token = getReaderSessionToken(request);
  if (token) {
    await getPool().query(
      "DELETE FROM reader_sessions WHERE session_token_hash = $1",
      [hashToken(token)]
    );
  }
  clearReaderSessionCookie(response);
}

export async function getCurrentReader(request) {
  const token = getReaderSessionToken(request);
  if (!token) return null;

  const pool = getPool();
  const tokenHash = hashToken(token);
  const now = new Date();

  const result = await pool.query(
    `SELECT s.id AS "sessionId", s.expires_at AS "expiresAt",
            a.id, a.email, a.domain, a.status,
            a.expires_at AS "accountExpiresAt"
     FROM reader_sessions s
     JOIN reader_accounts a ON a.id = s.reader_account_id
     WHERE s.session_token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );
  const session = result.rows[0];

  if (
    !session ||
    new Date(session.expiresAt) <= now ||
    session.status !== "active" ||
    (session.accountExpiresAt && new Date(session.accountExpiresAt) <= now)
  ) {
    await pool.query(
      "DELETE FROM reader_sessions WHERE session_token_hash = $1",
      [tokenHash]
    );
    return null;
  }

  await pool.query(
    "UPDATE reader_sessions SET last_seen_at = NOW() WHERE id = $1",
    [session.sessionId]
  );
  await pool.query(
    "UPDATE reader_accounts SET last_seen_at = NOW() WHERE id = $1",
    [session.id]
  );

  return {
    sessionId: session.sessionId,
    id: session.id,
    email: session.email,
    domain: session.domain
  };
}

export function requireReaderOrAdminSession(getCurrentAdmin) {
  return async (request, response, next) => {
    const reader = await getCurrentReader(request);
    if (reader) {
      request.readerAccount = reader;
      return next();
    }

    const admin = await getCurrentAdmin(request);
    if (admin) {
      request.adminUser = admin;
      return next();
    }

    return response.status(401).json({
      message: "Sign in is required to download files.",
      code: "UNAUTHENTICATED"
    });
  };
}

function getReaderSessionToken(request) {
  return parseCookies(request.headers.cookie ?? "")[SESSION_COOKIE_NAME] ?? "";
}

function parseCookies(cookieHeader) {
  return cookieHeader.split(";").reduce((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) return cookies;
    cookies[rawName] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}

function serializeCookie(name, value, options) {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) segments.push(`Max-Age=${options.maxAge}`);
  if (options.path) segments.push(`Path=${options.path}`);
  if (options.httpOnly) segments.push("HttpOnly");
  if (options.sameSite) segments.push(`SameSite=${options.sameSite}`);
  if (options.secure) segments.push("Secure");
  return segments.join("; ");
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
