import { logger } from "../utils/logger.js";
import { getRequestIp } from "../auth/session.js";
import { regenerateJournalInsight } from "../services/journalInsightService.js";
import { config } from "../config/env.js";
import {
  AdminRepositoryError,
  createAdminAccount,
  createAdminAnnouncement,
  createAdminArticle,
  createAdminAuthor,
  createAdminIssue,
  createAdminJournal,
  createAdminKeyword,
  createAdminVolume,
  deleteAdminAccount,
  deleteAdminAnnouncement,
  deleteAdminArticle,
  deleteAdminAuthor,
  deleteAdminIssue,
  deleteAdminJournal,
  deleteAdminKeyword,
  deleteAdminVolume,
  getAdminAccount,
  getAdminAnnouncement,
  getAdminArticle,
  getAdminAuthor,
  getAdminDashboard,
  getAdminIssue,
  getAdminJournal,
  getAdminKeyword,
  getAdminOptions,
  getAdminVolume,
  insertAuditLog,
  listAdminAccounts,
  listAdminAnnouncements,
  listAdminArticles,
  listAdminAuthors,
  listAdminIssues,
  listAdminJournals,
  listAdminKeywords,
  listAdminVolumes,
  updateAdminAccount,
  updateAdminAnnouncement,
  updateAdminArticle,
  updateAdminAuthor,
  updateAdminIssue,
  updateAdminJournal,
  updateAdminKeyword,
  updateAdminVolume
} from "../repositories/adminRepository.js";

export async function getDashboard(request, response) {
  return handle(response, () => getAdminDashboard().then((data) => ({ data })));
}

export async function getOptions(request, response) {
  return handle(response, () => getAdminOptions().then((data) => ({ data })));
}

export async function listAccounts(request, response) {
  return handle(response, () => listAdminAccounts(request.query));
}

export async function getAccount(request, response) {
  return handle(response, async () => ({ item: await getAdminAccount(parseId(request)) }));
}

export async function createAccount(request, response) {
  return handle(response, () => createAdminAccount(request.body ?? {}), 201,
    { admin: request.adminUser, ip: getRequestIp(request), action: "create", resourceType: "account",
      getLabel: (r) => r?.item?.displayName ?? null });
}

export async function updateAccount(request, response) {
  return handle(response,
    () => updateAdminAccount(parseId(request), request.body ?? {}, request.adminUser),
    200,
    { admin: request.adminUser, ip: getRequestIp(request), action: "update", resourceType: "account",
      getLabel: (r) => r?.item?.displayName ?? null });
}

export async function deleteAccount(request, response) {
  let fetched;
  return handle(response, async () => {
    const id = parseId(request);
    fetched = await getAdminAccount(id);
    return deleteAdminAccount(id, request.adminUser);
  }, 200, { admin: request.adminUser, ip: getRequestIp(request), action: "delete", resourceType: "account",
    getLabel: () => fetched?.displayName ?? null });
}

export async function listJournals(request, response) {
  return handle(response, () => listAdminJournals(request.query));
}

export async function getJournal(request, response) {
  return handle(response, async () => ({ item: await getAdminJournal(parseId(request)) }));
}

export async function createJournal(request, response) {
  return handle(response, () => createAdminJournal(request.body ?? {}), 201,
    { admin: request.adminUser, ip: getRequestIp(request), action: "create", resourceType: "journal",
      getLabel: (r) => r?.item?.title ?? null });
}

export async function updateJournal(request, response) {
  return handle(response, () => updateAdminJournal(parseId(request), request.body ?? {}), 200,
    { admin: request.adminUser, ip: getRequestIp(request), action: "update", resourceType: "journal",
      getLabel: (r) => r?.item?.title ?? null });
}

export async function deleteJournal(request, response) {
  let fetched;
  return handle(response, async () => {
    const id = parseId(request);
    fetched = await getAdminJournal(id);
    return deleteAdminJournal(id);
  }, 200, { admin: request.adminUser, ip: getRequestIp(request), action: "delete", resourceType: "journal",
    getLabel: () => fetched?.title ?? null });
}

export async function regenerateInsight(request, response) {
  if (!config.anthropicApiKey) {
    return response.status(503).json({ error: "AI insight is not configured on this server." });
  }
  try {
    const id = parseId(request);
    await regenerateJournalInsight(id);
    const journal = await getAdminJournal(id);
    return response.json({ insight: journal.aiInsight, updatedAt: journal.aiInsightUpdatedAt });
  } catch (error) {
    logger.error("Insight regeneration failed", { message: error.message });
    return response.status(500).json({ error: "Insight generation failed. Check server logs." });
  }
}

export async function listVolumes(request, response) {
  return handle(response, () => listAdminVolumes(request.query));
}

export async function getVolume(request, response) {
  return handle(response, async () => ({ item: await getAdminVolume(parseId(request)) }));
}

export async function createVolume(request, response) {
  return handle(response, () => createAdminVolume(request.body ?? {}), 201,
    { admin: request.adminUser, ip: getRequestIp(request), action: "create", resourceType: "volume",
      getLabel: (r) => r?.item?.volumeNumber != null ? `Vol. ${r.item.volumeNumber}` : null });
}

export async function updateVolume(request, response) {
  return handle(response, () => updateAdminVolume(parseId(request), request.body ?? {}), 200,
    { admin: request.adminUser, ip: getRequestIp(request), action: "update", resourceType: "volume",
      getLabel: (r) => r?.item?.volumeNumber != null ? `Vol. ${r.item.volumeNumber}` : null });
}

export async function deleteVolume(request, response) {
  let fetched;
  return handle(response, async () => {
    const id = parseId(request);
    fetched = await getAdminVolume(id);
    return deleteAdminVolume(id);
  }, 200, { admin: request.adminUser, ip: getRequestIp(request), action: "delete", resourceType: "volume",
    getLabel: () => fetched?.volumeNumber != null ? `Vol. ${fetched.volumeNumber}` : null });
}

export async function listIssues(request, response) {
  return handle(response, () => listAdminIssues(request.query));
}

export async function getIssue(request, response) {
  return handle(response, async () => ({ item: await getAdminIssue(parseId(request)) }));
}

export async function createIssue(request, response) {
  return handle(response, () => createAdminIssue(request.body ?? {}), 201,
    { admin: request.adminUser, ip: getRequestIp(request), action: "create", resourceType: "issue",
      getLabel: (r) => r?.item?.issueTitle || (r?.item?.issueNumber != null ? `Issue ${r.item.issueNumber}` : null) });
}

export async function updateIssue(request, response) {
  return handle(response, () => updateAdminIssue(parseId(request), request.body ?? {}), 200,
    { admin: request.adminUser, ip: getRequestIp(request), action: "update", resourceType: "issue",
      getLabel: (r) => r?.item?.issueTitle || (r?.item?.issueNumber != null ? `Issue ${r.item.issueNumber}` : null) });
}

export async function deleteIssue(request, response) {
  let fetched;
  return handle(response, async () => {
    const id = parseId(request);
    fetched = await getAdminIssue(id);
    return deleteAdminIssue(id);
  }, 200, { admin: request.adminUser, ip: getRequestIp(request), action: "delete", resourceType: "issue",
    getLabel: () => fetched?.issueTitle || (fetched?.issueNumber != null ? `Issue ${fetched.issueNumber}` : null) });
}

export async function listArticles(request, response) {
  return handle(response, () => listAdminArticles(request.query));
}

export async function getArticle(request, response) {
  return handle(response, async () => ({ item: await getAdminArticle(parseId(request)) }));
}

export async function createArticle(request, response) {
  return handle(response, () => createAdminArticle(request.body ?? {}), 201,
    { admin: request.adminUser, ip: getRequestIp(request), action: "create", resourceType: "article",
      getLabel: (r) => r?.item?.title ?? null });
}

export async function updateArticle(request, response) {
  return handle(response, () => updateAdminArticle(parseId(request), request.body ?? {}), 200,
    { admin: request.adminUser, ip: getRequestIp(request), action: "update", resourceType: "article",
      getLabel: (r) => r?.item?.title ?? null });
}

export async function deleteArticle(request, response) {
  let fetched;
  return handle(response, async () => {
    const id = parseId(request);
    fetched = await getAdminArticle(id);
    return deleteAdminArticle(id);
  }, 200, { admin: request.adminUser, ip: getRequestIp(request), action: "delete", resourceType: "article",
    getLabel: () => fetched?.title ?? null });
}

export async function listAuthors(request, response) {
  return handle(response, () => listAdminAuthors(request.query));
}

export async function getAuthor(request, response) {
  return handle(response, async () => ({ item: await getAdminAuthor(parseId(request)) }));
}

export async function createAuthor(request, response) {
  return handle(response, () => createAdminAuthor(request.body ?? {}), 201,
    { admin: request.adminUser, ip: getRequestIp(request), action: "create", resourceType: "author",
      getLabel: (r) => r?.item?.displayName ?? null });
}

export async function updateAuthor(request, response) {
  return handle(response, () => updateAdminAuthor(parseId(request), request.body ?? {}), 200,
    { admin: request.adminUser, ip: getRequestIp(request), action: "update", resourceType: "author",
      getLabel: (r) => r?.item?.displayName ?? null });
}

export async function deleteAuthor(request, response) {
  let fetched;
  return handle(response, async () => {
    const id = parseId(request);
    fetched = await getAdminAuthor(id);
    return deleteAdminAuthor(id);
  }, 200, { admin: request.adminUser, ip: getRequestIp(request), action: "delete", resourceType: "author",
    getLabel: () => fetched?.displayName ?? null });
}

export async function listKeywords(request, response) {
  return handle(response, () => listAdminKeywords(request.query));
}

export async function getKeyword(request, response) {
  return handle(response, async () => ({ item: await getAdminKeyword(parseId(request)) }));
}

export async function createKeyword(request, response) {
  return handle(response, () => createAdminKeyword(request.body ?? {}), 201,
    { admin: request.adminUser, ip: getRequestIp(request), action: "create", resourceType: "keyword",
      getLabel: (r) => r?.item?.name ?? null });
}

export async function updateKeyword(request, response) {
  return handle(response, () => updateAdminKeyword(parseId(request), request.body ?? {}), 200,
    { admin: request.adminUser, ip: getRequestIp(request), action: "update", resourceType: "keyword",
      getLabel: (r) => r?.item?.name ?? null });
}

export async function deleteKeyword(request, response) {
  let fetched;
  return handle(response, async () => {
    const id = parseId(request);
    fetched = await getAdminKeyword(id);
    return deleteAdminKeyword(id);
  }, 200, { admin: request.adminUser, ip: getRequestIp(request), action: "delete", resourceType: "keyword",
    getLabel: () => fetched?.name ?? null });
}

export async function listAnnouncements(request, response) {
  return handle(response, () => listAdminAnnouncements(request.query));
}

export async function getAnnouncement(request, response) {
  return handle(response, async () => ({ item: await getAdminAnnouncement(parseId(request)) }));
}

export async function createAnnouncement(request, response) {
  return handle(response, () => createAdminAnnouncement(request.body ?? {}), 201,
    { admin: request.adminUser, ip: getRequestIp(request), action: "create", resourceType: "announcement",
      getLabel: (r) => r?.item?.title ?? null });
}

export async function updateAnnouncement(request, response) {
  return handle(response, () => updateAdminAnnouncement(parseId(request), request.body ?? {}), 200,
    { admin: request.adminUser, ip: getRequestIp(request), action: "update", resourceType: "announcement",
      getLabel: (r) => r?.item?.title ?? null });
}

export async function deleteAnnouncement(request, response) {
  let fetched;
  return handle(response, async () => {
    const id = parseId(request);
    fetched = await getAdminAnnouncement(id);
    return deleteAdminAnnouncement(id);
  }, 200, { admin: request.adminUser, ip: getRequestIp(request), action: "delete", resourceType: "announcement",
    getLabel: () => fetched?.title ?? null });
}

async function handle(response, action, successStatus = 200, audit = null) {
  try {
    const result = await action();
    if (audit) {
      try {
        const rt = (audit.resourceType ?? "").replace(/_/g, " ");
        const details = audit.action === "create" ? `Created new ${rt}`.trim()
          : audit.action === "update" ? `Updated ${rt}`.trim()
          : audit.action === "delete" ? `Deleted ${rt}`.trim()
          : null;
        await insertAuditLog({
          adminUserId: audit.admin.id,
          adminDisplayName: audit.admin.displayName,
          adminRole: audit.admin.role,
          action: audit.action,
          resourceType: audit.resourceType ?? null,
          resourceId: result?.item?.id ?? null,
          resourceLabel: audit.getLabel ? audit.getLabel(result) : null,
          details,
          ipAddress: audit.ip
        });
      } catch (auditError) {
        logger.warn("Audit log insert failed", { message: auditError.message });
      }
    }
    return response.status(successStatus).json(result);
  } catch (error) {
    if (error instanceof AdminRepositoryError) {
      return response.status(error.status).json({
        message: error.message,
        fieldErrors: error.fieldErrors,
        code: error.code,
        ...error.details
      });
    }

    logger.error("Unhandled admin controller error", { message: error.message, stack: error.stack });
    return response.status(500).json({
      message: "Unexpected admin server error.",
      fieldErrors: {},
      code: "SERVER_ERROR"
    });
  }
}

function parseId(request) {
  const id = Number.parseInt(request.params.id, 10);

  if (!Number.isInteger(id) || id < 1) {
    throw new AdminRepositoryError(400, "Invalid id.", "VALIDATION_ERROR", {
      id: "Invalid id."
    });
  }

  return id;
}
