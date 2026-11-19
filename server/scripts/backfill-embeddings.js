import { getPool, closePool } from "../src/db/database.js";
import { regenerateArticleEmbedding } from "../src/services/articleEmbeddingService.js";
import { config } from "../src/config/env.js";

async function main() {
  if (!config.openaiApiKey) {
    console.log("OPENAI_API_KEY is not set. Add it to server/.env and try again.");
    process.exit(0);
  }

  const pool = getPool();
  const result = await pool.query(
    "SELECT id FROM articles WHERE embedding IS NULL ORDER BY id"
  );

  const ids = result.rows.map((r) => r.id);
  console.log(`Found ${ids.length} article(s) without embeddings.`);

  if (ids.length === 0) {
    await closePool();
    return;
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      await regenerateArticleEmbedding(id);
      success++;
      console.log(`[${i + 1}/${ids.length}] Article ${id} — OK`);
    } catch (err) {
      failed++;
      console.error(`[${i + 1}/${ids.length}] Article ${id} — FAILED: ${err.message}`);
    }
    // ~100ms delay to stay well within OpenAI rate limits
    await new Promise((r) => setTimeout(r, 100));
  }

  await closePool();
  console.log(`\nDone. ${success} succeeded, ${failed} failed.`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
