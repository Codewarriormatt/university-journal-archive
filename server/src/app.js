import cors from "cors";
import express from "express";
import helmet from "helmet";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config/env.js";
import { getPool } from "./db/database.js";
import { globalLimiter } from "./middleware/rateLimiters.js";
import { adminRoutes } from "./routes/adminRoutes.js";
import { repositoryRoutes } from "./routes/repositoryRoutes.js";
import readerRoutes from "./routes/readerRoutes.js";
import { logger } from "./utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = process.env.UPLOADS_DIR ?? path.join(__dirname, "../uploads");
const clientDistDir = path.resolve(__dirname, "../../client/dist");
const clientIndexPath = path.join(clientDistDir, "index.html");

export function createApp() {
  const app = express();

  // Trust the reverse proxy (Railway, Nginx) only when TRUST_PROXY=true,
  // so req.ip reflects the real client IP and X-Forwarded-For cannot be spoofed
  if (config.trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(globalLimiter);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": ["'self'", "https:"],
        "script-src": ["'self'"],
      }
    }
  }));
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "50kb" }));
  app.use("/uploads/images", express.static(path.join(uploadsDir, "images")));
  app.use("/uploads/pdfs", express.static(path.join(uploadsDir, "pdfs")));

  app.get("/api/health", async (request, response) => {
    try {
      await getPool().query("SELECT 1");
      response.json({ ok: true, database: "postgresql" });
    } catch {
      response.status(503).json({ ok: false, database: "postgresql" });
    }
  });

  app.use("/api", repositoryRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/auth/reader", readerRoutes);

  if (process.env.NODE_ENV === "production" && existsSync(clientIndexPath)) {
    app.use(express.static(clientDistDir));
    app.use((request, response, next) => {
      if (request.method === "GET" && request.accepts("html")) {
        return response.sendFile(clientIndexPath);
      }

      return next();
    });
  }

  app.use((request, response) => {
    response.status(404).json({ message: "Route not found." });
  });

  app.use((error, request, response, next) => {
    logger.error("Unhandled server error", { message: error.message, stack: error.stack });
    response.status(500).json({ message: "Unexpected server error." });
  });

  return app;
}
