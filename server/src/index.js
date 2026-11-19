import { config } from "./config/env.js";
import { getPool, runMigrations } from "./db/database.js";
import { seedInitialData } from "./db/initData.js";
import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";
import { runInsightWorker } from "./services/journalInsightService.js";

async function start() {
  await runMigrations();
  await autoInitialize();

  const app = createApp();
  app.listen(config.port, () => {
    logger.info("API server started", { port: config.port, env: process.env.NODE_ENV ?? "development" });
    logger.info("Email configured", { brevo: !!config.email.brevoApiKey });
    if (config.anthropicApiKey) {
      logger.info("AI insight worker started", { intervalMs: config.aiInsightIntervalMs });
      setInterval(() => runInsightWorker().catch(() => {}), config.aiInsightIntervalMs);
    } else {
      logger.info("AI insight worker disabled (ANTHROPIC_API_KEY not set)");
    }
  });
}

async function autoInitialize() {
  try {
    const pool = getPool();
    const result = await pool.query("SELECT COUNT(*) AS count FROM admin_users");
    const count = Number(result.rows[0].count);
    if (count > 0) return;

    const username = process.env.ADMIN_USERNAME;
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!username || !email || !password) {
      logger.error("Cannot auto-initialize: ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD must all be set in the environment.");
      process.exit(1);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await seedInitialData(pool, username, email, password);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    logger.info("Database auto-initialized with sample data and admin user.");
  } catch (error) {
    logger.error("Auto-initialize failed", { message: error.message });
  }
}

start().catch((error) => {
  logger.error("Server startup failed", { message: error.message, stack: error.stack });
  process.exit(1);
});
