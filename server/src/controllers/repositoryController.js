import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCurrentAdmin, getRequestIp } from "../auth/session.js";
import { getCurrentReader } from "../auth/readerSession.js";
import {
  getArticleAccessStatus,
  getArticleDownloadTarget,
  getArticleById,
  getHomepageHighlights,
  getIssueById,
  getJournalById,
  listRecordPage,
  listRecords,
  recordArticleCitation,
  recordArticleView,
  recordSearchLog
} from "../repositories/repositoryRepository.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

export async function getRecords(request, response) {
  const recordParams = {
    search: request.query.search ?? "",
    type: request.query.type ?? "all",
    field: request.query.field ?? "all",
    subject: request.query.subject ?? "all",
    publisher: request.query.publisher ?? "all",
    journal: request.query.journal ?? "all",
    year: request.query.year ?? "all",
    yearFrom: request.query.yearFrom ?? "",
    yearTo: request.query.yearTo ?? "",
    sort: request.query.sort ?? "",
    limit: request.query.limit ?? 50,
    page: request.query.page ?? 1,
    pageSize: request.query.pageSize ?? 10
  };

  const isAdmin = !!(await getCurrentAdmin(request));

  if (request.query.page || request.query.pageSize) {
    const page = await listRecordPage(recordParams);
    if (!isAdmin) await recordSearchLog(recordParams, page.total);
    return response.json(page);
  }

  const { records, semanticSearchUsed, semanticUnavailable } = await listRecords(recordParams);
  if (!isAdmin) await recordSearchLog(recordParams, records.length);

  return response.json({
    items: records,
    total: records.length,
    page: 1,
    pageSize: records.length,
    totalPages: 1,
    semanticSearch: semanticSearchUsed,
    semanticUnavailable: semanticUnavailable ?? false
  });
}

export async function getHomepage(request, response) {
  return response.json(await getHomepageHighlights());
}

export async function getArticle(request, response) {
  const id = Number.parseInt(request.params.id, 10);

  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ message: "Invalid article id." });
  }

  const article = await getArticleById(id);

  if (!article) {
    return response.status(404).json({ message: "Article not found." });
  }

  const session = await getCurrentSession(request);
  if (session?.type !== "admin") {
    await recordArticleView(id, buildVisitorKey(request));
  }
  return response.json(await getArticleById(id) ?? article);
}

export async function downloadArticlePdf(request, response) {
  const id = Number.parseInt(request.params.id, 10);

  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ message: "Invalid article id." });
  }

  try {
    const currentSession = await getCurrentSession(request);
    const result = await getArticleDownloadTarget(
      id,
      currentSession,
      buildVisitorKey(request)
    );

    if (result.location) {
      if (result.location.startsWith("/uploads/")) {
        const filePath = path.join(UPLOADS_DIR, result.location.slice("/uploads/".length));
        const filename = path.basename(filePath);
        const disposition = request.query.inline === "1" ? "inline" : "attachment";
        response.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
        return response.sendFile(filePath, (err) => {
          if (!err) return;
          if (err.code === "ECONNRESET" || err.code === "EPIPE") return;
          if (!response.headersSent) {
            response.status(404).json({ message: "PDF file could not be found." });
          }
        });
      }
      return response.redirect(result.location);
    }

    return response.status(result.status).json(result.body);
  } catch (err) {
    if (!response.headersSent) {
      response.status(500).json({ message: "Unexpected error while processing download." });
    }
  }
}

export async function recordCitation(request, response) {
  const id = Number.parseInt(request.params.id, 10);

  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ message: "Invalid article id." });
  }

  const session = await getCurrentSession(request);

  // Admins never count toward citations
  if (session?.type === "admin") {
    return response.json({ ok: true });
  }

  const article = await getArticleAccessStatus(id);
  if (!article) return response.json({ ok: true });

  // Unavailable articles count for nobody
  if (article.accessStatus === "Unavailable") {
    return response.json({ ok: true });
  }

  // Restricted articles only count for authenticated readers
  if (article.accessStatus === "Restricted" && session?.type !== "reader") {
    return response.json({ ok: true });
  }

  const readerAccountId = session?.type === "reader" ? session.id : null;
  await recordArticleCitation(id, buildVisitorKey(request), readerAccountId);
  return response.json({ ok: true });
}

export async function getJournal(request, response) {
  const id = Number.parseInt(request.params.id, 10);

  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ message: "Invalid journal id." });
  }

  const journal = await getJournalById(id);

  if (!journal) {
    return response.status(404).json({ message: "Journal not found." });
  }

  return response.json(journal);
}

export async function getIssue(request, response) {
  const id = Number.parseInt(request.params.id, 10);

  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ message: "Invalid issue id." });
  }

  const issue = await getIssueById(id);

  if (!issue) {
    return response.status(404).json({ message: "Issue not found." });
  }

  return response.json(issue);
}

async function getCurrentSession(request) {
  const admin = await getCurrentAdmin(request);
  if (admin) return { type: "admin", ...admin };
  const reader = await getCurrentReader(request);
  if (reader) return { type: "reader", ...reader };
  return null;
}

function buildVisitorKey(request) {
  return createHash("sha256")
    .update(`${getRequestIp(request)}|${request.headers["user-agent"] ?? ""}`)
    .digest("hex");
}
