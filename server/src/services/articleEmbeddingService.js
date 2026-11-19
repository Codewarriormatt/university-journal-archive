import OpenAI from "openai";
import { getPool } from "../db/database.js";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

function getClient() {
  if (!config.openaiApiKey) return null;
  return new OpenAI({ apiKey: config.openaiApiKey });
}

function buildEmbeddingText(article) {
  const parts = [article.title];
  if (article.abstract) parts.push(article.abstract);
  if (article.keywords) parts.push(article.keywords);
  return parts.join(" ").slice(0, 8000);
}

export async function embedText(text) {
  const client = getClient();
  if (!client) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: trimmed
  });
  return response.data[0].embedding;
}

export async function regenerateArticleEmbedding(articleId) {
  if (!config.openaiApiKey) return;

  const pool = getPool();
  const result = await pool.query(
    `SELECT
       a.id,
       a.title,
       COALESCE(a.abstract, '') AS abstract,
       COALESCE(
         (SELECT string_agg(k.name, ', ' ORDER BY k.name)
          FROM article_keywords ak
          JOIN keywords k ON k.id = ak.keyword_id
          WHERE ak.article_id = a.id),
         ''
       ) AS keywords
     FROM articles a WHERE a.id = $1`,
    [articleId]
  );

  const article = result.rows[0];
  if (!article) return;

  const text = buildEmbeddingText(article);
  const embedding = await embedText(text);
  if (!embedding) return;

  await pool.query(
    "UPDATE articles SET embedding = $1 WHERE id = $2",
    [embedding, articleId]
  );

  logger.info("Article embedding generated", { articleId });
}

export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
