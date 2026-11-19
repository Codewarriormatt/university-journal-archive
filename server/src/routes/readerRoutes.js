import { Router } from "express";
import {
  requestMagicLink,
  verifyMagicLink,
  readerLogout,
  getReaderMe
} from "../controllers/readerAuthController.js";
import {
  magicLinkIpLimiter,
  magicLinkEmailLimiter
} from "../middleware/rateLimiters.js";

const router = Router();

// Both limiters run in series: IP first, then per-email
router.post("/request", magicLinkIpLimiter, magicLinkEmailLimiter, requestMagicLink);
router.get("/verify/:token", verifyMagicLink);
router.post("/logout", readerLogout);
router.get("/me", getReaderMe);

export default router;
