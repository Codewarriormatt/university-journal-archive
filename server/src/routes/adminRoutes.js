import { Router } from "express";
import {
  requireAdminRole,
  requireCsrfToken,
  requireAdminSession,
  requireCompletedPasswordChange
} from "../auth/session.js";
import {
  adminLoginLimiter,
  adminWriteLimiter,
  uploadLimiter
} from "../middleware/rateLimiters.js";
import {
  changeAdminPassword,
  getAdminSession,
  loginAdmin,
  logoutAdmin
} from "../controllers/adminAuthController.js";
import { uploadImageHandler, uploadPdfHandler } from "../controllers/uploadController.js";
import {
  getTrustedDomains,
  postTrustedDomain,
  removeTrustedDomain,
  getReaderAccounts,
  patchReaderAccount,
  bulkExpireReaderAccounts
} from "../controllers/readerManagementController.js";
import { getAuditLogs } from "../controllers/adminAuditController.js";
import {
  createAccount,
  createAnnouncement,
  createArticle,
  createAuthor,
  createIssue,
  createJournal,
  createKeyword,
  createVolume,
  deleteAccount,
  deleteAnnouncement,
  deleteArticle,
  deleteAuthor,
  deleteIssue,
  deleteJournal,
  deleteKeyword,
  deleteVolume,
  getAccount,
  getAnnouncement,
  getArticle,
  getAuthor,
  getDashboard,
  getIssue,
  getJournal,
  getKeyword,
  getOptions,
  getVolume,
  listAccounts,
  listAnnouncements,
  listArticles,
  listAuthors,
  listIssues,
  listJournals,
  listKeywords,
  listVolumes,
  updateAccount,
  updateAnnouncement,
  updateArticle,
  updateAuthor,
  updateIssue,
  updateJournal,
  updateKeyword,
  updateVolume,
  regenerateInsight
} from "../controllers/adminContentController.js";

export const adminRoutes = Router();

adminRoutes.post("/auth/login", adminLoginLimiter, loginAdmin);
adminRoutes.get("/auth/me", getAdminSession);
adminRoutes.post("/auth/logout", logoutAdmin);

adminRoutes.use(requireAdminSession);
adminRoutes.use(requireCsrfToken);
adminRoutes.post("/auth/change-password", changeAdminPassword);
adminRoutes.use(requireCompletedPasswordChange);
adminRoutes.use(
  requireAdminRole(["Super Admin", "Content Admin"])
);

adminRoutes.post("/upload/image", uploadLimiter, uploadImageHandler);
adminRoutes.post("/upload/pdf", uploadLimiter, uploadPdfHandler);

adminRoutes.get("/dashboard", getDashboard);
adminRoutes.get("/options", getOptions);

adminRoutes.get("/accounts", requireAdminRole(["Super Admin"]), listAccounts);
adminRoutes.post("/accounts", adminWriteLimiter, requireAdminRole(["Super Admin"]), createAccount);
adminRoutes.get("/accounts/:id", requireAdminRole(["Super Admin"]), getAccount);
adminRoutes.put("/accounts/:id", adminWriteLimiter, requireAdminRole(["Super Admin"]), updateAccount);
adminRoutes.delete("/accounts/:id", adminWriteLimiter, requireAdminRole(["Super Admin"]), deleteAccount);

adminRoutes.get("/journals", listJournals);
adminRoutes.post("/journals", adminWriteLimiter, createJournal);
adminRoutes.get("/journals/:id", getJournal);
adminRoutes.put("/journals/:id", adminWriteLimiter, updateJournal);
adminRoutes.delete("/journals/:id", adminWriteLimiter, deleteJournal);
adminRoutes.post("/journals/:id/regenerate-insight", adminWriteLimiter, regenerateInsight);

adminRoutes.get("/volumes", listVolumes);
adminRoutes.post("/volumes", adminWriteLimiter, createVolume);
adminRoutes.get("/volumes/:id", getVolume);
adminRoutes.put("/volumes/:id", adminWriteLimiter, updateVolume);
adminRoutes.delete("/volumes/:id", adminWriteLimiter, deleteVolume);

adminRoutes.get("/issues", listIssues);
adminRoutes.post("/issues", adminWriteLimiter, createIssue);
adminRoutes.get("/issues/:id", getIssue);
adminRoutes.put("/issues/:id", adminWriteLimiter, updateIssue);
adminRoutes.delete("/issues/:id", adminWriteLimiter, deleteIssue);

adminRoutes.get("/articles", listArticles);
adminRoutes.post("/articles", adminWriteLimiter, createArticle);
adminRoutes.get("/articles/:id", getArticle);
adminRoutes.put("/articles/:id", adminWriteLimiter, updateArticle);
adminRoutes.delete("/articles/:id", adminWriteLimiter, deleteArticle);

adminRoutes.get("/authors", listAuthors);
adminRoutes.post("/authors", adminWriteLimiter, createAuthor);
adminRoutes.get("/authors/:id", getAuthor);
adminRoutes.put("/authors/:id", adminWriteLimiter, updateAuthor);
adminRoutes.delete("/authors/:id", adminWriteLimiter, deleteAuthor);

adminRoutes.get("/keywords", listKeywords);
adminRoutes.post("/keywords", adminWriteLimiter, createKeyword);
adminRoutes.get("/keywords/:id", getKeyword);
adminRoutes.put("/keywords/:id", adminWriteLimiter, updateKeyword);
adminRoutes.delete("/keywords/:id", adminWriteLimiter, deleteKeyword);

adminRoutes.get("/announcements", listAnnouncements);
adminRoutes.post("/announcements", adminWriteLimiter, createAnnouncement);
adminRoutes.get("/announcements/:id", getAnnouncement);
adminRoutes.put("/announcements/:id", adminWriteLimiter, updateAnnouncement);
adminRoutes.delete("/announcements/:id", adminWriteLimiter, deleteAnnouncement);

adminRoutes.get("/trusted-domains", requireAdminRole(["Super Admin"]), getTrustedDomains);
adminRoutes.post("/trusted-domains", adminWriteLimiter, requireAdminRole(["Super Admin"]), postTrustedDomain);
adminRoutes.delete("/trusted-domains/:id", adminWriteLimiter, requireAdminRole(["Super Admin"]), removeTrustedDomain);

adminRoutes.get("/reader-accounts", requireAdminRole(["Super Admin"]), getReaderAccounts);
adminRoutes.put("/reader-accounts/:id", adminWriteLimiter, requireAdminRole(["Super Admin"]), patchReaderAccount);
adminRoutes.post("/reader-accounts/bulk-expiry", adminWriteLimiter, requireAdminRole(["Super Admin"]), bulkExpireReaderAccounts);

adminRoutes.get("/audit-logs", requireAdminRole(["Super Admin"]), getAuditLogs);
