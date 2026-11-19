import Anthropic from "@anthropic-ai/sdk";
import { getPool } from "../db/database.js";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

export async function regenerateJournalInsight(journalId) {
  const pool = getPool();
  await generateInsight(pool, journalId);
}

export async function runInsightWorker() {
  if (!config.anthropicApiKey) return;

  const pool = getPool();
  const journal = await findOneStaleJournal(pool);
  if (!journal) return;

  try {
    await generateInsight(pool, journal.id);
  } catch (error) {
    logger.error("AI insight generation failed", { journalId: journal.id, message: error.message });
    // Mark not-stale so a transient error doesn't retry every tick indefinitely.
    // It will be re-marked stale on the next admin content change.
    await pool.query(
      "UPDATE journals SET ai_insight_stale = FALSE WHERE id = $1",
      [journal.id]
    ).catch(() => {});
  }
}

async function findOneStaleJournal(pool) {
  const result = await pool.query(
    `SELECT j.id
     FROM journals j
     WHERE j.ai_insight_stale = TRUE
       AND (SELECT COUNT(*) FROM articles a WHERE a.journal_id = j.id) > 0
     ORDER BY j.ai_insight_updated_at ASC NULLS FIRST
     LIMIT 1`
  );
  return result.rows[0] ?? null;
}

async function buildPrompt(pool, journalId) {
  const metaResult = await pool.query(
    `SELECT
       j.title,
       j.subject_area AS "subjectArea",
       j.publisher_name AS "publisherName",
       (SELECT COUNT(*) FROM journal_volumes jv WHERE jv.journal_id = j.id)::integer AS "volumeCount",
       (SELECT COUNT(*) FROM journal_issues ji WHERE ji.journal_id = j.id)::integer AS "issueCount",
       (SELECT COUNT(*) FROM articles a WHERE a.journal_id = j.id)::integer AS "articleCount"
     FROM journals j
     WHERE j.id = $1`,
    [journalId]
  );
  const journal = metaResult.rows[0];
  if (!journal) return null;

  const articlesResult = await pool.query(
    `SELECT
       a.title,
       LEFT(a.date_published, 4)::integer AS year,
       COALESCE(
         (SELECT string_agg(k.name, ', ' ORDER BY k.name)
          FROM article_keywords ak
          JOIN keywords k ON k.id = ak.keyword_id
          WHERE ak.article_id = a.id),
         ''
       ) AS keywords
     FROM articles a
     WHERE a.journal_id = $1
     ORDER BY a.date_published DESC NULLS LAST, a.id DESC
     LIMIT 15`,
    [journalId]
  );

  const articleLines = articlesResult.rows
    .map((a) => {
      const year = a.year ? ` (${a.year})` : "";
      const kw = a.keywords ? ` — keywords: ${a.keywords}` : "";
      return `- "${a.title}"${year}${kw}`;
    })
    .join("\n");

  return `You are writing a brief overview of an academic journal for a public repository browser.

Journal: ${journal.title}
Subject area: ${journal.subjectArea ?? "Not specified"}
Publisher: ${journal.publisherName ?? "Not specified"}
Volumes: ${journal.volumeCount}  Issues: ${journal.issueCount}  Articles: ${journal.articleCount}

Recent articles (up to 15):
${articleLines}

Write exactly 3 sentences in plain, non-technical language:
1. What subject domain and scope this journal covers.
2. The recurring themes or topics across its articles.
3. What kind of reader or researcher would find this journal useful.

Output only the 3 sentences. No headings, bullet points, or labels.`;
}

async function generateInsight(pool, journalId) {
  const prompt = await buildPrompt(pool, journalId);
  if (!prompt) return;

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 250,
    messages: [{ role: "user", content: prompt }]
  });

  const insight = message.content[0]?.text?.trim() ?? "";
  if (!insight) return;

  await pool.query(
    `UPDATE journals
     SET ai_insight = $1, ai_insight_updated_at = NOW(), ai_insight_stale = FALSE
     WHERE id = $2`,
    [insight, journalId]
  );

  logger.info("AI insight generated", { journalId });
}
