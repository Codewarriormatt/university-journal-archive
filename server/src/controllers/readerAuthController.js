import { sendMagicLink } from "../utils/email.js";
import { logger } from "../utils/logger.js";
import {
  createLoginToken,
  consumeLoginToken,
  createReaderSession,
  setReaderSessionCookie,
  destroyCurrentReaderSession,
  getCurrentReader
} from "../auth/readerSession.js";
import {
  isDomainTrusted,
  findOrCreateReaderAccount,
  getReaderAccountById
} from "../repositories/readerRepository.js";

// POST /api/auth/reader/request
export async function requestMagicLink(request, response) {
  try {
    const email = String(request.body?.email ?? "").trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response.status(400).json({
        message: "Enter a valid email address.",
        fieldErrors: { email: "Enter a valid email address." }
      });
    }

    const domain = email.split("@")[1];

    if (!await isDomainTrusted(domain)) {
      return response.status(403).json({
        message: "This email domain is not authorized for access.",
        fieldErrors: { email: "This email domain is not authorized for access." }
      });
    }

    const account = await findOrCreateReaderAccount(email);

    if (account.status !== "active") {
      return response.status(403).json({
        message: "This account has been disabled. Contact an administrator.",
        fieldErrors: {}
      });
    }

    const now = new Date().toISOString();
    if (account.expiresAt && account.expiresAt <= now) {
      return response.status(403).json({
        message: "Your access has expired. Contact an administrator to renew.",
        fieldErrors: {}
      });
    }

    const rawToken = await createLoginToken(account.id);
    let redirectPath = String(request.body?.redirect ?? "/").replace(/[^\w/\-?.=#%]/g, "");
    // Same-site paths only: "//host" would send the reader to another site.
    if (!redirectPath.startsWith("/") || redirectPath.startsWith("//")) {
      redirectPath = "/";
    }

    await sendMagicLink(email, rawToken, redirectPath);

    return response.status(200).json({
      message: "Check your email for a sign-in link."
    });
  } catch (error) {
    if (error.code === "EMAIL_NOT_CONFIGURED") {
      logger.error("Magic link requested but email is not configured");
      return response.status(503).json({ message: "Email delivery is not set up. Contact an administrator." });
    }
    logger.error("Magic link request failed", { message: error.message, stack: error.stack });
    return response.status(500).json({ message: "Unexpected server error." });
  }
}

// GET /api/auth/reader/verify/:token
export async function verifyMagicLink(request, response) {
  try {
    const rawToken = String(request.params.token ?? "");

    const readerAccountId = await consumeLoginToken(rawToken);

    if (!readerAccountId) {
      return response.status(400).json({
        message: "This sign-in link is invalid or has expired.",
        code: "TOKEN_INVALID"
      });
    }

    const account = await getReaderAccountById(readerAccountId);

    if (!account || account.status !== "active") {
      return response.status(403).json({
        message: "This account has been disabled.",
        code: "ACCOUNT_DISABLED"
      });
    }

    if (account.expiresAt && account.expiresAt <= new Date().toISOString()) {
      return response.status(403).json({
        message: "Your access has expired. Contact an administrator to renew.",
        code: "ACCOUNT_EXPIRED"
      });
    }

    const { token, expiresAt } = await createReaderSession(readerAccountId);
    setReaderSessionCookie(response, token);

    return response.status(200).json({
      message: "Signed in successfully.",
      reader: {
        id: account.id,
        email: account.email,
        sessionExpiresAt: expiresAt
      }
    });
  } catch (error) {
    logger.error("Magic link verification failed", { message: error.message, stack: error.stack });
    return response.status(500).json({ message: "Unexpected server error." });
  }
}

// POST /api/auth/reader/logout
export async function readerLogout(request, response) {
  await destroyCurrentReaderSession(request, response);
  return response.status(200).json({ message: "Signed out." });
}

// GET /api/auth/reader/me
export async function getReaderMe(request, response) {
  const reader = await getCurrentReader(request);

  if (!reader) {
    return response.status(200).json({ authenticated: false });
  }

  const account = await getReaderAccountById(reader.id);

  return response.status(200).json({
    authenticated: true,
    reader: {
      id: account.id,
      email: account.email,
      createdAt: account.createdAt,
      lastSeenAt: account.lastSeenAt,
      expiresAt: account.expiresAt
    }
  });
}
