import { hashPassword, verifyPassword } from "../auth/password.js";
import { validatePassword } from "../utils/validators.js";
import {
  createAdminSession,
  destroyCurrentSession,
  getAdminCsrfToken,
  getCurrentAdmin,
  getLoginRateLimitInfo,
  getRequestIp,
  isLoginRateLimited,
  recordLoginAttempt,
  refreshCsrfToken,
  setSessionCookie
} from "../auth/session.js";
import { getPool } from "../db/database.js";
import { logger } from "../utils/logger.js";
import { insertAuditLog } from "../repositories/adminRepository.js";

export async function loginAdmin(request, response) {
  const username = normalizeLogin(request.body?.username);
  const password = String(request.body?.password ?? "");
  const fieldErrors = {};

  if (!username) {
    fieldErrors.username = "Username or email is required.";
  }

  if (!password) {
    fieldErrors.password = "Password is required.";
  }

  if (Object.keys(fieldErrors).length) {
    return response.status(400).json({
      message: "Validation failed.",
      fieldErrors,
      code: "VALIDATION_ERROR"
    });
  }

  const ipAddress = getRequestIp(request);

  const rateLimitInfo = await getLoginRateLimitInfo(username, ipAddress);
  if (rateLimitInfo.isLimited) {
    return response.status(429).json({
      message: "Too many failed sign-in attempts.",
      fieldErrors: {},
      code: "RATE_LIMITED",
      retryAfter: rateLimitInfo.retryAfter
    });
  }

  const result = await getPool().query(
    `SELECT id, username, email,
            display_name AS "displayName",
            role,
            account_status AS "accountStatus",
            password_hash AS "passwordHash",
            must_change_password AS "mustChangePassword"
     FROM admin_users
     WHERE is_active = true
       AND account_status = 'active'
       AND (username = $1 OR email = $1)
     LIMIT 1`,
    [username]
  );
  const admin = result.rows[0];

  if (!admin || !verifyPassword(password, admin.passwordHash)) {
    await recordLoginAttempt({ username, ipAddress, wasSuccessful: false });
    const { attemptsLeft, retryAfter } = await getLoginRateLimitInfo(username, ipAddress);
    return response.status(401).json({
      message: "Invalid credentials.",
      fieldErrors: {},
      code: "INVALID_CREDENTIALS",
      attemptsLeft,
      retryAfter
    });
  }

  await recordLoginAttempt({ username, ipAddress, wasSuccessful: true });
  await getPool().query("DELETE FROM admin_sessions WHERE admin_user_id = $1", [admin.id]);
  const session = await createAdminSession(admin.id);
  setSessionCookie(response, session.token);

  try {
    await insertAuditLog({
      adminUserId: admin.id, adminDisplayName: admin.displayName,
      adminRole: admin.role, action: "login", details: "Signed in", ipAddress
    });
  } catch (e) { logger.warn("Audit log failed (login)", { message: e.message }); }

  return response.json({
    message: "Signed in successfully.",
    admin: formatAdmin(admin),
    csrfToken: session.csrfToken
  });
}

export async function getAdminSession(request, response) {
  const admin = await getCurrentAdmin(request);

  if (!admin) {
    return response.status(401).json({
      message: "Admin sign-in is required.",
      fieldErrors: {},
      code: "UNAUTHENTICATED"
    });
  }

  return response.json({
    admin: formatAdmin(admin),
    csrfToken: await getAdminCsrfToken(request)
  });
}

export async function logoutAdmin(request, response) {
  const admin = await getCurrentAdmin(request);
  const ip = getRequestIp(request);
  await destroyCurrentSession(request, response);
  if (admin) {
    try {
      await insertAuditLog({
        adminUserId: admin.id, adminDisplayName: admin.displayName,
        adminRole: admin.role, action: "logout", details: "Signed out", ipAddress: ip
      });
    } catch (e) { logger.warn("Audit log failed (logout)", { message: e.message }); }
  }
  return response.json({ message: "Signed out successfully." });
}

export async function changeAdminPassword(request, response) {
  const currentPassword = String(request.body?.currentPassword ?? "");
  const newPassword = String(request.body?.newPassword ?? "");
  const confirmPassword = String(request.body?.confirmPassword ?? "");
  const fieldErrors = {};

  if (!currentPassword) {
    fieldErrors.currentPassword = "Current password is required.";
  }

  if (!newPassword) {
    fieldErrors.newPassword = "New password is required.";
  } else {
    Object.assign(fieldErrors, validateNewPassword(newPassword));
  }

  if (!confirmPassword) {
    fieldErrors.confirmPassword = "Confirm password is required.";
  } else if (newPassword && confirmPassword !== newPassword) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  if (Object.keys(fieldErrors).length) {
    return response.status(400).json({
      message: "Validation failed.",
      fieldErrors,
      code: "VALIDATION_ERROR"
    });
  }

  const pool = getPool();
  const adminResult = await pool.query(
    `SELECT id, username, email,
            display_name AS "displayName",
            role,
            account_status AS "accountStatus",
            password_hash AS "passwordHash",
            must_change_password AS "mustChangePassword"
     FROM admin_users
     WHERE id = $1
       AND is_active = true
       AND account_status = 'active'
     LIMIT 1`,
    [request.adminUser.id]
  );
  const admin = adminResult.rows[0];

  if (!admin || !verifyPassword(currentPassword, admin.passwordHash)) {
    return response.status(400).json({
      message: "Validation failed.",
      fieldErrors: {
        currentPassword: "Current password is incorrect."
      },
      code: "VALIDATION_ERROR"
    });
  }

  if (verifyPassword(newPassword, admin.passwordHash)) {
    return response.status(400).json({
      message: "Validation failed.",
      fieldErrors: {
        newPassword: "New password must be different from the current password."
      },
      code: "VALIDATION_ERROR"
    });
  }

  await pool.query(
    `UPDATE admin_users
     SET password_hash = $1,
         must_change_password = false,
         updated_at = NOW()
     WHERE id = $2`,
    [hashPassword(newPassword), admin.id]
  );

  await pool.query(
    `DELETE FROM admin_sessions
     WHERE admin_user_id = $1
       AND id != $2`,
    [admin.id, request.adminUser.sessionId]
  );

  try {
    await insertAuditLog({
      adminUserId: admin.id, adminDisplayName: admin.displayName,
      adminRole: admin.role, action: "password_change",
      details: "Changed own password", ipAddress: getRequestIp(request)
    });
  } catch (e) { logger.warn("Audit log failed (password_change)", { message: e.message }); }

  return response.json({
    message: "Password changed successfully.",
    admin: {
      ...formatAdmin(admin),
      mustChangePassword: false
    },
    csrfToken: await refreshCsrfToken(request)
  });
}

function normalizeLogin(value) {
  return String(value ?? "").trim().toLowerCase();
}

function formatAdmin(admin) {
  return {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    displayName: admin.displayName,
    role: admin.role,
    accountStatus: admin.accountStatus,
    mustChangePassword: Boolean(admin.mustChangePassword)
  };
}

function validateNewPassword(password) {
  const message = validatePassword(password);
  return message ? { newPassword: message } : {};
}
