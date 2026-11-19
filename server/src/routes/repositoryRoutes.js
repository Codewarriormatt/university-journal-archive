import { Router } from "express";
import {
  downloadArticlePdf,
  getArticle,
  getHomepage,
  getIssue,
  getJournal,
  getRecords,
  recordCitation
} from "../controllers/repositoryController.js";
import { pdfDownloadLimiter, publicReadLimiter } from "../middleware/rateLimiters.js";

export const repositoryRoutes = Router();

repositoryRoutes.get("/homepage", publicReadLimiter, getHomepage);
repositoryRoutes.get("/records", publicReadLimiter, getRecords);
repositoryRoutes.get("/articles/:id", publicReadLimiter, getArticle);
repositoryRoutes.post("/articles/:id/cite", publicReadLimiter, recordCitation);
repositoryRoutes.get("/downloads/articles/:id/pdf", pdfDownloadLimiter, downloadArticlePdf);
repositoryRoutes.get("/issues/:id", publicReadLimiter, getIssue);
repositoryRoutes.get("/journals/:id", publicReadLimiter, getJournal);
