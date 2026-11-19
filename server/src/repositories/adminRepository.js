import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "../db/database.js";
import { hashPassword } from "../auth/password.js";
import { validatePassword } from "../utils/validators.js";
import { regenerateArticleEmbedding } from "../services/articleEmbeddingService.js";
import { logger } from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

function deleteUploadFile(storedPath) {
  if (!storedPath) return;
  const relative = storedPath.replace(/^\/uploads\//, "");
  unlink(path.join(UPLOADS_DIR, relative)).catch(() => {});
}

async function markJournalInsightStale(db, journalId) {
  if (!journalId) return;
  await db.query("UPDATE journals SET ai_insight_stale = TRUE WHERE id = $1", [journalId]);
}

const PAGE_SIZES = new Set([10, 25, 50, 100]);
const ACCOUNT_ROLES = new Set(["Super Admin", "Content Admin", "Member"]);
const ACCOUNT_STATUSES = new Set(["active", "disabled"]);
const ACCOUNT_SORTS = new Map([
  ["name_asc", "display_name ASC"],
  ["name_desc", "display_name DESC"],
  ["role", "role ASC, display_name ASC"],
  ["status", "account_status ASC, display_name ASC"],
  ["updated", "updated_at DESC, display_name ASC"]
]);
const ARTICLE_ACCESS_STATUSES = new Set([
  "Open Access",
  "Restricted",
  "Unavailable"
]);
const SUBJECT_AREAS = new Set([
  "Business & Accountancy",
  "Computing & Information Technology",
  "Multimedia & Design",
  "Communication & Media",
  "Psychology & Social Sciences",
  "Engineering",
  "Architecture & Built Environment",
  "Interdisciplinary"
]);
const VOLUME_SORTS = new Map([
  ["newest", "jv.publication_year DESC, (CASE WHEN jv.volume_number ~ '^\\d+$' THEN jv.volume_number::integer ELSE 0 END) DESC, jv.volume_number DESC"],
  ["oldest", "jv.publication_year ASC, (CASE WHEN jv.volume_number ~ '^\\d+$' THEN jv.volume_number::integer ELSE 0 END) ASC, jv.volume_number ASC"],
  ["journal", "j.title ASC, jv.publication_year DESC"],
  ["updated", "jv.updated_at DESC, jv.volume_number ASC"]
]);
const ISSUE_SORTS = new Map([
  ["newest", "COALESCE(ji.date_published, to_char(make_date(jv.publication_year, COALESCE(ji.publication_month, 1), 1), 'YYYY-MM-DD')) DESC, j.title ASC"],
  ["oldest", "COALESCE(ji.date_published, to_char(make_date(jv.publication_year, COALESCE(ji.publication_month, 1), 1), 'YYYY-MM-DD')) ASC, j.title ASC"],
  ["journal", "j.title ASC, jv.publication_year DESC"],
  ["volume", "j.title ASC, (CASE WHEN jv.volume_number ~ '^\\d+$' THEN jv.volume_number::integer ELSE 0 END) DESC, jv.volume_number DESC"],
  ["updated", "ji.updated_at DESC, j.title ASC"]
]);
const JOURNAL_SORTS = new Map([
  ["title_asc", "title ASC"],
  ["title_desc", "title DESC"],
  ["updated", "updated_at DESC, title ASC"]
]);
const ARTICLE_SORTS = new Map([
  ["newest", "COALESCE(jv.publication_year, LEFT(a.date_published, 4)::integer, 0) DESC, a.title ASC"],
  ["oldest", "COALESCE(jv.publication_year, LEFT(a.date_published, 4)::integer, 0) ASC, a.title ASC"],
  ["title_asc", "a.title ASC"],
  ["title_desc", "a.title DESC"],
  ["updated", "a.updated_at DESC, a.title ASC"]
]);
const AUTHOR_SORTS = new Map([
  ["name_asc", "display_name ASC"],
  ["name_desc", "display_name DESC"],
  ["updated", "updated_at DESC, display_name ASC"]
]);
const KEYWORD_SORTS = new Map([
  ["name_asc", "name ASC"],
  ["name_desc", "name DESC"],
  ["most_used", "(SELECT COUNT(*) FROM article_keywords ak WHERE ak.keyword_id = keywords.id) DESC, name ASC"],
  ["updated", "updated_at DESC, name ASC"]
]);
const ANNOUNCEMENT_LABELS = new Set([
  "Repository update",
  "Access notice",
  "Metadata quality",
  "Service notice",
  "Event",
  "Maintenance"
]);
const ANNOUNCEMENT_STATUSES = new Set(["Draft", "Published", "Archived"]);
const ANNOUNCEMENT_SORTS = new Map([
  ["newest", "publish_date DESC, sort_order ASC, title ASC"],
  ["oldest", "publish_date ASC, sort_order ASC, title ASC"],
  ["title_asc", "title ASC"],
  ["status", "status ASC, publish_date DESC, title ASC"],
  ["updated", "updated_at DESC, title ASC"]
]);

export class AdminRepositoryError extends Error {
  constructor(status, message, code, fieldErrors = {}, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.details = details;
  }
}

async function withTransaction(fn) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getAdminDashboard() {
  const pool = getPool();

  const [
    journalsCount,
    issuesCount,
    articlesCount,
    onlineFirstCount,
    authorsCount,
    keywordsCount,
    announcementsCount,
    publishedAnnouncementsCount,
    articlesWithoutPdfCount,
    restrictedWithoutPdfCount,
    articlesWithoutAuthorsCount,
    articlesWithoutKeywordsCount,
    issuesWithoutArticlesCount,
    volumesWithoutIssuesCount,
    draftAnnouncementsCount,
    adminPasswordChangesCount,
    expiredReaderCount,
    disabledReaderCount,
    activeAdminsCount,
    disabledAdminsCount,
    passwordChangeRequiredAdminsCount,
    activeReadersCount,
    expiredReadersCount,
    disabledReadersCount,
    trustedDomainsCount,
    publishedAnnouncementsHealthCount,
    draftAnnouncementsHealthCount,
    archivedAnnouncementsCount,
    futurePublishedCount,
    visibleOnHomepageCount,
    latestVisibleRow,
    topByViewsRows,
    topByDownloadsRows,
    topByCitationsRows,
    recentArticlesRows,
    recentUpdatesRows
  ] = await Promise.all([
    pool.query("SELECT COUNT(*) AS count FROM journals"),
    pool.query("SELECT COUNT(*) AS count FROM journal_issues"),
    pool.query("SELECT COUNT(*) AS count FROM articles"),
    pool.query("SELECT COUNT(*) AS count FROM articles WHERE issue_id IS NULL"),
    pool.query("SELECT COUNT(*) AS count FROM authors"),
    pool.query("SELECT COUNT(*) AS count FROM keywords"),
    pool.query("SELECT COUNT(*) AS count FROM announcements"),
    pool.query("SELECT COUNT(*) AS count FROM announcements WHERE status = 'Published'"),
    pool.query("SELECT COUNT(*) AS count FROM articles WHERE pdf_file_path IS NULL OR trim(pdf_file_path) = ''"),
    pool.query("SELECT COUNT(*) AS count FROM articles WHERE access_status = 'Restricted' AND (pdf_file_path IS NULL OR trim(pdf_file_path) = '')"),
    pool.query("SELECT COUNT(*) AS count FROM articles a WHERE NOT EXISTS (SELECT 1 FROM article_authors aa WHERE aa.article_id = a.id)"),
    pool.query("SELECT COUNT(*) AS count FROM articles a WHERE NOT EXISTS (SELECT 1 FROM article_keywords ak WHERE ak.article_id = a.id)"),
    pool.query("SELECT COUNT(*) AS count FROM journal_issues ji WHERE NOT EXISTS (SELECT 1 FROM articles a WHERE a.issue_id = ji.id)"),
    pool.query("SELECT COUNT(*) AS count FROM journal_volumes jv WHERE NOT EXISTS (SELECT 1 FROM journal_issues ji WHERE ji.volume_id = jv.id)"),
    pool.query("SELECT COUNT(*) AS count FROM announcements WHERE status = 'Draft'"),
    pool.query("SELECT COUNT(*) AS count FROM admin_users WHERE must_change_password = true AND is_active = true"),
    pool.query("SELECT COUNT(*) AS count FROM reader_accounts WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < NOW()"),
    pool.query("SELECT COUNT(*) AS count FROM reader_accounts WHERE status = 'disabled'"),
    pool.query("SELECT COUNT(*) AS count FROM admin_users WHERE account_status = 'active' AND is_active = true"),
    pool.query("SELECT COUNT(*) AS count FROM admin_users WHERE account_status = 'disabled' OR is_active = false"),
    pool.query("SELECT COUNT(*) AS count FROM admin_users WHERE must_change_password = true AND is_active = true"),
    pool.query("SELECT COUNT(*) AS count FROM reader_accounts WHERE status = 'active' AND (expires_at IS NULL OR expires_at >= NOW())"),
    pool.query("SELECT COUNT(*) AS count FROM reader_accounts WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < NOW()"),
    pool.query("SELECT COUNT(*) AS count FROM reader_accounts WHERE status = 'disabled'"),
    pool.query("SELECT COUNT(*) AS count FROM trusted_domains"),
    pool.query("SELECT COUNT(*) AS count FROM announcements WHERE status = 'Published'"),
    pool.query("SELECT COUNT(*) AS count FROM announcements WHERE status = 'Draft'"),
    pool.query("SELECT COUNT(*) AS count FROM announcements WHERE status = 'Archived'"),
    pool.query("SELECT COUNT(*) AS count FROM announcements WHERE status = 'Published' AND publish_date > CURRENT_DATE::text"),
    pool.query("SELECT COUNT(*) AS count FROM announcements WHERE status = 'Published' AND publish_date <= CURRENT_DATE::text"),
    pool.query(`
      SELECT id, title, label, publish_date AS "publishDate"
      FROM announcements
      WHERE status = 'Published'
        AND publish_date <= CURRENT_DATE::text
      ORDER BY sort_order ASC, publish_date DESC, updated_at DESC, id DESC
      LIMIT 1
    `),
    pool.query(`
      SELECT
        a.id,
        a.title,
        a.view_count AS "viewCount",
        a.download_count AS "downloadCount",
        a.citation_count AS "citationCount",
        j.title AS "journalTitle",
        j.subject_area AS "subjectArea",
        (SELECT STRING_AGG(au2.display_name, ', ' ORDER BY aa2.author_order ASC)
         FROM article_authors aa2
         JOIN authors au2 ON au2.id = aa2.author_id
         WHERE aa2.article_id = a.id) AS authors
      FROM articles a
      JOIN journals j ON j.id = a.journal_id
      ORDER BY a.view_count DESC, a.title ASC
      LIMIT 10
    `),
    pool.query(`
      SELECT
        a.id,
        a.title,
        a.view_count AS "viewCount",
        a.download_count AS "downloadCount",
        a.citation_count AS "citationCount",
        j.title AS "journalTitle",
        j.subject_area AS "subjectArea",
        (SELECT STRING_AGG(au2.display_name, ', ' ORDER BY aa2.author_order ASC)
         FROM article_authors aa2
         JOIN authors au2 ON au2.id = aa2.author_id
         WHERE aa2.article_id = a.id) AS authors
      FROM articles a
      JOIN journals j ON j.id = a.journal_id
      ORDER BY a.download_count DESC, a.title ASC
      LIMIT 10
    `),
    pool.query(`
      SELECT
        a.id,
        a.title,
        a.view_count AS "viewCount",
        a.download_count AS "downloadCount",
        a.citation_count AS "citationCount",
        j.title AS "journalTitle",
        j.subject_area AS "subjectArea",
        (SELECT STRING_AGG(au2.display_name, ', ' ORDER BY aa2.author_order ASC)
         FROM article_authors aa2
         JOIN authors au2 ON au2.id = aa2.author_id
         WHERE aa2.article_id = a.id) AS authors
      FROM articles a
      JOIN journals j ON j.id = a.journal_id
      ORDER BY a.citation_count DESC, a.title ASC
      LIMIT 10
    `),
    pool.query(`
      SELECT
        a.id,
        a.title,
        a.updated_at AS "updatedAt",
        j.title AS "journalTitle",
        jv.volume_number AS volume,
        ji.issue_number AS "issueNumber"
      FROM articles a
      JOIN journals j ON j.id = a.journal_id
      LEFT JOIN journal_issues ji ON ji.id = a.issue_id
      LEFT JOIN journal_volumes jv ON jv.id = ji.volume_id
      ORDER BY a.updated_at DESC, a.id DESC
      LIMIT 10
    `),
    pool.query(`
      SELECT *
      FROM (
        SELECT
          id,
          'journals' AS resource,
          'Journal' AS "resourceLabel",
          title,
          COALESCE(publisher_name, 'No publisher') AS subtitle,
          updated_at AS "updatedAt"
        FROM journals
        UNION ALL
        SELECT
          jv.id,
          'volumes' AS resource,
          'Volume' AS "resourceLabel",
          j.title || ' Vol. ' || jv.volume_number AS title,
          'Volume year ' || jv.publication_year AS subtitle,
          jv.updated_at AS "updatedAt"
        FROM journal_volumes jv
        JOIN journals j ON j.id = jv.journal_id
        UNION ALL
        SELECT
          ji.id,
          'issues' AS resource,
          'Issue' AS "resourceLabel",
          j.title || ' Vol. ' || jv.volume_number || ', No. ' || ji.issue_number AS title,
          COALESCE(ji.issue_title, 'No issue title') AS subtitle,
          ji.updated_at AS "updatedAt"
        FROM journal_issues ji
        JOIN journals j ON j.id = ji.journal_id
        JOIN journal_volumes jv ON jv.id = ji.volume_id
        UNION ALL
        SELECT
          a.id,
          'articles' AS resource,
          'Article' AS "resourceLabel",
          a.title,
          j.title AS subtitle,
          a.updated_at AS "updatedAt"
        FROM articles a
        JOIN journals j ON j.id = a.journal_id
        UNION ALL
        SELECT
          id,
          'announcements' AS resource,
          'Announcement' AS "resourceLabel",
          title,
          status || ' · ' || publish_date AS subtitle,
          updated_at AS "updatedAt"
        FROM announcements
      ) sub
      ORDER BY "updatedAt" DESC, id DESC
      LIMIT 12
    `)
  ]);

  return {
    counts: {
      journals: Number(journalsCount.rows[0].count),
      issues: Number(issuesCount.rows[0].count),
      articles: Number(articlesCount.rows[0].count),
      onlineFirstArticles: Number(onlineFirstCount.rows[0].count),
      authors: Number(authorsCount.rows[0].count),
      keywords: Number(keywordsCount.rows[0].count),
      announcements: Number(announcementsCount.rows[0].count),
      publishedAnnouncements: Number(publishedAnnouncementsCount.rows[0].count)
    },
    needsReview: {
      articlesWithoutPdf: Number(articlesWithoutPdfCount.rows[0].count),
      restrictedArticlesWithoutPdf: Number(restrictedWithoutPdfCount.rows[0].count),
      articlesWithoutAuthors: Number(articlesWithoutAuthorsCount.rows[0].count),
      articlesWithoutKeywords: Number(articlesWithoutKeywordsCount.rows[0].count),
      issuesWithoutArticles: Number(issuesWithoutArticlesCount.rows[0].count),
      volumesWithoutIssues: Number(volumesWithoutIssuesCount.rows[0].count),
      draftAnnouncements: Number(draftAnnouncementsCount.rows[0].count),
      adminPasswordChangesRequired: Number(adminPasswordChangesCount.rows[0].count),
      expiredReaderAccounts: Number(expiredReaderCount.rows[0].count),
      disabledReaderAccounts: Number(disabledReaderCount.rows[0].count)
    },
    accessHealth: {
      activeAdmins: Number(activeAdminsCount.rows[0].count),
      disabledAdmins: Number(disabledAdminsCount.rows[0].count),
      passwordChangeRequiredAdmins: Number(passwordChangeRequiredAdminsCount.rows[0].count),
      activeReaders: Number(activeReadersCount.rows[0].count),
      expiredReaders: Number(expiredReadersCount.rows[0].count),
      disabledReaders: Number(disabledReadersCount.rows[0].count),
      trustedDomains: Number(trustedDomainsCount.rows[0].count)
    },
    announcementHealth: {
      published: Number(publishedAnnouncementsHealthCount.rows[0].count),
      draft: Number(draftAnnouncementsHealthCount.rows[0].count),
      archived: Number(archivedAnnouncementsCount.rows[0].count),
      futurePublished: Number(futurePublishedCount.rows[0].count),
      visibleOnHomepage: Number(visibleOnHomepageCount.rows[0].count),
      latestVisible: latestVisibleRow.rows[0] ?? null
    },
    topByViews: topByViewsRows.rows,
    topByDownloads: topByDownloadsRows.rows,
    topByCitations: topByCitationsRows.rows,
    recentArticles: recentArticlesRows.rows,
    recentUpdates: recentUpdatesRows.rows
  };
}

export async function listAdminAccounts(params = {}) {
  const pool = getPool();
  const paging = normalizePaging(params);
  const search = normalizeSearch(params.search);
  const sort = ACCOUNT_SORTS.get(params.sort) ?? ACCOUNT_SORTS.get("name_asc");

  const queryParams = [];
  let where = "";
  if (search) {
    queryParams.push(`%${search}%`);
    const ref = `$${queryParams.length}`;
    where = `WHERE username ILIKE ${ref} OR email ILIKE ${ref} OR display_name ILIKE ${ref} OR role ILIKE ${ref} OR account_status ILIKE ${ref}`;
  }

  const total = Number((await pool.query(`SELECT COUNT(*) AS count FROM admin_users ${where}`, queryParams)).rows[0].count);

  queryParams.push(paging.pageSize, paging.offset);
  const items = (await pool.query(
    `
    SELECT
      id,
      username,
      email,
      display_name AS "displayName",
      role,
      account_status AS "accountStatus",
      must_change_password AS "mustChangePassword",
      updated_at AS "updatedAt"
    FROM admin_users
    ${where}
    ORDER BY ${sort}
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  )).rows.map(formatAccountFlags);

  return paged(items, total, paging);
}

export async function getAdminAccount(id) {
  const pool = getPool();
  const account = (await pool.query(
    `
    SELECT
      id,
      username,
      email,
      display_name AS "displayName",
      role,
      account_status AS "accountStatus",
      must_change_password AS "mustChangePassword",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM admin_users
    WHERE id = $1
    `,
    [id]
  )).rows[0];

  if (!account) {
    throw notFound("Account not found.");
  }

  return formatAccountFlags(account);
}

export async function createAdminAccount(input) {
  const pool = getPool();
  const data = validateAccount(input, { isCreate: true });

  await ensureUniqueValue({
    db: pool,
    table: "admin_users",
    column: "username",
    value: data.username,
    field: "username",
    message: "Username already exists."
  });
  await ensureUniqueValue({
    db: pool,
    table: "admin_users",
    column: "email",
    value: data.email,
    field: "email",
    message: "Email already exists."
  });

  const result = await pool.query(
    `
    INSERT INTO admin_users (
      username,
      email,
      display_name,
      password_hash,
      role,
      account_status,
      must_change_password,
      is_active
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
    `,
    [
      data.username,
      data.email,
      data.displayName,
      hashPassword(data.password),
      data.role,
      data.accountStatus,
      data.mustChangePassword,
      data.accountStatus === "active"
    ]
  );

  return {
    item: await getAdminAccount(result.rows[0].id),
    warnings: getAccountWarnings(data)
  };
}

export async function updateAdminAccount(id, input, currentAdmin) {
  await getAdminAccount(id);

  const pool = getPool();
  const data = validateAccount(input, { isCreate: false });

  await ensureUniqueValue({
    db: pool,
    table: "admin_users",
    column: "username",
    value: data.username,
    field: "username",
    message: "Username already exists.",
    currentId: id
  });
  await ensureUniqueValue({
    db: pool,
    table: "admin_users",
    column: "email",
    value: data.email,
    field: "email",
    message: "Email already exists.",
    currentId: id
  });

  await ensureAccountUpdateSafe(pool, id, data, currentAdmin);

  if (data.password) {
    await pool.query(
      `
      UPDATE admin_users
      SET
        username = $1,
        email = $2,
        display_name = $3,
        password_hash = $4,
        role = $5,
        account_status = $6,
        must_change_password = $7,
        is_active = $8,
        updated_at = NOW()
      WHERE id = $9
      `,
      [
        data.username,
        data.email,
        data.displayName,
        hashPassword(data.password),
        data.role,
        data.accountStatus,
        data.mustChangePassword,
        data.accountStatus === "active",
        id
      ]
    );
  } else {
    await pool.query(
      `
      UPDATE admin_users
      SET
        username = $1,
        email = $2,
        display_name = $3,
        role = $4,
        account_status = $5,
        must_change_password = $6,
        is_active = $7,
        updated_at = NOW()
      WHERE id = $8
      `,
      [
        data.username,
        data.email,
        data.displayName,
        data.role,
        data.accountStatus,
        data.mustChangePassword,
        data.accountStatus === "active",
        id
      ]
    );
  }

  if (data.accountStatus !== "active") {
    await pool.query("DELETE FROM admin_sessions WHERE admin_user_id = $1", [id]);
  } else if (data.password) {
    if (Number(id) === Number(currentAdmin?.id)) {
      await pool.query(
        `
        DELETE FROM admin_sessions
        WHERE admin_user_id = $1
          AND id != $2
        `,
        [id, currentAdmin.sessionId]
      );
    } else {
      await pool.query("DELETE FROM admin_sessions WHERE admin_user_id = $1", [id]);
    }
  }

  return {
    item: await getAdminAccount(id),
    warnings: getAccountWarnings(data)
  };
}

export async function deleteAdminAccount(id, currentAdmin) {
  const account = await getAdminAccount(id);

  if (Number(id) === Number(currentAdmin?.id)) {
    throw validationError({
      id: "You cannot delete the account you are currently using."
    });
  }

  const pool = getPool();
  if (account.role === "Super Admin" && account.accountStatus === "active") {
    await ensureAnotherActiveSuperAdmin(pool, id);
  }
  await pool.query("DELETE FROM admin_users WHERE id = $1", [id]);
  return { deleted: true };
}

export async function listAdminJournals(params = {}) {
  const pool = getPool();
  const paging = normalizePaging(params);
  const search = normalizeSearch(params.search);
  const sort = JOURNAL_SORTS.get(params.sort) ?? JOURNAL_SORTS.get("title_asc");

  const queryParams = [];
  let where = "";
  if (search) {
    queryParams.push(`%${search}%`);
    const ref = `$${queryParams.length}`;
    where = `WHERE title ILIKE ${ref} OR publisher_name ILIKE ${ref} OR subject_area ILIKE ${ref} OR print_issn ILIKE ${ref} OR online_issn ILIKE ${ref}`;
  }

  const total = Number((await pool.query(`SELECT COUNT(*) AS count FROM journals ${where}`, queryParams)).rows[0].count);

  queryParams.push(paging.pageSize, paging.offset);
  const items = (await pool.query(
    `
    SELECT
      id,
      title,
      abbreviation,
      print_issn AS "printIssn",
      online_issn AS "onlineIssn",
      publisher_name AS "publisherName",
      subject_area AS "subjectArea",
      journal_url AS "journalUrl",
      updated_at AS "updatedAt",
      (
        SELECT COUNT(*)
        FROM journal_issues ji
        WHERE ji.journal_id = journals.id
      ) AS "issueCount",
      (
        SELECT COUNT(*)
        FROM articles a
        WHERE a.journal_id = journals.id
      ) AS "articleCount"
    FROM journals
    ${where}
    ORDER BY ${sort}
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  )).rows;

  return paged(items, total, paging);
}

export async function getAdminJournal(id) {
  const pool = getPool();
  const journal = (await pool.query(
    `
    SELECT
      id,
      title,
      abbreviation,
      print_issn AS "printIssn",
      online_issn AS "onlineIssn",
      publisher_name AS "publisherName",
      place_of_publication AS "placeOfPublication",
      journal_url AS "journalUrl",
      subject_area AS "subjectArea",
      description,
      default_cover_image AS "defaultCoverImage",
      ai_insight AS "aiInsight",
      ai_insight_updated_at AS "aiInsightUpdatedAt",
      ai_insight_stale AS "aiInsightStale",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM journals
    WHERE id = $1
    `,
    [id]
  )).rows[0];

  if (!journal) {
    throw notFound("Journal not found.");
  }

  return journal;
}

export async function createAdminJournal(input) {
  const pool = getPool();
  const data = validateJournal(input);
  const warnings = await getJournalWarnings(pool, data);

  await ensureUniqueValue({
    db: pool,
    table: "journals",
    column: "print_issn",
    value: data.printIssn,
    field: "printIssn",
    message: "Print ISSN already exists."
  });
  await ensureUniqueValue({
    db: pool,
    table: "journals",
    column: "online_issn",
    value: data.onlineIssn,
    field: "onlineIssn",
    message: "Online ISSN already exists."
  });

  const result = await pool.query(
    `
    INSERT INTO journals (
      title,
      abbreviation,
      print_issn,
      online_issn,
      publisher_name,
      place_of_publication,
      journal_url,
      subject_area,
      description,
      default_cover_image
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id
    `,
    [
      data.title,
      data.abbreviation,
      data.printIssn,
      data.onlineIssn,
      data.publisherName,
      data.placeOfPublication,
      data.journalUrl,
      data.subjectArea,
      data.description,
      data.defaultCoverImage
    ]
  );

  return {
    item: await getAdminJournal(result.rows[0].id),
    warnings
  };
}

export async function updateAdminJournal(id, input) {
  const existing = await getAdminJournal(id);

  const pool = getPool();
  const data = validateJournal(input);
  const warnings = await getJournalWarnings(pool, data, id);

  await ensureUniqueValue({
    db: pool,
    table: "journals",
    column: "print_issn",
    value: data.printIssn,
    field: "printIssn",
    message: "Print ISSN already exists.",
    currentId: id
  });
  await ensureUniqueValue({
    db: pool,
    table: "journals",
    column: "online_issn",
    value: data.onlineIssn,
    field: "onlineIssn",
    message: "Online ISSN already exists.",
    currentId: id
  });

  await pool.query(
    `
    UPDATE journals
    SET
      title = $1,
      abbreviation = $2,
      print_issn = $3,
      online_issn = $4,
      publisher_name = $5,
      place_of_publication = $6,
      journal_url = $7,
      subject_area = $8,
      description = $9,
      default_cover_image = $10,
      updated_at = NOW()
    WHERE id = $11
    `,
    [
      data.title,
      data.abbreviation,
      data.printIssn,
      data.onlineIssn,
      data.publisherName,
      data.placeOfPublication,
      data.journalUrl,
      data.subjectArea,
      data.description,
      data.defaultCoverImage,
      id
    ]
  );

  await markJournalInsightStale(pool, id);

  if (existing.defaultCoverImage && existing.defaultCoverImage !== data.defaultCoverImage) {
    deleteUploadFile(existing.defaultCoverImage);
  }

  return {
    item: await getAdminJournal(id),
    warnings
  };
}

export async function deleteAdminJournal(id) {
  const existing = await getAdminJournal(id);

  const pool = getPool();
  const dependencies = {
    issues: await countRows(pool, "journal_issues", "journal_id", id),
    articles: await countRows(pool, "articles", "journal_id", id)
  };

  if (dependencies.issues || dependencies.articles) {
    throw dependencyError(
      "This journal cannot be deleted while issues or articles are linked to it.",
      dependencies,
      await getJournalDeleteLinks(pool, id),
      [
        "Review the linked issues and articles first.",
        "Delete or move dependent article records before deleting this journal."
      ]
    );
  }

  await pool.query("DELETE FROM journals WHERE id = $1", [id]);
  deleteUploadFile(existing.defaultCoverImage);
  return { deleted: true };
}

export async function listAdminVolumes(params = {}) {
  const pool = getPool();
  const paging = normalizePaging(params);
  const search = normalizeSearch(params.search);
  const sort = VOLUME_SORTS.get(params.sort) ?? VOLUME_SORTS.get("newest");
  const journalId = params.journalId ? Number(params.journalId) : null;

  const conditions = [];
  const queryParams = [];

  if (search) {
    queryParams.push(`%${search}%`);
    const ref = `$${queryParams.length}`;
    conditions.push(
      `(j.title ILIKE ${ref} OR jv.volume_number ILIKE ${ref} OR jv.volume_title ILIKE ${ref} OR jv.publication_year::text ILIKE ${ref})`
    );
  }

  if (journalId) {
    queryParams.push(journalId);
    conditions.push(`jv.journal_id = $${queryParams.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const total = Number((await pool.query(
    `
    SELECT COUNT(*) AS count
    FROM journal_volumes jv
    JOIN journals j ON j.id = jv.journal_id
    ${where}
    `,
    queryParams
  )).rows[0].count);

  queryParams.push(paging.pageSize, paging.offset);
  const items = (await pool.query(
    `
    SELECT
      jv.id,
      jv.journal_id AS "journalId",
      j.title AS "journalTitle",
      jv.volume_number AS "volumeNumber",
      jv.publication_year AS "publicationYear",
      jv.volume_title AS "volumeTitle",
      jv.updated_at AS "updatedAt",
      (
        SELECT COUNT(*)
        FROM journal_issues ji
        WHERE ji.volume_id = jv.id
      ) AS "issueCount"
    FROM journal_volumes jv
    JOIN journals j ON j.id = jv.journal_id
    ${where}
    ORDER BY ${sort}
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  )).rows;

  return paged(items, total, paging);
}

export async function getAdminVolume(id) {
  const pool = getPool();
  const volume = (await pool.query(
    `
    SELECT
      jv.id,
      jv.journal_id AS "journalId",
      j.title AS "journalTitle",
      jv.volume_number AS "volumeNumber",
      jv.publication_year AS "publicationYear",
      jv.volume_title AS "volumeTitle",
      jv.created_at AS "createdAt",
      jv.updated_at AS "updatedAt"
    FROM journal_volumes jv
    JOIN journals j ON j.id = jv.journal_id
    WHERE jv.id = $1
    `,
    [id]
  )).rows[0];

  if (!volume) {
    throw notFound("Volume not found.");
  }

  return volume;
}

export async function createAdminVolume(input) {
  const pool = getPool();
  const data = validateVolume(input);

  await ensureJournalExists(pool, data.journalId);
  await ensureUniqueVolume(pool, data);

  const result = await pool.query(
    `
    INSERT INTO journal_volumes (
      journal_id,
      volume_number,
      publication_year,
      volume_title
    )
    VALUES ($1, $2, $3, $4)
    RETURNING id
    `,
    [data.journalId, data.volumeNumber, data.publicationYear, data.volumeTitle]
  );

  await markJournalInsightStale(pool, data.journalId);

  return {
    item: await getAdminVolume(result.rows[0].id),
    warnings: await getVolumeWarnings(pool, data)
  };
}

export async function updateAdminVolume(id, input) {
  const existing = await getAdminVolume(id);

  const pool = getPool();
  const data = validateVolume(input);

  await ensureJournalExists(pool, data.journalId);
  await ensureVolumeMoveSafe(pool, id, existing, data);
  await ensureUniqueVolume(pool, data, id);

  await pool.query(
    `
    UPDATE journal_volumes
    SET
      journal_id = $1,
      volume_number = $2,
      publication_year = $3,
      volume_title = $4,
      updated_at = NOW()
    WHERE id = $5
    `,
    [data.journalId, data.volumeNumber, data.publicationYear, data.volumeTitle, id]
  );

  await markJournalInsightStale(pool, data.journalId);

  return {
    item: await getAdminVolume(id),
    warnings: await getVolumeWarnings(pool, data, id)
  };
}

export async function deleteAdminVolume(id) {
  const existing = await getAdminVolume(id);

  const pool = getPool();
  const dependencies = {
    issues: await countRows(pool, "journal_issues", "volume_id", id)
  };

  if (dependencies.issues) {
    const linkedIssues = (await pool.query(
      `
      SELECT id, issue_number, issue_title
      FROM journal_issues
      WHERE volume_id = $1
      ORDER BY issue_number ASC
      LIMIT 5
      `,
      [id]
    )).rows;

    throw dependencyError(
      "This volume cannot be deleted while issues are linked to it.",
      dependencies,
      { issues: linkedIssues },
      [
        "Review the linked issues first.",
        "Delete or move all issues in this volume before deleting the volume."
      ]
    );
  }

  await markJournalInsightStale(pool, existing.journalId);
  await pool.query("DELETE FROM journal_volumes WHERE id = $1", [id]);
  return { deleted: true };
}

export async function listAdminIssues(params = {}) {
  const pool = getPool();
  const paging = normalizePaging(params);
  const search = normalizeSearch(params.search);
  const sort = ISSUE_SORTS.get(params.sort) ?? ISSUE_SORTS.get("newest");

  const queryParams = [];
  let where = "";
  if (search) {
    queryParams.push(`%${search}%`);
    const ref = `$${queryParams.length}`;
    where = `WHERE j.title ILIKE ${ref} OR jv.volume_number ILIKE ${ref} OR ji.issue_number ILIKE ${ref} OR ji.issue_title ILIKE ${ref} OR jv.publication_year::text ILIKE ${ref} OR ji.date_published ILIKE ${ref}`;
  }

  const total = Number((await pool.query(
    `
    SELECT COUNT(*) AS count
    FROM journal_issues ji
    JOIN journals j ON j.id = ji.journal_id
    JOIN journal_volumes jv ON jv.id = ji.volume_id
    ${where}
    `,
    queryParams
  )).rows[0].count);

  queryParams.push(paging.pageSize, paging.offset);
  const items = (await pool.query(
    `
    SELECT
      ji.id,
      ji.journal_id AS "journalId",
      j.title AS "journalTitle",
      ji.volume_id AS "volumeId",
      jv.volume_number AS "volumeNumber",
      jv.publication_year AS "publicationYear",
      ji.issue_number AS "issueNumber",
      ji.issue_title AS "issueTitle",
      ji.publication_month AS "publicationMonth",
      ji.date_published AS "datePublished",
      ji.updated_at AS "updatedAt",
      (
        SELECT COUNT(*)
        FROM articles a
        WHERE a.issue_id = ji.id
      ) AS "articleCount"
    FROM journal_issues ji
    JOIN journals j ON j.id = ji.journal_id
    JOIN journal_volumes jv ON jv.id = ji.volume_id
    ${where}
    ORDER BY ${sort}
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  )).rows;

  return paged(items, total, paging);
}

export async function getAdminIssue(id) {
  const pool = getPool();
  const issue = (await pool.query(
    `
    SELECT
      ji.id,
      ji.journal_id AS "journalId",
      j.title AS "journalTitle",
      ji.volume_id AS "volumeId",
      jv.volume_number AS "volumeNumber",
      jv.publication_year AS "publicationYear",
      ji.issue_number AS "issueNumber",
      ji.issue_title AS "issueTitle",
      ji.publication_month AS "publicationMonth",
      ji.date_published AS "datePublished",
      ji.issue_cover_image AS "issueCoverImage",
      ji.issue_url AS "issueUrl",
      ji.created_at AS "createdAt",
      ji.updated_at AS "updatedAt"
    FROM journal_issues ji
    JOIN journals j ON j.id = ji.journal_id
    JOIN journal_volumes jv ON jv.id = ji.volume_id
    WHERE ji.id = $1
    `,
    [id]
  )).rows[0];

  if (!issue) {
    throw notFound("Issue not found.");
  }

  return issue;
}

export async function createAdminIssue(input) {
  const pool = getPool();
  const data = validateIssue(input);

  await ensureJournalExists(pool, data.journalId);
  await ensureVolumeExists(pool, data.volumeId);
  await ensureVolumeBelongsToJournal(pool, data.volumeId, data.journalId);
  await ensureUniqueIssue(pool, data);

  const result = await pool.query(
    `
    INSERT INTO journal_issues (
      journal_id,
      volume_id,
      issue_number,
      issue_title,
      publication_month,
      date_published,
      issue_cover_image,
      issue_url
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
    `,
    [
      data.journalId,
      data.volumeId,
      data.issueNumber,
      data.issueTitle,
      data.publicationMonth,
      data.datePublished,
      data.issueCoverImage,
      data.issueUrl
    ]
  );

  await markJournalInsightStale(pool, data.journalId);

  return {
    item: await getAdminIssue(result.rows[0].id),
    warnings: await getIssueWarnings(pool, data)
  };
}

export async function updateAdminIssue(id, input) {
  const existing = await getAdminIssue(id);

  const pool = getPool();
  const data = validateIssue(input);

  await ensureJournalExists(pool, data.journalId);
  await ensureVolumeExists(pool, data.volumeId);
  await ensureVolumeBelongsToJournal(pool, data.volumeId, data.journalId);
  await ensureIssueMoveSafe(pool, id, existing, data);
  await ensureUniqueIssue(pool, data, id);

  await pool.query(
    `
    UPDATE journal_issues
    SET
      journal_id = $1,
      volume_id = $2,
      issue_number = $3,
      issue_title = $4,
      publication_month = $5,
      date_published = $6,
      issue_cover_image = $7,
      issue_url = $8,
      updated_at = NOW()
    WHERE id = $9
    `,
    [
      data.journalId,
      data.volumeId,
      data.issueNumber,
      data.issueTitle,
      data.publicationMonth,
      data.datePublished,
      data.issueCoverImage,
      data.issueUrl,
      id
    ]
  );

  await markJournalInsightStale(pool, data.journalId);

  if (existing.issueCoverImage && existing.issueCoverImage !== data.issueCoverImage) {
    deleteUploadFile(existing.issueCoverImage);
  }

  return {
    item: await getAdminIssue(id),
    warnings: await getIssueWarnings(pool, data, id)
  };
}

export async function deleteAdminIssue(id) {
  const existing = await getAdminIssue(id);

  const pool = getPool();
  const dependencies = {
    articles: await countRows(pool, "articles", "issue_id", id)
  };

  if (dependencies.articles) {
    throw dependencyError(
      "This issue cannot be deleted while articles are linked to it.",
      dependencies,
      await getIssueDeleteLinks(pool, id),
      [
        "Review the linked articles first.",
        "Move articles to another issue, mark them online first, or delete them before deleting this issue."
      ]
    );
  }

  await markJournalInsightStale(pool, existing.journalId);
  await pool.query("DELETE FROM journal_issues WHERE id = $1", [id]);
  deleteUploadFile(existing.issueCoverImage);
  return { deleted: true };
}

export async function listAdminArticles(params = {}) {
  const pool = getPool();
  const paging = normalizePaging(params);
  const search = normalizeSearch(params.search);
  const sort = ARTICLE_SORTS.get(params.sort) ?? ARTICLE_SORTS.get("newest");
  const accessStatus = params.accessStatus || null;

  const conditions = [];
  const queryParams = [];

  if (search) {
    queryParams.push(`%${search}%`);
    const ref = `$${queryParams.length}`;
    conditions.push(
      `(a.title ILIKE ${ref} OR a.doi ILIKE ${ref} OR j.title ILIKE ${ref}
        OR EXISTS (
          SELECT 1
          FROM article_authors aa
          JOIN authors au ON au.id = aa.author_id
          WHERE aa.article_id = a.id
            AND au.display_name ILIKE ${ref}
        )
        OR EXISTS (
          SELECT 1
          FROM article_keywords ak
          JOIN keywords k ON k.id = ak.keyword_id
          WHERE ak.article_id = a.id
            AND k.name ILIKE ${ref}
        ))`
    );
  }

  if (accessStatus) {
    queryParams.push(accessStatus);
    conditions.push(`a.access_status = $${queryParams.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const total = Number((await pool.query(
    `
    SELECT COUNT(*) AS count
    FROM articles a
    JOIN journals j ON j.id = a.journal_id
    LEFT JOIN journal_issues ji ON ji.id = a.issue_id
    ${where}
    `,
    queryParams
  )).rows[0].count);

  queryParams.push(paging.pageSize, paging.offset);
  const items = (await pool.query(
    `
    SELECT
      a.id,
      a.title,
      a.doi,
      a.access_status AS "accessStatus",
      a.date_published AS "datePublished",
      COALESCE(jv.publication_year, LEFT(a.date_published, 4)::integer) AS year,
      a.updated_at AS "updatedAt",
      j.title AS "journalTitle",
      jv.volume_number AS volume,
      ji.issue_number AS "issueNumber",
      (
        SELECT STRING_AGG(au.display_name, ', ' ORDER BY aa.author_order ASC)
        FROM article_authors aa
        JOIN authors au ON au.id = aa.author_id
        WHERE aa.article_id = a.id
      ) AS authors,
      (
        SELECT STRING_AGG(k.name, ', ' ORDER BY k.name ASC)
        FROM article_keywords ak
        JOIN keywords k ON k.id = ak.keyword_id
        WHERE ak.article_id = a.id
      ) AS keywords
    FROM articles a
    JOIN journals j ON j.id = a.journal_id
    LEFT JOIN journal_issues ji ON ji.id = a.issue_id
    LEFT JOIN journal_volumes jv ON jv.id = ji.volume_id
    ${where}
    ORDER BY ${sort}
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  )).rows.map((article) => ({
    ...article,
    authors: splitList(article.authors),
    keywords: splitList(article.keywords)
  }));

  return paged(items, total, paging);
}

export async function getAdminArticle(id) {
  const pool = getPool();
  const article = (await pool.query(
    `
    SELECT
      a.id,
      a.journal_id AS "journalId",
      a.issue_id AS "issueId",
      a.title,
      a.doi,
      a.abstract,
      a.page_start AS "pageStart",
      a.page_end AS "pageEnd",
      a.article_url AS "articleUrl",
      a.pdf_file_path AS "pdfFilePath",
      a.citation_count AS "citationCount",
      a.download_count AS "downloadCount",
      a.view_count AS "viewCount",
      a.access_status AS "accessStatus",
      a.date_published AS "datePublished",
      a.created_at AS "createdAt",
      a.updated_at AS "updatedAt",
      j.title AS "journalTitle",
      jv.volume_number AS volume,
      ji.issue_number AS "issueNumber"
    FROM articles a
    JOIN journals j ON j.id = a.journal_id
    LEFT JOIN journal_issues ji ON ji.id = a.issue_id
    LEFT JOIN journal_volumes jv ON jv.id = ji.volume_id
    WHERE a.id = $1
    `,
    [id]
  )).rows[0];

  if (!article) {
    throw notFound("Article not found.");
  }

  return {
    ...article,
    authors: await getArticleAuthors(pool, id),
    keywords: await getArticleKeywords(pool, id)
  };
}

export async function createAdminArticle(input) {
  const data = validateArticle(input);
  const { articleId, warnings } = await withTransaction(async (client) => {
    await ensureJournalExists(client, data.journalId);
    if (data.issueId) {
      await ensureIssueBelongsToJournal(client, data.issueId, data.journalId);
    }
    await ensureUniqueValue({
      db: client,
      table: "articles",
      column: "doi",
      value: data.doi,
      field: "doi",
      message: "DOI already exists."
    });

    const warnings = await getArticleWarnings(client, data);
    const result = await client.query(
      `
      INSERT INTO articles (
        journal_id,
        issue_id,
        title,
        doi,
        abstract,
        page_start,
        page_end,
        article_url,
        pdf_file_path,
        access_status,
        date_published
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
      `,
      [
        data.journalId,
        data.issueId,
        data.title,
        data.doi,
        data.abstract,
        data.pageStart,
        data.pageEnd,
        data.articleUrl,
        data.pdfFilePath,
        data.accessStatus,
        data.datePublished
      ]
    );
    const articleId = result.rows[0].id;

    await saveArticleAuthors(client, articleId, data.authors);
    await saveArticleKeywords(client, articleId, data.keywords);
    await markJournalInsightStale(client, data.journalId);

    return { articleId, warnings };
  });

  regenerateArticleEmbedding(articleId).catch((err) =>
    logger.error("Embedding generation failed", { articleId, message: err.message })
  );

  return {
    item: await getAdminArticle(articleId),
    warnings
  };
}

export async function updateAdminArticle(id, input) {
  const existing = await getAdminArticle(id);

  const data = validateArticle(input);

  const warnings = await withTransaction(async (client) => {
    await ensureJournalExists(client, data.journalId);
    if (data.issueId) {
      await ensureIssueBelongsToJournal(client, data.issueId, data.journalId);
    }
    await ensureUniqueValue({
      db: client,
      table: "articles",
      column: "doi",
      value: data.doi,
      field: "doi",
      message: "DOI already exists.",
      currentId: id
    });

    const warnings = await getArticleWarnings(client, data, id);

    await client.query(
      `
      UPDATE articles
      SET
        journal_id = $1,
        issue_id = $2,
        title = $3,
        doi = $4,
        abstract = $5,
        page_start = $6,
        page_end = $7,
        article_url = $8,
        pdf_file_path = $9,
        access_status = $10,
        date_published = $11,
        updated_at = NOW()
      WHERE id = $12
      `,
      [
        data.journalId,
        data.issueId,
        data.title,
        data.doi,
        data.abstract,
        data.pageStart,
        data.pageEnd,
        data.articleUrl,
        data.pdfFilePath,
        data.accessStatus,
        data.datePublished,
        id
      ]
    );

    await client.query("DELETE FROM article_authors WHERE article_id = $1", [id]);
    await client.query("DELETE FROM article_keywords WHERE article_id = $1", [id]);
    await saveArticleAuthors(client, id, data.authors);
    await saveArticleKeywords(client, id, data.keywords);
    await markJournalInsightStale(client, data.journalId);

    return warnings;
  });

  regenerateArticleEmbedding(id).catch((err) =>
    logger.error("Embedding generation failed", { articleId: id, message: err.message })
  );

  if (existing.pdfFilePath && existing.pdfFilePath !== data.pdfFilePath) {
    deleteUploadFile(existing.pdfFilePath);
  }

  return {
    item: await getAdminArticle(id),
    warnings
  };
}

export async function deleteAdminArticle(id) {
  const article = await getAdminArticle(id);
  const pool = getPool();
  await markJournalInsightStale(pool, article.journalId);
  await pool.query("DELETE FROM articles WHERE id = $1", [id]);
  deleteUploadFile(article.pdfFilePath);
  return { deleted: true };
}

export async function listAdminAuthors(params = {}) {
  const pool = getPool();
  const paging = normalizePaging(params);
  const search = normalizeSearch(params.search);
  const sort = AUTHOR_SORTS.get(params.sort) ?? AUTHOR_SORTS.get("name_asc");

  const queryParams = [];
  let where = "";
  if (search) {
    queryParams.push(`%${search}%`);
    const ref = `$${queryParams.length}`;
    where = `WHERE display_name ILIKE ${ref} OR affiliation ILIKE ${ref} OR orcid ILIKE ${ref}`;
  }

  const total = Number((await pool.query(`SELECT COUNT(*) AS count FROM authors ${where}`, queryParams)).rows[0].count);

  queryParams.push(paging.pageSize, paging.offset);
  const items = (await pool.query(
    `
    SELECT
      id,
      display_name AS "displayName",
      first_name AS "firstName",
      middle_name AS "middleName",
      last_name AS "lastName",
      suffix,
      affiliation,
      orcid,
      updated_at AS "updatedAt",
      (
        SELECT COUNT(*)
        FROM article_authors aa
        WHERE aa.author_id = authors.id
      ) AS "articleCount"
    FROM authors
    ${where}
    ORDER BY ${sort}
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  )).rows;

  return paged(items, total, paging);
}

export async function getAdminAuthor(id) {
  const pool = getPool();
  const author = (await pool.query(
    `
    SELECT
      id,
      display_name AS "displayName",
      first_name AS "firstName",
      middle_name AS "middleName",
      last_name AS "lastName",
      suffix,
      affiliation,
      orcid,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM authors
    WHERE id = $1
    `,
    [id]
  )).rows[0];

  if (!author) {
    throw notFound("Author not found.");
  }

  return author;
}

export async function createAdminAuthor(input) {
  const pool = getPool();
  const data = validateAuthor(input);
  const warnings = await getAuthorWarnings(pool, data);

  await ensureUniqueValue({
    db: pool,
    table: "authors",
    column: "orcid",
    value: data.orcid,
    field: "orcid",
    message: "ORCID already exists."
  });

  const result = await pool.query(
    `
    INSERT INTO authors (
      display_name,
      first_name,
      middle_name,
      last_name,
      suffix,
      affiliation,
      orcid
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
    `,
    [
      data.displayName,
      data.firstName,
      data.middleName,
      data.lastName,
      data.suffix,
      data.affiliation,
      data.orcid
    ]
  );

  return {
    item: await getAdminAuthor(result.rows[0].id),
    warnings
  };
}

export async function updateAdminAuthor(id, input) {
  await getAdminAuthor(id);

  const pool = getPool();
  const data = validateAuthor(input);
  const warnings = await getAuthorWarnings(pool, data, id);

  await ensureUniqueValue({
    db: pool,
    table: "authors",
    column: "orcid",
    value: data.orcid,
    field: "orcid",
    message: "ORCID already exists.",
    currentId: id
  });

  await pool.query(
    `
    UPDATE authors
    SET
      display_name = $1,
      first_name = $2,
      middle_name = $3,
      last_name = $4,
      suffix = $5,
      affiliation = $6,
      orcid = $7,
      updated_at = NOW()
    WHERE id = $8
    `,
    [
      data.displayName,
      data.firstName,
      data.middleName,
      data.lastName,
      data.suffix,
      data.affiliation,
      data.orcid,
      id
    ]
  );

  return {
    item: await getAdminAuthor(id),
    warnings
  };
}

export async function deleteAdminAuthor(id) {
  await getAdminAuthor(id);

  const pool = getPool();
  const dependencies = {
    articles: await countRows(pool, "article_authors", "author_id", id)
  };

  if (dependencies.articles) {
    throw dependencyError(
      "This author cannot be deleted while linked to articles.",
      dependencies,
      await getAuthorDeleteLinks(pool, id),
      [
        "Review the linked articles first.",
        "Remove or replace this author in article metadata before deleting the author record."
      ]
    );
  }

  await pool.query("DELETE FROM authors WHERE id = $1", [id]);
  return { deleted: true };
}

export async function listAdminKeywords(params = {}) {
  const pool = getPool();
  const paging = normalizePaging(params);
  const search = normalizeSearch(params.search);
  const sort = KEYWORD_SORTS.get(params.sort) ?? KEYWORD_SORTS.get("name_asc");

  const queryParams = [];
  let where = "";
  if (search) {
    queryParams.push(`%${search}%`);
    where = `WHERE name ILIKE $${queryParams.length}`;
  }

  const total = Number((await pool.query(`SELECT COUNT(*) AS count FROM keywords ${where}`, queryParams)).rows[0].count);

  queryParams.push(paging.pageSize, paging.offset);
  const items = (await pool.query(
    `
    SELECT
      id,
      name,
      updated_at AS "updatedAt",
      (
        SELECT COUNT(*)
        FROM article_keywords ak
        WHERE ak.keyword_id = keywords.id
      ) AS "articleCount"
    FROM keywords
    ${where}
    ORDER BY ${sort}
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  )).rows;

  return paged(items, total, paging);
}

export async function getAdminKeyword(id) {
  const pool = getPool();
  const keyword = (await pool.query(
    `
    SELECT
      id,
      name,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM keywords
    WHERE id = $1
    `,
    [id]
  )).rows[0];

  if (!keyword) {
    throw notFound("Keyword not found.");
  }

  return keyword;
}

export async function createAdminKeyword(input) {
  const pool = getPool();
  const data = validateKeyword(input);

  await ensureUniqueValue({
    db: pool,
    table: "keywords",
    column: "name",
    value: data.name,
    field: "name",
    message: "Keyword already exists."
  });

  const result = await pool.query(
    "INSERT INTO keywords (name) VALUES ($1) RETURNING id",
    [data.name]
  );

  return {
    item: await getAdminKeyword(result.rows[0].id),
    warnings: []
  };
}

export async function updateAdminKeyword(id, input) {
  await getAdminKeyword(id);

  const pool = getPool();
  const data = validateKeyword(input);

  await ensureUniqueValue({
    db: pool,
    table: "keywords",
    column: "name",
    value: data.name,
    field: "name",
    message: "Keyword already exists.",
    currentId: id
  });

  await pool.query(
    `
    UPDATE keywords
    SET name = $1, updated_at = NOW()
    WHERE id = $2
    `,
    [data.name, id]
  );

  return {
    item: await getAdminKeyword(id),
    warnings: []
  };
}

export async function deleteAdminKeyword(id) {
  await getAdminKeyword(id);

  const pool = getPool();
  const dependencies = {
    articles: await countRows(pool, "article_keywords", "keyword_id", id)
  };

  if (dependencies.articles) {
    throw dependencyError(
      "This keyword cannot be deleted while linked to articles.",
      dependencies,
      await getKeywordDeleteLinks(pool, id),
      [
        "Review the linked articles first.",
        "Remove or replace this keyword in article metadata before deleting the keyword record."
      ]
    );
  }

  await pool.query("DELETE FROM keywords WHERE id = $1", [id]);
  return { deleted: true };
}

export async function listAdminAnnouncements(params = {}) {
  const pool = getPool();
  const paging = normalizePaging(params);
  const search = normalizeSearch(params.search);
  const sort = ANNOUNCEMENT_SORTS.get(params.sort) ?? ANNOUNCEMENT_SORTS.get("newest");
  const status = params.status || null;

  const conditions = [];
  const queryParams = [];

  if (search) {
    queryParams.push(`%${search}%`);
    const ref = `$${queryParams.length}`;
    conditions.push(`(title ILIKE ${ref} OR summary ILIKE ${ref} OR label ILIKE ${ref})`);
  }

  if (status) {
    queryParams.push(status);
    conditions.push(`status = $${queryParams.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const total = Number((await pool.query(`SELECT COUNT(*) AS count FROM announcements ${where}`, queryParams)).rows[0].count);

  queryParams.push(paging.pageSize, paging.offset);
  const items = (await pool.query(
    `
    SELECT
      id,
      label,
      title,
      summary,
      href,
      link_label AS "linkLabel",
      publish_date AS "publishDate",
      status,
      sort_order AS "sortOrder",
      updated_at AS "updatedAt"
    FROM announcements
    ${where}
    ORDER BY ${sort}
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `,
    queryParams
  )).rows;

  return paged(items, total, paging);
}

export async function getAdminAnnouncement(id) {
  const pool = getPool();
  const announcement = (await pool.query(
    `
    SELECT
      id,
      label,
      title,
      summary,
      href,
      link_label AS "linkLabel",
      publish_date AS "publishDate",
      status,
      sort_order AS "sortOrder",
      image,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM announcements
    WHERE id = $1
    `,
    [id]
  )).rows[0];

  if (!announcement) {
    throw notFound("Announcement not found.");
  }

  return announcement;
}

export async function createAdminAnnouncement(input) {
  const pool = getPool();
  const data = validateAnnouncement(input);
  const warnings = await getAnnouncementWarnings(pool, data);

  await ensureUniqueAnnouncement(pool, data);

  const announcementId = await withTransaction(async (client) => {
    await shiftAnnouncementSortOrder(client, data.sortOrder);
    const result = await client.query(
      `
      INSERT INTO announcements (
        label,
        title,
        summary,
        href,
        link_label,
        publish_date,
        status,
        sort_order,
        image
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
      `,
      [
        data.label,
        data.title,
        data.summary,
        data.href,
        data.linkLabel,
        data.publishDate,
        data.status,
        data.sortOrder,
        data.image
      ]
    );
    return result.rows[0].id;
  });

  return {
    item: await getAdminAnnouncement(announcementId),
    warnings
  };
}

export async function updateAdminAnnouncement(id, input) {
  const existing = await getAdminAnnouncement(id);

  const pool = getPool();
  const data = validateAnnouncement(input);
  const warnings = await getAnnouncementWarnings(pool, data, id);

  await ensureUniqueAnnouncement(pool, data, id);

  await withTransaction(async (client) => {
    await shiftAnnouncementSortOrder(client, data.sortOrder, id);
    await client.query(
      `
      UPDATE announcements
      SET
        label = $1,
        title = $2,
        summary = $3,
        href = $4,
        link_label = $5,
        publish_date = $6,
        status = $7,
        sort_order = $8,
        image = $9,
        updated_at = NOW()
      WHERE id = $10
      `,
      [
        data.label,
        data.title,
        data.summary,
        data.href,
        data.linkLabel,
        data.publishDate,
        data.status,
        data.sortOrder,
        data.image,
        id
      ]
    );
  });

  if (existing.image && existing.image !== data.image) {
    deleteUploadFile(existing.image);
  }

  return {
    item: await getAdminAnnouncement(id),
    warnings
  };
}

export async function deleteAdminAnnouncement(id) {
  const existing = await getAdminAnnouncement(id);
  await getPool().query("DELETE FROM announcements WHERE id = $1", [id]);
  deleteUploadFile(existing.image);
  return { deleted: true };
}

export async function getAdminOptions() {
  const pool = getPool();

  const [journalsRows, volumesRows, issuesRows, authorsRows, keywordsRows] = await Promise.all([
    pool.query("SELECT id, title FROM journals ORDER BY title ASC"),
    pool.query(`
      SELECT
        jv.id,
        jv.journal_id AS "journalId",
        j.title AS "journalTitle",
        jv.volume_number AS "volumeNumber",
        jv.publication_year AS "publicationYear",
        jv.volume_title AS "volumeTitle"
      FROM journal_volumes jv
      JOIN journals j ON j.id = jv.journal_id
      ORDER BY j.title ASC, jv.publication_year DESC, (CASE WHEN jv.volume_number ~ '^\\d+$' THEN jv.volume_number::integer ELSE 0 END) DESC
    `),
    pool.query(`
      SELECT
        ji.id,
        ji.journal_id AS "journalId",
        j.title AS "journalTitle",
        ji.volume_id AS "volumeId",
        jv.volume_number AS "volumeNumber",
        jv.publication_year AS "publicationYear",
        ji.issue_number AS "issueNumber"
      FROM journal_issues ji
      JOIN journals j ON j.id = ji.journal_id
      JOIN journal_volumes jv ON jv.id = ji.volume_id
      ORDER BY j.title ASC, jv.publication_year DESC, (CASE WHEN jv.volume_number ~ '^\\d+$' THEN jv.volume_number::integer ELSE 0 END) DESC, ji.issue_number ASC
    `),
    pool.query(`
      SELECT
        id,
        display_name AS "displayName",
        first_name AS "firstName",
        last_name AS "lastName",
        affiliation,
        orcid
      FROM authors
      ORDER BY display_name ASC
    `),
    pool.query(`
      SELECT
        id,
        name,
        (
          SELECT COUNT(*)
          FROM article_keywords ak
          WHERE ak.keyword_id = keywords.id
        ) AS "articleCount"
      FROM keywords
      ORDER BY name ASC
    `)
  ]);

  return {
    journals: journalsRows.rows,
    volumes: volumesRows.rows,
    issues: issuesRows.rows,
    authors: authorsRows.rows,
    keywords: keywordsRows.rows,
    subjectAreas: Array.from(SUBJECT_AREAS)
  };
}

export async function insertAuditLog({
  adminUserId, adminDisplayName, adminRole,
  action, resourceType = null, resourceId = null,
  resourceLabel = null, details = null, ipAddress = null
}) {
  await getPool().query(
    `INSERT INTO admin_audit_logs
      (admin_user_id, admin_display_name, admin_role, action,
       resource_type, resource_id, resource_label, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [adminUserId ?? null, adminDisplayName, adminRole, action, resourceType, resourceId ?? null, resourceLabel ?? null, details ?? null, ipAddress ?? null]
  );
}

export async function listAuditLogs({ page = 1, limit = 50, action, resourceType, search, dateFrom, dateTo } = {}) {
  const pool = getPool();
  const clampedLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const currentPage = Math.max(Number(page) || 1, 1);
  const offset = (currentPage - 1) * clampedLimit;

  const conditions = [];
  const params = [];

  if (action) {
    params.push(action);
    conditions.push(`action = $${params.length}`);
  }
  if (resourceType) {
    params.push(resourceType);
    conditions.push(`resource_type = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const ref = `$${params.length}`;
    conditions.push(`(admin_display_name ILIKE ${ref} OR resource_label ILIKE ${ref})`);
  }
  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`created_at::date >= $${params.length}::date`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`created_at::date <= $${params.length}::date`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const total = Number(
    (await pool.query(`SELECT COUNT(*) AS count FROM admin_audit_logs ${where}`, params)).rows[0].count
  );

  params.push(clampedLimit, offset);
  const items = (await pool.query(
    `
    SELECT id, admin_user_id AS "adminUserId", admin_display_name AS "adminDisplayName",
           admin_role AS "adminRole", action, resource_type AS "resourceType",
           resource_id AS "resourceId", resource_label AS "resourceLabel",
           details, ip_address AS "ipAddress", created_at AS "createdAt"
    FROM admin_audit_logs ${where}
    ORDER BY created_at DESC, id DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  )).rows;

  return { items, total, page: currentPage, limit: clampedLimit };
}

function validateJournal(input) {
  const data = {
    title: cleanRequiredText(input.title),
    abbreviation: cleanOptionalText(input.abbreviation),
    printIssn: normalizeIssn(input.printIssn),
    onlineIssn: normalizeIssn(input.onlineIssn),
    publisherName: cleanRequiredText(input.publisherName),
    placeOfPublication: cleanOptionalText(input.placeOfPublication),
    journalUrl: cleanOptionalText(input.journalUrl),
    subjectArea: cleanOptionalText(input.subjectArea),
    description: cleanOptionalLongText(input.description),
    defaultCoverImage: cleanOptionalText(input.defaultCoverImage)
  };
  const errors = {};

  if (!data.title) {
    errors.title = "Journal title is required.";
  } else if (data.title.length > 300) {
    errors.title = "Journal title must be 300 characters or fewer.";
  }

  if (!data.publisherName) {
    errors.publisherName = "Publisher name is required.";
  }

  if (data.subjectArea && !SUBJECT_AREAS.has(data.subjectArea)) {
    errors.subjectArea = "Invalid subject area.";
  }

  validateIssn(data.printIssn, "printIssn", errors);
  validateIssn(data.onlineIssn, "onlineIssn", errors);
  validateUrl(data.journalUrl, "journalUrl", errors);
  validateAssetPath(data.defaultCoverImage, "defaultCoverImage", errors, "image");

  throwIfValidation(errors);
  return data;
}

function validateAccount(input, { isCreate }) {
  const data = {
    username: normalizeLoginValue(input.username),
    email: normalizeLoginValue(input.email) || null,
    displayName: cleanRequiredText(input.displayName),
    role: cleanRequiredText(input.role) ?? "Member",
    accountStatus: cleanRequiredText(input.accountStatus) ?? "active",
    mustChangePassword: Boolean(input.mustChangePassword),
    password: String(input.password ?? "")
  };
  const errors = {};

  if (!data.username) {
    errors.username = "Username is required.";
  } else if (!/^[a-z0-9._-]{3,40}$/i.test(data.username)) {
    errors.username =
      "Username must be 3 to 40 characters and use letters, numbers, dots, underscores, or hyphens.";
  }

  if (data.email) {
    validateEmail(data.email, "email", errors);
  }

  if (!data.displayName) {
    errors.displayName = "Display name is required.";
  }

  if (!ACCOUNT_ROLES.has(data.role)) {
    errors.role = "Role is invalid.";
  }

  if (!ACCOUNT_STATUSES.has(data.accountStatus)) {
    errors.accountStatus = "Account status is invalid.";
  }

  if (isCreate || data.password) {
    if (!data.password) {
      errors.password = "Temporary password is required.";
    } else {
      Object.assign(errors, validatePasswordField(data.password, "password"));
    }
  }

  throwIfValidation(errors);
  return data;
}

function validateVolume(input) {
  const currentYear = new Date().getFullYear();
  const data = {
    journalId: parseRequiredId(input.journalId),
    volumeNumber: cleanRequiredText(input.volumeNumber),
    publicationYear: parseOptionalInteger(input.publicationYear),
    volumeTitle: cleanOptionalText(input.volumeTitle)
  };
  const errors = {};

  if (!data.journalId) {
    errors.journalId = "Journal is required.";
  }

  if (!data.volumeNumber) {
    errors.volumeNumber = "Volume number is required.";
  }

  if (!data.publicationYear) {
    errors.publicationYear = "Publication year is required.";
  } else if (data.publicationYear < 1800 || data.publicationYear > currentYear + 5) {
    errors.publicationYear = `Publication year must be between 1800 and ${currentYear + 5}.`;
  }

  throwIfValidation(errors);
  return data;
}

function validateIssue(input) {
  const data = {
    journalId: parseRequiredId(input.journalId),
    volumeId: parseRequiredId(input.volumeId),
    issueNumber: cleanRequiredText(input.issueNumber),
    issueTitle: cleanOptionalText(input.issueTitle),
    publicationMonth: parseOptionalInteger(input.publicationMonth),
    datePublished: cleanOptionalText(input.datePublished),
    issueCoverImage: cleanOptionalText(input.issueCoverImage),
    issueUrl: cleanOptionalText(input.issueUrl)
  };
  const errors = {};

  if (!data.journalId) {
    errors.journalId = "Journal is required.";
  }

  if (!data.volumeId) {
    errors.volumeId = "Volume is required.";
  }

  if (!data.issueNumber) {
    errors.issueNumber = "Issue number is required.";
  }

  if (
    data.publicationMonth !== null &&
    (data.publicationMonth < 1 || data.publicationMonth > 12)
  ) {
    errors.publicationMonth = "Publication month must be 1 to 12.";
  }

  validateDate(data.datePublished, "datePublished", errors);
  validateAssetPath(data.issueCoverImage, "issueCoverImage", errors, "image");
  validateUrl(data.issueUrl, "issueUrl", errors);

  throwIfValidation(errors);
  return data;
}

function validateArticle(input) {
  const data = {
    journalId: parseRequiredId(input.journalId),
    issueId: parseOptionalId(input.issueId),
    title: cleanRequiredText(input.title),
    doi: normalizeDoi(input.doi),
    abstract: cleanOptionalLongText(input.abstract),
    pageStart: cleanOptionalText(input.pageStart),
    pageEnd: cleanOptionalText(input.pageEnd),
    articleUrl: cleanOptionalText(input.articleUrl),
    pdfFilePath: cleanOptionalText(input.pdfFilePath),
    accessStatus: cleanOptionalText(input.accessStatus) ?? "Open Access",
    datePublished: cleanOptionalText(input.datePublished),
    authors: Array.isArray(input.authors) ? input.authors : [],
    keywords: Array.isArray(input.keywords) ? input.keywords : []
  };
  const errors = {};

  if (!data.journalId) {
    errors.journalId = "Journal is required.";
  }

  if (!data.title) {
    errors.title = "Article title is required.";
  } else if (data.title.length > 500) {
    errors.title = "Article title must be 500 characters or fewer.";
  }

  if (data.abstract && data.abstract.length > 5000) {
    errors.abstract = "Abstract must be 5000 characters or fewer.";
  }

  if (!data.authors.length) {
    errors.authors = "At least one author is required.";
  }

  validateDoi(data.doi, errors);
  validateDate(data.datePublished, "datePublished", errors);
  validateUrl(data.articleUrl, "articleUrl", errors);
  validateAssetPath(data.pdfFilePath, "pdfFilePath", errors, "pdf");
  validatePageRange(data.pageStart, data.pageEnd, errors);

  if (!ARTICLE_ACCESS_STATUSES.has(data.accessStatus)) {
    errors.accessStatus = "Access status is invalid.";
  }

  data.authors = data.authors.map((author, index) =>
    validateArticleAuthor(author, index, errors)
  );
  data.keywords = normalizeArticleKeywords(data.keywords, errors);

  throwIfValidation(errors);
  return data;
}

function validateAuthor(input) {
  const firstName = cleanRequiredText(input.firstName);
  const middleName = cleanOptionalText(input.middleName);
  const lastName = cleanRequiredText(input.lastName);
  const suffix = cleanOptionalText(input.suffix);
  const data = {
    firstName,
    middleName,
    lastName,
    suffix,
    displayName:
      cleanOptionalText(input.displayName) ??
      [firstName, middleName, lastName, suffix].filter(Boolean).join(" "),
    affiliation: cleanOptionalText(input.affiliation),
    orcid: normalizeOrcid(input.orcid)
  };
  const errors = {};

  if (!data.firstName) {
    errors.firstName = "First name is required.";
  } else if (data.firstName.length > 100) {
    errors.firstName = "First name must be 100 characters or fewer.";
  }

  if (!data.lastName) {
    errors.lastName = "Last name is required.";
  } else if (data.lastName.length > 100) {
    errors.lastName = "Last name must be 100 characters or fewer.";
  }

  if (!data.displayName) {
    errors.displayName = "Display name is required.";
  } else if (data.displayName.length > 150) {
    errors.displayName = "Display name must be 150 characters or fewer.";
  }

  validateOrcid(data.orcid, errors);
  throwIfValidation(errors);
  return data;
}

function validateKeyword(input) {
  const data = {
    name: normalizeKeyword(input.name)
  };
  const errors = {};

  validateKeywordName(data.name, "name", errors);
  throwIfValidation(errors);
  return data;
}

function validateAnnouncement(input) {
  const data = {
    label: cleanRequiredText(input.label),
    title: cleanRequiredText(input.title),
    summary: cleanOptionalLongText(input.summary),
    href: cleanOptionalText(input.href),
    linkLabel: cleanOptionalText(input.linkLabel),
    publishDate: cleanOptionalText(input.publishDate),
    status: cleanOptionalText(input.status) ?? "Draft",
    sortOrder: parseOptionalInteger(input.sortOrder) ?? 0,
    image: cleanOptionalText(input.image)
  };
  const errors = {};

  if (!data.label) {
    errors.label = "Announcement label is required.";
  } else if (!ANNOUNCEMENT_LABELS.has(data.label)) {
    errors.label = "Announcement label is invalid.";
  }

  if (!data.title) {
    errors.title = "Announcement title is required.";
  } else if (data.title.length > 180) {
    errors.title = "Announcement title must be 180 characters or fewer.";
  }

  if (!data.summary) {
    errors.summary = "Announcement summary is required.";
  } else if (data.summary.length > 500) {
    errors.summary = "Announcement summary must be 500 characters or fewer.";
  }

  if (!data.publishDate) {
    errors.publishDate = "Publish date is required.";
  } else {
    validateDate(data.publishDate, "publishDate", errors);
  }

  if (!ANNOUNCEMENT_STATUSES.has(data.status)) {
    errors.status = "Announcement status is invalid.";
  }

  if (data.sortOrder < 0) {
    errors.sortOrder = "Sort order cannot be negative.";
  }

  validateAnnouncementHref(data.href, errors);

  if (data.href && !data.linkLabel) {
    errors.linkLabel = "Link label is required when a link is provided.";
  }

  if (!data.href) {
    data.linkLabel = null;
  }

  if (data.image) {
    validateAssetPath(data.image, "image", errors, "image");
  }

  throwIfValidation(errors);
  return data;
}

function validateArticleAuthor(author, index, errors) {
  const prefix = `authors.${index}`;
  const authorId = parseOptionalId(author.id);

  if (authorId) {
    return {
      id: authorId,
      isCorresponding: Boolean(author.isCorresponding)
    };
  }

  return {
    ...validateAuthorWithoutThrow(author, prefix, errors),
    isCorresponding: Boolean(author.isCorresponding)
  };
}

function validateAuthorWithoutThrow(input, prefix, errors) {
  const firstName = cleanRequiredText(input.firstName);
  const middleName = cleanOptionalText(input.middleName);
  const lastName = cleanRequiredText(input.lastName);
  const suffix = cleanOptionalText(input.suffix);
  const data = {
    firstName,
    middleName,
    lastName,
    suffix,
    displayName:
      cleanOptionalText(input.displayName) ??
      [firstName, middleName, lastName, suffix].filter(Boolean).join(" "),
    affiliation: cleanOptionalText(input.affiliation),
    orcid: normalizeOrcid(input.orcid)
  };

  if (!data.firstName) {
    errors[`${prefix}.firstName`] = "First name is required.";
  }

  if (!data.lastName) {
    errors[`${prefix}.lastName`] = "Last name is required.";
  }

  if (!data.displayName) {
    errors[`${prefix}.displayName`] = "Display name is required.";
  }

  if (data.orcid && !isValidOrcidUrl(data.orcid)) {
    errors[`${prefix}.orcid`] = "ORCID format is invalid.";
  }

  return data;
}

function normalizeArticleKeywords(keywords, errors) {
  const seen = new Set();
  const normalized = [];

  keywords.forEach((keyword, index) => {
    if (keyword.id) {
      const id = parseOptionalId(keyword.id);
      if (!id) {
        errors[`keywords.${index}.id`] = "Keyword id is invalid.";
        return;
      }

      const key = `id:${id}`;
      if (!seen.has(key)) {
        seen.add(key);
        normalized.push({ id });
      }
      return;
    }

    const name = normalizeKeyword(keyword.name ?? keyword);
    validateKeywordName(name, `keywords.${index}.name`, errors);
    const key = `name:${name}`;
    if (name && !seen.has(key)) {
      seen.add(key);
      normalized.push({ name });
    }
  });

  return normalized;
}

async function saveArticleAuthors(db, articleId, authors) {
  const linkedAuthorIds = new Set();

  for (const [index, author] of authors.entries()) {
    const authorId = await resolveAuthor(db, author);
    if (linkedAuthorIds.has(authorId)) {
      continue;
    }
    linkedAuthorIds.add(authorId);
    await db.query(
      `
      INSERT INTO article_authors (
        article_id,
        author_id,
        author_order,
        is_corresponding
      )
      VALUES ($1, $2, $3, $4)
      `,
      [articleId, authorId, index + 1, author.isCorresponding]
    );
  }
}

async function saveArticleKeywords(db, articleId, keywords) {
  for (const keyword of keywords) {
    const keywordId = await resolveKeyword(db, keyword);
    await db.query(
      "INSERT INTO article_keywords (article_id, keyword_id) VALUES ($1, $2)",
      [articleId, keywordId]
    );
  }
}

async function resolveAuthor(db, author) {
  if (author.id) {
    const existing = (await db.query("SELECT id FROM authors WHERE id = $1", [author.id])).rows[0];

    if (!existing) {
      throw validationError({ authors: "Selected author does not exist." });
    }

    return author.id;
  }

  const reusableAuthor = await findReusableAuthor(db, author);

  if (reusableAuthor) {
    return Number(reusableAuthor.id);
  }

  const result = await db.query(
    `
    INSERT INTO authors (
      display_name,
      first_name,
      middle_name,
      last_name,
      suffix,
      affiliation,
      orcid
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
    `,
    [
      author.displayName,
      author.firstName,
      author.middleName,
      author.lastName,
      author.suffix,
      author.affiliation,
      author.orcid
    ]
  );

  return Number(result.rows[0].id);
}

async function findReusableAuthor(db, author, currentId = null) {
  if (author.orcid) {
    const existingByOrcid = (await db.query(
      `
      SELECT id, display_name AS "displayName", affiliation, orcid
      FROM authors
      WHERE orcid = $1
        AND ($2::bigint IS NULL OR id != $2)
      LIMIT 1
      `,
      [author.orcid, currentId]
    )).rows[0];

    if (existingByOrcid) {
      return existingByOrcid;
    }
  }

  if (!author.firstName || !author.lastName || !author.affiliation) {
    return null;
  }

  return (await db.query(
    `
    SELECT id, display_name AS "displayName", affiliation, orcid
    FROM authors
    WHERE lower(first_name) = lower($1)
      AND lower(last_name) = lower($2)
      AND lower(COALESCE(affiliation, '')) = lower($3)
      AND ($4::bigint IS NULL OR id != $4)
    LIMIT 1
    `,
    [author.firstName, author.lastName, author.affiliation, currentId]
  )).rows[0] ?? null;
}

async function resolveKeyword(db, keyword) {
  if (keyword.id) {
    const existing = (await db.query("SELECT id FROM keywords WHERE id = $1", [keyword.id])).rows[0];

    if (!existing) {
      throw validationError({ keywords: "Selected keyword does not exist." });
    }

    return keyword.id;
  }

  // keywords.name is CITEXT — case-insensitive by default
  const existingByName = (await db.query("SELECT id FROM keywords WHERE name = $1", [keyword.name])).rows[0];

  if (existingByName) {
    return Number(existingByName.id);
  }

  const result = await db.query("INSERT INTO keywords (name) VALUES ($1) RETURNING id", [keyword.name]);
  return Number(result.rows[0].id);
}

async function ensureJournalExists(db, id) {
  const row = (await db.query("SELECT id FROM journals WHERE id = $1", [id])).rows[0];
  if (!row) {
    throw validationError({ journalId: "Selected journal does not exist." });
  }
}

async function ensureIssueBelongsToJournal(db, issueId, journalId) {
  const issue = (await db.query(
    `
    SELECT id
    FROM journal_issues
    WHERE id = $1
      AND journal_id = $2
    `,
    [issueId, journalId]
  )).rows[0];

  if (!issue) {
    throw validationError({
      issueId: "Selected issue does not belong to the selected journal."
    });
  }
}

async function ensureVolumeExists(db, id) {
  const row = (await db.query("SELECT id FROM journal_volumes WHERE id = $1", [id])).rows[0];
  if (!row) {
    throw validationError({ volumeId: "Selected volume does not exist." });
  }
}

async function ensureVolumeBelongsToJournal(db, volumeId, journalId) {
  const volume = (await db.query(
    `
    SELECT id
    FROM journal_volumes
    WHERE id = $1
      AND journal_id = $2
    `,
    [volumeId, journalId]
  )).rows[0];

  if (!volume) {
    throw validationError({
      volumeId: "Selected volume does not belong to the selected journal."
    });
  }
}

async function ensureUniqueVolume(db, data, currentId = null) {
  const row = (await db.query(
    `
    SELECT id
    FROM journal_volumes
    WHERE journal_id = $1
      AND volume_number = $2
      AND ($3::bigint IS NULL OR id != $3)
    LIMIT 1
    `,
    [data.journalId, data.volumeNumber, currentId]
  )).rows[0];

  if (row) {
    throw validationError({
      volumeNumber: "A volume with the same number already exists for this journal."
    });
  }
}

async function ensureUniqueIssue(db, data, currentId = null) {
  const row = (await db.query(
    `
    SELECT id
    FROM journal_issues
    WHERE volume_id = $1
      AND issue_number = $2
      AND ($3::bigint IS NULL OR id != $3)
    LIMIT 1
    `,
    [data.volumeId, data.issueNumber, currentId]
  )).rows[0];

  if (row) {
    throw validationError({
      issueNumber: "An issue with the same number already exists in this volume."
    });
  }
}

async function ensureUniqueValue({ db, table, column, value, field, message, currentId = null }) {
  if (!value) {
    return;
  }

  const result = await db.query(
    `SELECT id FROM ${table} WHERE ${column} = $1 AND ($2::bigint IS NULL OR id != $2) LIMIT 1`,
    [value, currentId]
  );

  if (result.rows[0]) {
    throw validationError({ [field]: message });
  }
}

async function ensureUniqueAnnouncement(db, data, currentId = null) {
  const row = (await db.query(
    `
    SELECT id
    FROM announcements
    WHERE lower(title) = lower($1)
      AND publish_date = $2
      AND ($3::bigint IS NULL OR id != $3)
    LIMIT 1
    `,
    [data.title, data.publishDate, currentId]
  )).rows[0];

  if (row) {
    throw validationError({
      title: "An announcement with the same title and publish date already exists."
    });
  }
}

async function getJournalWarnings(db, data, currentId = null) {
  const warnings = [];

  const titleMatch = (await db.query(
    `
    SELECT id
    FROM journals
    WHERE lower(title) = lower($1)
      AND ($2::bigint IS NULL OR id != $2)
    LIMIT 1
    `,
    [data.title, currentId]
  )).rows[0];

  if (titleMatch) {
    warnings.push("A journal with this exact title already exists.");
  }

  const publisherMatch = (await db.query(
    `
    SELECT id
    FROM journals
    WHERE lower(title) = lower($1)
      AND lower(publisher_name) = lower($2)
      AND ($3::bigint IS NULL OR id != $3)
    LIMIT 1
    `,
    [data.title, data.publisherName, currentId]
  )).rows[0];

  if (publisherMatch) {
    warnings.push("A journal with this title and publisher already exists.");
  }

  return warnings;
}

async function getAnnouncementWarnings(db, data, currentId = null) {
  const warnings = [];

  const sameTitle = (await db.query(
    `
    SELECT id
    FROM announcements
    WHERE lower(title) = lower($1)
      AND ($2::bigint IS NULL OR id != $2)
    LIMIT 1
    `,
    [data.title, currentId]
  )).rows[0];

  if (sameTitle) {
    warnings.push(
      "An announcement with this title already exists. Check whether this should update the existing announcement instead."
    );
  }

  if (data.status === "Published" && data.publishDate > new Date().toISOString().slice(0, 10)) {
    warnings.push(
      "This announcement is marked Published but has a future publish date, so it will not appear on the homepage yet."
    );
  }

  return warnings;
}

function getAccountWarnings(data) {
  const warnings = [];

  if (data.role === "Member") {
    warnings.push("Member accounts can download permitted files but cannot access the admin dashboard.");
  }

  if (data.accountStatus === "disabled") {
    warnings.push("Disabled accounts cannot sign in or download restricted files.");
  }

  return warnings;
}

async function ensureAccountUpdateSafe(db, id, data, currentAdmin) {
  if (Number(id) === Number(currentAdmin?.id)) {
    if (data.role !== "Super Admin") {
      throw validationError({
        role: "You cannot remove the Super Admin role from your own account."
      });
    }

    if (data.accountStatus !== "active") {
      throw validationError({
        accountStatus: "You cannot disable the account you are currently using."
      });
    }
  }

  if (data.role !== "Super Admin" || data.accountStatus !== "active") {
    await ensureAnotherActiveSuperAdmin(db, id);
  }
}

async function ensureVolumeMoveSafe(db, id, existing, data) {
  if (Number(existing.journalId) === Number(data.journalId)) {
    return;
  }

  const dependencies = {
    issues: await countRows(db, "journal_issues", "volume_id", id)
  };

  if (!dependencies.issues) {
    return;
  }

  const linkedIssues = (await db.query(
    `
    SELECT
      ji.id,
      j.title || ' Vol. ' || jv.volume_number || ', No. ' || ji.issue_number AS label
    FROM journal_issues ji
    JOIN journals j ON j.id = ji.journal_id
    JOIN journal_volumes jv ON jv.id = ji.volume_id
    WHERE ji.volume_id = $1
    ORDER BY ji.issue_number ASC, ji.id ASC
    LIMIT 5
    `,
    [id]
  )).rows;

  throw dependencyError(
    "This volume cannot be moved to another journal while issues are linked to it.",
    dependencies,
    { issues: linkedIssues },
    [
      "Create or select a volume under the target journal instead.",
      "Move or remove linked issues before changing the volume journal."
    ]
  );
}

async function ensureIssueMoveSafe(db, id, existing, data) {
  if (Number(existing.journalId) === Number(data.journalId)) {
    return;
  }

  const dependencies = {
    articles: await countRows(db, "articles", "issue_id", id)
  };

  if (!dependencies.articles) {
    return;
  }

  throw dependencyError(
    "This issue cannot be moved to another journal while articles are linked to it.",
    dependencies,
    await getIssueDeleteLinks(db, id),
    [
      "Move linked articles to a compatible issue first.",
      "Use an issue under the same journal when correcting volume or issue metadata."
    ]
  );
}

async function ensureAnotherActiveSuperAdmin(db, currentId) {
  const row = (await db.query(
    `
    SELECT COUNT(*) AS count
    FROM admin_users
    WHERE role = 'Super Admin'
      AND account_status = 'active'
      AND is_active = true
      AND id != $1
    `,
    [currentId]
  )).rows[0];

  if (Number(row.count) < 1) {
    throw validationError({
      role: "At least one other active Super Admin account is required."
    });
  }
}

async function getVolumeWarnings(db, data, currentId = null) {
  const warnings = [];

  if (!currentId) {
    return warnings;
  }

  const linkedIssueCount = await countRows(db, "journal_issues", "volume_id", currentId);
  if (linkedIssueCount) {
    warnings.push(
      "Changing this volume number or publication year updates labels and citation years for linked issues and articles."
    );
  }

  const mismatchedIssueDates = Number((await db.query(
    `
    SELECT COUNT(*) AS count
    FROM journal_issues
    WHERE volume_id = $1
      AND date_published IS NOT NULL
      AND LEFT(date_published, 4) != $2
    `,
    [currentId, String(data.publicationYear)]
  )).rows[0].count);

  if (mismatchedIssueDates > 0) {
    warnings.push(
      `${mismatchedIssueDates} linked issue date(s) use a different calendar year than this volume publication year.`
    );
  }

  return warnings;
}

async function getIssueWarnings(db, data, currentId = null) {
  const warnings = [];

  const volume = (await db.query(
    "SELECT publication_year AS \"publicationYear\" FROM journal_volumes WHERE id = $1",
    [data.volumeId]
  )).rows[0];

  if (
    data.datePublished &&
    volume?.publicationYear &&
    data.datePublished.slice(0, 4) !== String(volume.publicationYear)
  ) {
    warnings.push(
      "The issue date year is different from the selected volume publication year. Public catalog year comes from the volume."
    );
  }

  if (currentId) {
    const linkedArticleCount = await countRows(db, "articles", "issue_id", currentId);
    if (linkedArticleCount) {
      warnings.push(
        "Changing issue month, date, volume, or access status can affect linked article labels and public access context."
      );
    }
  }

  return warnings;
}

async function getArticleWarnings(db, data, currentId = null) {
  const warnings = [];

  const sameTitleJournal = (await db.query(
    `
    SELECT id
    FROM articles
    WHERE lower(title) = lower($1)
      AND journal_id = $2
      AND ($3::bigint IS NULL OR id != $3)
    LIMIT 1
    `,
    [data.title, data.journalId, currentId]
  )).rows[0];

  if (sameTitleJournal) {
    warnings.push("An article with the same title already exists in this journal.");
  }

  const publicationYear = await getArticleInputYear(db, data);

  if (publicationYear) {
    const sameTitleJournalYear = (await db.query(
      `
      SELECT a.id
      FROM articles a
      LEFT JOIN journal_issues ji ON ji.id = a.issue_id
      LEFT JOIN journal_volumes jv ON jv.id = ji.volume_id
      WHERE lower(a.title) = lower($1)
        AND a.journal_id = $2
        AND COALESCE(
          jv.publication_year,
          LEFT(a.date_published, 4)::integer
        ) = $3
        AND ($4::bigint IS NULL OR a.id != $4)
      LIMIT 1
      `,
      [data.title, data.journalId, publicationYear, currentId]
    )).rows[0];

    if (sameTitleJournalYear) {
      warnings.push(
        "An article with the same title, journal, and publication year already exists."
      );
    }
  }

  if (
    data.issueId &&
    data.datePublished &&
    publicationYear &&
    data.datePublished.slice(0, 4) !== String(publicationYear)
  ) {
    warnings.push(
      "This article date year differs from the selected issue/volume publication year. Catalog year and APA citation year come from the issue volume."
    );
  }

  return warnings;
}

async function getAuthorWarnings(db, data, currentId = null) {
  const warnings = [];
  const exactReusable = await findReusableAuthor(db, data, currentId);

  if (exactReusable) {
    warnings.push(
      `Possible duplicate author: ${exactReusable.displayName} already has the same identifying details. Use the existing author unless this is a different person.`
    );
  }

  const sameName = (await db.query(
    `
    SELECT id, display_name AS "displayName"
    FROM authors
    WHERE lower(first_name) = lower($1)
      AND lower(last_name) = lower($2)
      AND ($3::bigint IS NULL OR id != $3)
      AND ($4::bigint IS NULL OR id != $4)
    LIMIT 1
    `,
    [
      data.firstName,
      data.lastName,
      currentId,
      exactReusable?.id ?? null
    ]
  )).rows[0];

  if (sameName) {
    warnings.push(
      `An author named ${sameName.displayName} already exists. Add ORCID or affiliation when possible before creating a separate author record.`
    );
  }

  return warnings;
}

async function getArticleInputYear(db, data) {
  if (data.issueId) {
    const issue = (await db.query(
      `
      SELECT jv.publication_year AS "publicationYear"
      FROM journal_issues ji
      JOIN journal_volumes jv ON jv.id = ji.volume_id
      WHERE ji.id = $1
      `,
      [data.issueId]
    )).rows[0];
    return issue?.publicationYear ?? null;
  }

  if (data.datePublished) {
    return Number.parseInt(data.datePublished.slice(0, 4), 10);
  }

  return null;
}

async function getArticleAuthors(db, articleId) {
  return (await db.query(
    `
    SELECT
      au.id,
      au.display_name AS "displayName",
      au.first_name AS "firstName",
      au.middle_name AS "middleName",
      au.last_name AS "lastName",
      au.suffix,
      au.affiliation,
      au.orcid,
      aa.author_order AS "authorOrder",
      aa.is_corresponding AS "isCorresponding"
    FROM article_authors aa
    JOIN authors au ON au.id = aa.author_id
    WHERE aa.article_id = $1
    ORDER BY aa.author_order ASC
    `,
    [articleId]
  )).rows.map((author) => ({
    ...author,
    isCorresponding: Boolean(author.isCorresponding)
  }));
}

async function getArticleKeywords(db, articleId) {
  return (await db.query(
    `
    SELECT k.id, k.name
    FROM article_keywords ak
    JOIN keywords k ON k.id = ak.keyword_id
    WHERE ak.article_id = $1
    ORDER BY k.name ASC
    `,
    [articleId]
  )).rows;
}

function validateIssn(value, field, errors) {
  if (value && !/^\d{4}-\d{3}[\dX]$/i.test(value)) {
    errors[field] = "ISSN must use a format like 1234-567X.";
  }
}

function validateDoi(value, errors) {
  if (value && !/^10\.\S+\/\S+$/.test(value)) {
    errors.doi = "DOI format is invalid.";
  }
}

function validateOrcid(value, errors) {
  if (value && !isValidOrcidUrl(value)) {
    errors.orcid = "ORCID format is invalid.";
  }
}

function validateKeywordName(value, field, errors) {
  if (!value) {
    errors[field] = "Keyword is required.";
    return;
  }

  if (value.length > 100) {
    errors[field] = "Keyword must be 100 characters or fewer.";
  }

  if (!/[A-Za-z0-9]/.test(value)) {
    errors[field] = "Keyword must contain letters or numbers.";
  }
}

function validateUrl(value, field, errors) {
  if (!value) {
    return;
  }

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      errors[field] = "URL must start with http:// or https://.";
    }
  } catch {
    errors[field] = "URL is invalid.";
  }
}

function validateEmail(value, field, errors) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    errors[field] = "Email address is invalid.";
  }
}

function validatePasswordField(password, field) {
  const message = validatePassword(password);
  return message ? { [field]: message } : {};
}

function validateAnnouncementHref(value, errors) {
  if (!value) {
    return;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    validateUrl(value, "href", errors);
    return;
  }

  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("..") ||
    /\s/.test(value)
  ) {
    errors.href = "Use an internal path starting with / or a valid http/https URL.";
  }
}

function validateAssetPath(value, field, errors, kind) {
  if (!value) {
    return;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    validateUrl(value, field, errors);
    return;
  }

  if (!value.startsWith("/uploads/") || value.includes("..")) {
    errors[field] = "Use a valid URL or managed /uploads/ path.";
    return;
  }

  if (kind === "pdf" && !value.toLowerCase().endsWith(".pdf")) {
    errors[field] = "PDF path must end with .pdf.";
  }

  if (kind === "image" && !/\.(jpg|jpeg|png|webp|gif)$/i.test(value)) {
    errors[field] = "Image path must end with jpg, png, webp, or gif.";
  }
}

function validateDate(value, field, errors) {
  if (!value) {
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    errors[field] = "Date must use YYYY-MM-DD.";
    return;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    errors[field] = "Date is invalid.";
  }
}

function validatePageRange(pageStart, pageEnd, errors) {
  if (!pageStart || !pageEnd) {
    return;
  }

  if (/^\d+$/.test(pageStart) && /^\d+$/.test(pageEnd)) {
    const start = Number.parseInt(pageStart, 10);
    const end = Number.parseInt(pageEnd, 10);

    if (end < start) {
      errors.pageEnd = "Page end must be greater than or equal to page start.";
    }
  }
}

function cleanRequiredText(value) {
  return cleanOptionalText(value);
}

function cleanOptionalText(value) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return text || null;
}

function cleanOptionalLongText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeSearch(value) {
  return String(value ?? "").trim();
}

function normalizeIssn(value) {
  return cleanOptionalText(value)?.toUpperCase() ?? null;
}

function normalizeDoi(value) {
  return cleanOptionalText(value);
}

function normalizeKeyword(value) {
  return cleanOptionalText(value)?.toLowerCase() ?? null;
}

function normalizeOrcid(value) {
  const text = cleanOptionalText(value);

  if (!text) {
    return null;
  }

  if (text.startsWith("https://orcid.org/")) {
    return text;
  }

  return `https://orcid.org/${text}`;
}

function normalizeLoginValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isValidOrcidUrl(value) {
  return /^https:\/\/orcid\.org\/\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(value);
}

function parseRequiredId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalId(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return parseRequiredId(value);
}

function parseOptionalInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizePaging(params) {
  const page = parsePositiveNumber(params.page, 1);
  const pageSize = PAGE_SIZES.has(Number(params.pageSize))
    ? Number(params.pageSize)
    : 10;

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize
  };
}

function parsePositiveNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function paged(items, total, paging) {
  return {
    items,
    total,
    page: paging.page,
    pageSize: paging.pageSize,
    totalPages: Math.max(1, Math.ceil(total / paging.pageSize))
  };
}

async function countRows(db, table, column, value) {
  return Number(
    (await db.query(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} = $1`, [value])).rows[0].count
  );
}

async function getJournalDeleteLinks(db, journalId) {
  return {
    issues: (await db.query(
      `
      SELECT
        ji.id,
        j.title || ' Vol. ' || jv.volume_number || ', No. ' || ji.issue_number AS label
      FROM journal_issues ji
      JOIN journals j ON j.id = ji.journal_id
      JOIN journal_volumes jv ON jv.id = ji.volume_id
      WHERE ji.journal_id = $1
      ORDER BY jv.publication_year DESC, ji.publication_month DESC, ji.id DESC
      LIMIT 5
      `,
      [journalId]
    )).rows,
    articles: await getLinkedArticles(db, "a.journal_id = $1", [journalId])
  };
}

async function getIssueDeleteLinks(db, issueId) {
  return {
    articles: await getLinkedArticles(db, "a.issue_id = $1", [issueId])
  };
}

async function getAuthorDeleteLinks(db, authorId) {
  return {
    articles: await getLinkedArticles(
      db,
      `EXISTS (
        SELECT 1
        FROM article_authors aa
        WHERE aa.article_id = a.id
          AND aa.author_id = $1
      )`,
      [authorId]
    )
  };
}

async function getKeywordDeleteLinks(db, keywordId) {
  return {
    articles: await getLinkedArticles(
      db,
      `EXISTS (
        SELECT 1
        FROM article_keywords ak
        WHERE ak.article_id = a.id
          AND ak.keyword_id = $1
      )`,
      [keywordId]
    )
  };
}

async function getLinkedArticles(db, where, params) {
  return (await db.query(
    `
    SELECT
      a.id,
      a.title AS label
    FROM articles a
    WHERE ${where}
    ORDER BY a.updated_at DESC, a.id DESC
    LIMIT 5
    `,
    params
  )).rows;
}

function splitList(value) {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function formatAccountFlags(account) {
  return {
    ...account,
    mustChangePassword: Boolean(account.mustChangePassword)
  };
}

async function shiftAnnouncementSortOrder(db, sortOrder, excludeId = null) {
  let conflict;
  if (excludeId) {
    conflict = (await db.query(
      "SELECT 1 FROM announcements WHERE sort_order = $1 AND id != $2",
      [sortOrder, excludeId]
    )).rows[0];
  } else {
    conflict = (await db.query(
      "SELECT 1 FROM announcements WHERE sort_order = $1",
      [sortOrder]
    )).rows[0];
  }

  if (!conflict) return;

  if (excludeId) {
    await db.query(
      "UPDATE announcements SET sort_order = sort_order + 1 WHERE sort_order >= $1 AND id != $2",
      [sortOrder, excludeId]
    );
  } else {
    await db.query(
      "UPDATE announcements SET sort_order = sort_order + 1 WHERE sort_order >= $1",
      [sortOrder]
    );
  }
}

function throwIfValidation(fieldErrors) {
  if (Object.keys(fieldErrors).length) {
    throw validationError(fieldErrors);
  }
}

function validationError(fieldErrors) {
  return new AdminRepositoryError(
    400,
    "Validation failed.",
    "VALIDATION_ERROR",
    fieldErrors
  );
}

function dependencyError(message, dependencies, linkedRecords = {}, guidance = []) {
  return new AdminRepositoryError(
    409,
    message,
    "DEPENDENCY_EXISTS",
    {},
    { dependencies, linkedRecords, guidance }
  );
}

function notFound(message) {
  return new AdminRepositoryError(404, message, "NOT_FOUND");
}
