import { createHash, randomBytes } from "node:crypto";
import { config } from "../config/env.js";
import { getPool } from "../db/database.js";

const SESSION_COOKIE_NAME = "admin_session";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

export async function createAdminSession(adminUserId) {
  const pool = getPool();
  const token = randomBytes(32).toString("base64url");
  const csrfToken = createCsrfToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  await pool.query(
    `INSERT INTO admin_sessions (admin_user_id, session_token_hash, csrf_token_hash, csrf_token, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [adminUserId, hashSessionToken(token), hashSessionToken(csrfToken), csrfToken, expiresAt]
  );
  return { token, csrfToken, expiresAt };
}

export function setSessionCookie(response, token) {
  response.setHeader("Set-Cookie", serializeCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "Strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000)
  }));
}

export function clearSessionCookie(response) {
  response.setHeader("Set-Cookie", serializeCookie(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "Strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  }));
}

export async function destroyCurrentSession(request, response) {
  const token = getSessionToken(request);
  if (token) {
    await getPool().query(
      "DELETE FROM admin_sessions WHERE session_token_hash = $1",
      [hashSessionToken(token)]
    );
  }
  clearSessionCookie(response);
}

export async function getCurrentAdmin(request) {
  const token = getSessionToken(request);
  if (!token) return null;

  const pool = getPool();
  const tokenHash = hashSessionToken(token);

  const result = await pool.query(
    `SELECT s.id AS "sessionId", s.expires_at AS "expiresAt",
            u.id, u.username, u.email, u.display_name AS "displayName",
            u.role, u.account_status AS "accountStatus",
            u.must_change_password AS "mustChangePassword", u.is_active AS "isActive"
     FROM admin_sessions s
     JOIN admin_users u ON u.id = s.admin_user_id
     WHERE s.session_token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );
  const session = result.rows[0];

  if (!session || !session.isActive || session.accountStatus !== "active") {
    await pool.query("DELETE FROM admin_sessions WHERE session_token_hash = $1", [tokenHash]);
    return null;
  }

  if (new Date(session.expiresAt) <= new Date()) {
    await pool.query("DELETE FROM admin_sessions WHERE session_token_hash = $1", [tokenHash]);
    return null;
  }

  await pool.query(
    "UPDATE admin_sessions SET last_seen_at = NOW() WHERE id = $1",
    [session.sessionId]
  );

  return {
    sessionId: session.sessionId,
    id: session.id,
    username: session.username,
    email: session.email,
    displayName: session.displayName,
    role: session.role,
    accountStatus: session.accountStatus,
    mustChangePassword: Boolean(session.mustChangePassword)
  };
}

export async function requireAdminSession(request, response, next) {
  const admin = await getCurrentAdmin(request);
  if (!admin) {
    return response.status(401).json({
      message: "Admin sign-in is required.",
      fieldErrors: {},
      code: "UNAUTHENTICATED"
    });
  }
  request.adminUser = admin;
  return next();
}

export function requireCompletedPasswordChange(request, response, next) {
  if (request.adminUser?.mustChangePassword) {
    return response.status(403).json({
      message: "Admin password change is required before continuing.",
      fieldErrors: {},
      code: "PASSWORD_CHANGE_REQUIRED"
    });
  }
  return next();
}

export function requireAdminRole(allowedRoles) {
  return (request, response, next) => {
    if (!allowedRoles.includes(request.adminUser?.role)) {
      return response.status(403).json({
        message: "This account does not have permission to perform this action.",
        fieldErrors: {},
        code: "FORBIDDEN"
      });
    }
    return next();
  };
}

export async function requireCsrfToken(request, response, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    return next();
  }

  const sessionToken = getSessionToken(request);
  const csrfToken = String(request.headers["x-csrf-token"] ?? "");

  if (!sessionToken || !csrfToken) {
    return response.status(403).json({
      message: "Security token is required. Refresh the page and try again.",
      fieldErrors: {},
      code: "CSRF_REQUIRED"
    });
  }

  const result = await getPool().query(
    `SELECT csrf_token_hash AS "csrfTokenHash"
     FROM admin_sessions WHERE session_token_hash = $1 LIMIT 1`,
    [hashSessionToken(sessionToken)]
  );
  const session = result.rows[0];

  if (!session?.csrfTokenHash || session.csrfTokenHash !== hashSessionToken(csrfToken)) {
    return response.status(403).json({
      message: "Security token is invalid. Refresh the page and try again.",
      fieldErrors: {},
      code: "CSRF_INVALID"
    });
  }
  return next();
}

export async function getAdminCsrfToken(request) {
  const sessionToken = getSessionToken(request);
  if (!sessionToken) return "";

  const result = await getPool().query(
    "SELECT csrf_token AS \"csrfToken\" FROM admin_sessions WHERE session_token_hash = $1 LIMIT 1",
    [hashSessionToken(sessionToken)]
  );
  const stored = result.rows[0]?.csrfToken;

  // Session pre-dates migration 011 — generate and persist a token now
  if (!stored) return refreshCsrfToken(request);

  return stored;
}

export async function refreshCsrfToken(request) {
  const sessionToken = getSessionToken(request);
  if (!sessionToken) return "";

  const csrfToken = createCsrfToken();
  await getPool().query(
    "UPDATE admin_sessions SET csrf_token_hash = $1, csrf_token = $2 WHERE session_token_hash = $3",
    [hashSessionToken(csrfToken), csrfToken, hashSessionToken(sessionToken)]
  );
  return csrfToken;
}

export async function isLoginRateLimited(username, ipAddress) {
  return (await getLoginRateLimitInfo(username, ipAddress)).isLimited;
}

export async function getLoginRateLimitInfo(username, ipAddress) {
  const pool = getPool();
  const windowStart = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
  const result = await pool.query(
    `SELECT COUNT(*) AS count, MIN(attempted_at) AS "oldestAttempt"
     FROM admin_login_attempts
     WHERE was_successful = false
       AND attempted_at >= $1
       AND (username = $2 OR ip_address = $3)`,
    [windowStart, username, ipAddress]
  );

  const row = result.rows[0];
  const count = Number(row.count);
  const isLimited = count >= MAX_FAILED_ATTEMPTS;
  const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - count);
  const retryAfter = isLimited && row.oldestAttempt
    ? new Date(new Date(row.oldestAttempt).getTime() + LOGIN_WINDOW_MS).toISOString()
    : null;

  return { isLimited, attemptsLeft, retryAfter };
}

export async function recordLoginAttempt({ username, ipAddress, wasSuccessful }) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO admin_login_attempts (username, ip_address, attempted_at, was_successful)
     VALUES ($1, $2, $3, $4)`,
    [username, ipAddress, new Date().toISOString(), wasSuccessful]
  );
  if (wasSuccessful) {
    await pool.query(
      `DELETE FROM admin_login_attempts WHERE was_successful = false AND (username = $1 OR ip_address = $2)`,
      [username, ipAddress]
    );
  }
}

export function getRequestIp(request) {
  const forwardedFor = request.headers["x-forwarded-for"];
  if (config.trustProxy && typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.ip ?? request.socket.remoteAddress ?? "unknown";
}

function getSessionToken(request) {
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

function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function createCsrfToken() {
  return randomBytes(32).toString("base64url");
}
