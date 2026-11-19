import { rateLimit, ipKeyGenerator } from "express-rate-limit";

const json429 = (msg) => ({
  message: msg,
  code: "RATE_LIMITED"
});

/**
 * TIER 1 — Global baseline
 * Applied to every route. Stops floods and obvious abuse.
 * 500 requests per 15 minutes per IP.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: json429("Too many requests. Please slow down and try again later.")
});

/**
 * TIER 2 — Public read endpoints
 * Applied to all public browse, search, and detail pages.
 * 300 requests per 10 minutes per IP.
 * Generous enough for heavy browsing; blocks automated scrapers.
 */
export const publicReadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: json429("Too many requests. Please wait a moment before browsing further.")
});

/**
 * TIER 3 — PDF download
 * Applied only to the PDF download endpoint.
 * 20 downloads per hour per IP.
 * Prevents bulk harvesting of all PDFs in the repository.
 */
export const pdfDownloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: json429("Download limit reached. You can download up to 20 files per hour.")
});

/**
 * TIER 4a — Magic link request by IP
 * Applied to POST /api/auth/reader/request.
 * 5 requests per hour per IP address.
 * Prevents one machine from triggering mass email sends.
 */
export const magicLinkIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: json429("Too many sign-in requests from this device. Try again in an hour.")
});

/**
 * TIER 4b — Magic link request by email address
 * Applied to POST /api/auth/reader/request alongside the IP limiter.
 * 3 requests per hour per email address.
 * Prevents a single email address from being flooded with magic link emails.
 */
export const magicLinkEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    return email || ipKeyGenerator(req);
  },
  message: json429("Too many sign-in requests for this email address. Try again in an hour.")
});

/**
 * TIER 5 — Admin login (first layer)
 * Applied to POST /api/admin/auth/login.
 * 15 requests per 15 minutes per IP.
 * Acts as a fast IP-based block before the DB-tracked per-username limiter runs.
 */
export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: json429("Too many login attempts from this device. Try again in 15 minutes.")
});

/**
 * TIER 6 — File uploads
 * Applied to all upload endpoints (image and PDF).
 * 20 uploads per hour per IP.
 * Uploads are resource-intensive; this is generous for any real admin workflow.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: json429("Upload limit reached. You can upload up to 20 files per hour.")
});

/**
 * TIER 7 — Admin write operations
 * Applied to all admin POST, PUT, and DELETE routes.
 * 120 requests per 15 minutes per IP.
 * These routes already require a valid session; this is a backup guard.
 */
export const adminWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: json429("Too many write operations. Please slow down and try again shortly.")
});
