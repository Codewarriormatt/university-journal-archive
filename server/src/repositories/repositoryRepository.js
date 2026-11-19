import { getPool } from "../db/database.js";
import { embedText, cosineSimilarity } from "../services/articleEmbeddingService.js";
import { config } from "../config/env.js";

const VALID_RECORD_TYPES = new Set(["all", "article", "journal", "issue"]);
const VALID_SEARCH_FIELDS = new Set([
  "all",
  "title",
  "author",
  "doi",
  "issn",
  "subject",
  "keyword",
  "publisher",
  "publication_year",
  "volume",
  "issue_number",
  "semantic"
]);
const MAX_RECORDS_PER_TYPE = 1000;
const VALID_PAGE_SIZES = new Set([10, 25, 50]);

export async function listRecords({
  search = "",
  type = "all",
  field = "all",
  subject = "all",
  publisher = "all",
  journal = "all",
  year = "all",
  yearFrom = "",
  yearTo = "",
  sort = "",
  limit = 50
} = {}) {
  const safeLimit = normalizeLimit(limit);
  const { records, semanticSearchUsed, semanticUnavailable } = await getMatchingRecords({
    search, type, field, subject, publisher, journal, year, yearFrom, yearTo, sort
  });
  return { records: records.slice(0, safeLimit), semanticSearchUsed, semanticUnavailable };
}

export async function recordSearchLog(params, resultCount) {
  const searchTerm = String(params.search ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
  if (!searchTerm || searchTerm.length < 2) return;
  await getPool().query(
    `INSERT INTO search_logs (search_term, record_type, search_field, result_count)
     VALUES ($1, $2, $3, $4)`,
    [
      searchTerm.toLowerCase(),
      String(params.type ?? "all"),
      String(params.field ?? "all"),
      Number(resultCount) || 0
    ]
  );
}

export async function listRecordPage({
  search = "",
  type = "all",
  field = "all",
  subject = "all",
  publisher = "all",
  journal = "all",
  year = "all",
  yearFrom = "",
  yearTo = "",
  sort = "",
  page = 1,
  pageSize = 10
} = {}) {
  const { records, semanticSearchUsed, semanticUnavailable } = await getMatchingRecords({
    search, type, field, subject, publisher, journal, year, yearFrom, yearTo, sort
  });
  const safePageSize = normalizePageSize(pageSize);
  const total = records.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(normalizePage(page), totalPages);
  const startIndex = (safePage - 1) * safePageSize;

  return {
    items: records.slice(startIndex, startIndex + safePageSize),
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    semanticSearch: semanticSearchUsed,
    semanticUnavailable: semanticUnavailable ?? false
  };
}

export async function getHomepageHighlights() {
  const [
    announcements,
    latestJournals, latestArticles,
    mostViewedJournals, mostCitedJournals, popularJournals,
    mostViewedArticles, mostCitedArticles, mostDownloadedArticles, popularArticles,
    mostSearchedTopics, popularTopics
  ] = await Promise.all([
    getAnnouncements(),
    listHomepageJournals("latest"),
    listHomepageArticles("latest"),
    listHomepageJournals("mostViewed"),
    listHomepageJournals("mostCited"),
    listHomepageJournals("popular"),
    listHomepageArticles("mostViewed"),
    listHomepageArticles("mostCited"),
    listHomepageArticles("mostDownloaded"),
    listHomepageArticles("popular"),
    listHomepageTopics("searched"),
    listHomepageTopics("popular")
  ]);

  return {
    announcements,
    latestJournals,
    latestArticles,
    journalRankings: { mostViewed: mostViewedJournals, mostCited: mostCitedJournals, popular: popularJournals },
    articleRankings: { mostViewed: mostViewedArticles, mostCited: mostCitedArticles, mostDownloaded: mostDownloadedArticles, popular: popularArticles },
    topics: { mostSearched: mostSearchedTopics, popular: popularTopics }
  };
}

async function getMatchingRecords({
  search = "",
  type = "all",
  field = "all",
  subject = "all",
  publisher = "all",
  journal = "all",
  year = "all",
  yearFrom = "",
  yearTo = "",
  sort = ""
} = {}) {
  const cleanSearch = search.trim();
  const recordType = VALID_RECORD_TYPES.has(type) ? type : "all";
  const searchField = normalizeSearchField(recordType, field);
  const filters = normalizeFilters({ subject, publisher, journal, year, yearFrom, yearTo });
  const sortKey = normalizeSort(recordType, sort);

  const needsArticles = recordType === "all" || recordType === "article";
  const needsIssues = recordType === "all" || recordType === "issue";
  const needsJournals = recordType === "all" || recordType === "journal";

  const isSemanticRequest = searchField === "semantic";
  const keywordField = isSemanticRequest ? "all" : searchField;
  const useSemanticSearch =
    needsArticles && cleanSearch && config.openaiApiKey &&
    (searchField === "all" || isSemanticRequest);

  let semanticUnavailable = isSemanticRequest && (!config.openaiApiKey || !cleanSearch);

  const [keywordArticles, issueRecords, journalRecords, queryEmbedding] = await Promise.all([
    needsArticles ? listArticleRecords(cleanSearch, keywordField, MAX_RECORDS_PER_TYPE) : [],
    needsIssues ? listIssueRecords(cleanSearch, keywordField, MAX_RECORDS_PER_TYPE) : [],
    needsJournals ? listJournalRecords(cleanSearch, keywordField, MAX_RECORDS_PER_TYPE) : [],
    useSemanticSearch ? embedText(cleanSearch).catch(() => null) : null
  ]);

  let articleRecords = keywordArticles;
  let semanticSearchUsed = false;

  if (queryEmbedding) {
    articleRecords = await mergeSemanticArticleResults(keywordArticles, queryEmbedding);
    semanticSearchUsed = true;
  } else if (isSemanticRequest && config.openaiApiKey && cleanSearch) {
    // Had a key and tried, but the embedding call failed (quota/rate limit)
    semanticUnavailable = true;
  }

  const allRecords = [...articleRecords, ...issueRecords, ...journalRecords]
    .filter((record) => recordMatchesFilters(record, filters));

  if (semanticSearchUsed) {
    allRecords.sort((a, b) => {
      if (a.recordType === "article" && b.recordType === "article") {
        return (b._semanticScore ?? 0) - (a._semanticScore ?? 0);
      }
      return sortRecords(a, b, sortKey);
    });
  } else {
    allRecords.sort((a, b) => sortRecords(a, b, sortKey));
  }

  return { records: allRecords, semanticSearchUsed, semanticUnavailable };
}

async function mergeSemanticArticleResults(keywordArticles, queryEmbedding) {
  const pool = getPool();
  const result = await pool.query(
    "SELECT id, embedding FROM articles WHERE embedding IS NOT NULL"
  );

  if (result.rows.length === 0) return keywordArticles;

  const ranked = result.rows
    .map((row) => {
      const embedding = Array.isArray(row.embedding) ? row.embedding.map(Number) : null;
      return { id: row.id, score: cosineSimilarity(queryEmbedding, embedding) };
    })
    .filter((r) => r.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 80);

  if (ranked.length === 0) return keywordArticles;

  const semanticIds = new Set(ranked.map((r) => r.id));
  const keywordIdSet = new Set(keywordArticles.map((a) => a.id));

  const missingIds = ranked.filter((r) => !keywordIdSet.has(r.id)).map((r) => r.id);
  const semanticOnlyArticles = missingIds.length > 0
    ? await fetchArticlesByIds(missingIds)
    : [];

  const articleMap = new Map([
    ...keywordArticles.map((a) => [a.id, a]),
    ...semanticOnlyArticles.map((a) => [a.id, a])
  ]);

  const merged = [];
  for (const { id, score } of ranked) {
    const article = articleMap.get(id);
    if (article) merged.push({ ...article, _semanticScore: score });
  }
  for (const article of keywordArticles) {
    if (!semanticIds.has(article.id)) {
      merged.push({ ...article, _semanticScore: 0 });
    }
  }

  return merged;
}

async function fetchArticlesByIds(ids) {
  if (ids.length === 0) return [];
  const pool = getPool();
  const result = await pool.query(
    `SELECT
       a.id,
       'article' AS "recordType",
       a.title,
       COALESCE(a.abstract, '') AS summary,
       COALESCE(
         jv.publication_year,
         LEFT(a.date_published, 4)::integer
       ) AS year,
       COALESCE(
         ji.publication_month,
         SUBSTRING(a.date_published, 6, 2)::integer
       ) AS "publicationMonth",
       a.doi,
       a.access_status AS "accessStatus",
       a.page_start AS "pageStart",
       a.page_end AS "pageEnd",
       j.title AS "journalTitle",
       j.subject_area AS "subjectArea",
       ji.id AS "issueId",
       jv.volume_number AS volume,
       ji.issue_number AS "issueNumber",
       ji.issue_title AS "issueTitle",
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
     LEFT JOIN journal_issues ji ON ji.id = a.issue_id
     LEFT JOIN journal_volumes jv ON jv.id = ji.volume_id
     JOIN journals j ON j.id = a.journal_id
     WHERE a.id = ANY($1::int[])`,
    [ids]
  );
  return result.rows.map((row) => ({
    ...row,
    authors: splitList(row.authors),
    keywords: splitList(row.keywords),
    pageRange: formatPageRange(row.pageStart, row.pageEnd)
  }));
}

export async function getArticleById(id) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT
       a.id,
       a.title,
       a.doi,
       a.abstract,
       a.page_start AS "pageStart",
       a.page_end AS "pageEnd",
       a.article_url AS "articleUrl",
       (a.pdf_file_path IS NOT NULL) AS "hasPdf",
       a.apa_citation_cache AS "apaCitationCache",
       a.citation_count AS "citationCount",
       a.download_count AS "downloadCount",
       a.view_count AS "viewCount",
       a.average_rating AS "averageRating",
       a.access_status AS "accessStatus",
       a.date_published AS "datePublished",
       ji.id AS "issueId",
       jv.volume_number AS volume,
       ji.issue_number AS "issueNumber",
       ji.issue_title AS "issueTitle",
       COALESCE(
         ji.publication_month,
         SUBSTRING(a.date_published, 6, 2)::integer
       ) AS "publicationMonth",
       COALESCE(
         jv.publication_year,
         LEFT(a.date_published, 4)::integer
       ) AS "publicationYear",
       ji.date_published AS "issueDatePublished",
       j.id AS "journalId",
       j.title AS "journalTitle",
       j.abbreviation AS "journalAbbreviation",
       j.print_issn AS "printIssn",
       j.online_issn AS "onlineIssn",
       j.publisher_name AS "publisherName",
       j.place_of_publication AS "placeOfPublication",
       j.subject_area AS "subjectArea"
     FROM articles a
     LEFT JOIN journal_issues ji ON ji.id = a.issue_id
     LEFT JOIN journal_volumes jv ON jv.id = ji.volume_id
     JOIN journals j ON j.id = a.journal_id
     WHERE a.id = $1`,
    [id]
  );

  const article = result.rows[0];
  if (!article) return null;

  const [authors, keywords] = await Promise.all([
    getAuthorsForArticle(id),
    getKeywordsForArticle(id)
  ]);
  const pageRange = formatPageRange(article.pageStart, article.pageEnd);
  const relatedArticles = await getRelatedArticles(article, keywords, authors);

  return {
    ...article,
    authors,
    keywords,
    pageRange,
    relatedArticles,
    apaCitation:
      article.apaCitationCache ??
      formatApaCitation({ ...article, authors, pageRange })
  };
}

export async function getArticleAccessStatus(id) {
  const result = await getPool().query(
    `SELECT access_status AS "accessStatus" FROM articles WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function recordArticleCitation(id, visitorKey, readerAccountId = null) {
  const pool = getPool();
  const existing = await pool.query(
    `SELECT id FROM article_citation_events
     WHERE article_id = $1
       AND cited_at >= NOW() - INTERVAL '1 hour'
       AND (
         ($2::bigint IS NOT NULL AND reader_account_id = $2)
         OR ($3::text IS NOT NULL AND $2::bigint IS NULL AND visitor_key = $3)
       )
     LIMIT 1`,
    [id, readerAccountId, visitorKey]
  );
  if (existing.rows[0]) return false;
  await pool.query(
    "INSERT INTO article_citation_events (article_id, visitor_key, reader_account_id) VALUES ($1, $2, $3)",
    [id, visitorKey, readerAccountId]
  );
  await pool.query(
    "UPDATE articles SET citation_count = citation_count + 1 WHERE id = $1",
    [id]
  );
  return true;
}

export async function recordArticleView(id, visitorKey) {
  const pool = getPool();
  const existing = await pool.query(
    `SELECT id FROM article_view_events
     WHERE article_id = $1
       AND visitor_key = $2
       AND viewed_at >= NOW() - INTERVAL '30 minutes'
     LIMIT 1`,
    [id, visitorKey]
  );
  if (existing.rows[0]) return false;

  await pool.query(
    "INSERT INTO article_view_events (article_id, visitor_key) VALUES ($1, $2)",
    [id, visitorKey]
  );
  await pool.query(
    "UPDATE articles SET view_count = view_count + 1 WHERE id = $1",
    [id]
  );
  return true;
}

export async function getArticleDownloadTarget(id, account = null, visitorKey = "") {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, title, pdf_file_path AS "pdfFilePath", access_status AS "accessStatus"
     FROM articles WHERE id = $1`,
    [id]
  );
  const article = result.rows[0];

  if (!article) {
    return { status: 404, body: { message: "Article not found." } };
  }

  if (!article.pdfFilePath) {
    return { status: 404, body: { message: "PDF file is not available for this article." } };
  }

  if (article.accessStatus === "Unavailable") {
    return { status: 403, body: { message: "This article PDF is currently unavailable." } };
  }

  if (article.accessStatus === "Restricted") {
    if (!account) {
      return {
        status: 401,
        body: { message: "Sign in with an active account to download this article.", code: "UNAUTHENTICATED" }
      };
    }
    if (account.type === "admin" && account.mustChangePassword) {
      return { status: 403, body: { message: "Change your temporary password before downloading files." } };
    }
  }

  if (account?.type !== "admin") {
    const readerAccountId = account?.type === "reader" ? account.id : null;
    const recentDownload = await pool.query(
      `SELECT id FROM article_download_events
       WHERE article_id = $1
         AND downloaded_at >= NOW() - INTERVAL '30 minutes'
         AND (
           ($2::bigint IS NOT NULL AND reader_account_id = $2)
           OR ($3::text IS NOT NULL AND $2::bigint IS NULL AND visitor_key = $3)
         )
       LIMIT 1`,
      [article.id, readerAccountId, visitorKey || null]
    );
    if (!recentDownload.rows[0]) {
      await pool.query(
        `INSERT INTO article_download_events (article_id, reader_account_id, visitor_key)
         VALUES ($1, $2, $3)`,
        [article.id, readerAccountId, visitorKey || null]
      );
      await pool.query(
        "UPDATE articles SET download_count = download_count + 1 WHERE id = $1",
        [article.id]
      );
    }
  }

  return { status: 302, location: article.pdfFilePath };
}

export async function getIssueById(id) {
  const pool = getPool();
  const issueResult = await pool.query(
    `SELECT
       ji.id,
       jv.volume_number AS volume,
       jv.publication_year AS "publicationYear",
       ji.issue_number AS "issueNumber",
       ji.issue_title AS "issueTitle",
       ji.publication_month AS "publicationMonth",
       ji.date_published AS "datePublished",
       ji.issue_cover_image AS "issueCoverImage",
       ji.issue_url AS "issueUrl",
       j.id AS "journalId",
       j.title AS "journalTitle",
       j.abbreviation AS "journalAbbreviation",
       j.print_issn AS "printIssn",
       j.online_issn AS "onlineIssn",
       j.publisher_name AS "publisherName",
       j.place_of_publication AS "placeOfPublication",
       j.subject_area AS "subjectArea",
       j.description AS "journalDescription"
     FROM journal_issues ji
     JOIN journal_volumes jv ON jv.id = ji.volume_id
     JOIN journals j ON j.id = ji.journal_id
     WHERE ji.id = $1`,
    [id]
  );

  const issue = issueResult.rows[0];
  if (!issue) return null;

  const articlesResult = await pool.query(
    `SELECT
       a.id,
       a.title,
       a.doi,
       a.page_start AS "pageStart",
       a.page_end AS "pageEnd",
       a.date_published AS "datePublished",
       a.access_status AS "accessStatus",
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
     WHERE a.issue_id = $1
     ORDER BY
       (CASE WHEN a.page_start ~ '^\d+$' THEN a.page_start::integer ELSE 0 END) ASC,
       a.title ASC`,
    [id]
  );

  const articles = articlesResult.rows.map((article) => ({
    ...article,
    authors: splitList(article.authors),
    keywords: splitList(article.keywords),
    pageRange: formatPageRange(article.pageStart, article.pageEnd)
  }));

  return { ...issue, monthLabel: formatMonth(issue.publicationMonth), articles };
}

export async function getJournalById(id) {
  const pool = getPool();
  const journalResult = await pool.query(
    `SELECT
       j.id,
       j.title,
       j.abbreviation,
       j.print_issn AS "printIssn",
       j.online_issn AS "onlineIssn",
       j.publisher_name AS "publisherName",
       j.place_of_publication AS "placeOfPublication",
       j.journal_url AS "journalUrl",
       j.subject_area AS "subjectArea",
       j.description,
       j.default_cover_image AS "defaultCoverImage",
       j.ai_insight AS "aiInsight",
       j.ai_insight_updated_at AS "aiInsightUpdatedAt",
       (SELECT COUNT(*) FROM articles a WHERE a.journal_id = j.id)::integer AS "totalArticleCount",
       COALESCE((SELECT SUM(a.view_count) FROM articles a WHERE a.journal_id = j.id), 0)::integer AS "totalViewCount",
       COALESCE((SELECT SUM(a.download_count) FROM articles a WHERE a.journal_id = j.id), 0)::integer AS "totalDownloadCount",
       COALESCE((SELECT SUM(a.citation_count) FROM articles a WHERE a.journal_id = j.id), 0)::integer AS "totalCitationCount"
     FROM journals j
     WHERE j.id = $1`,
    [id]
  );

  const journal = journalResult.rows[0];
  if (!journal) return null;

  const rawIssuesResult = await pool.query(
    `SELECT
       ji.id,
       ji.volume_id AS "volumeId",
       jv.volume_number AS "volumeNumber",
       jv.publication_year AS "publicationYear",
       jv.volume_title AS "volumeTitle",
       ji.issue_number AS "issueNumber",
       ji.issue_title AS "issueTitle",
       ji.publication_month AS "publicationMonth",
       ji.date_published AS "datePublished",
       ji.issue_cover_image AS "issueCoverImage",
       (SELECT COUNT(*) FROM articles a WHERE a.issue_id = ji.id)::integer AS "articleCount"
     FROM journal_issues ji
     JOIN journal_volumes jv ON jv.id = ji.volume_id
     WHERE ji.journal_id = $1
     ORDER BY
       jv.publication_year DESC,
       (CASE WHEN jv.volume_number ~ '^\d+$' THEN jv.volume_number::integer ELSE 0 END) DESC,
       ji.publication_month DESC NULLS LAST,
       (CASE WHEN ji.issue_number ~ '^\d+$' THEN ji.issue_number::integer ELSE 0 END) ASC`,
    [id]
  );

  const volumeMap = new Map();
  for (const issue of rawIssuesResult.rows) {
    if (!volumeMap.has(issue.volumeId)) {
      volumeMap.set(issue.volumeId, {
        id: issue.volumeId,
        volumeNumber: issue.volumeNumber,
        publicationYear: issue.publicationYear,
        volumeTitle: issue.volumeTitle,
        issues: []
      });
    }
    volumeMap.get(issue.volumeId).issues.push({
      id: issue.id,
      issueNumber: issue.issueNumber,
      issueTitle: issue.issueTitle,
      publicationMonth: issue.publicationMonth,
      monthLabel: formatMonth(issue.publicationMonth),
      datePublished: issue.datePublished,
      issueCoverImage: issue.issueCoverImage,
      articleCount: issue.articleCount
    });
  }
  const volumes = Array.from(volumeMap.values());

  const onlineFirstResult = await pool.query(
    `SELECT
       a.id,
       a.title,
       LEFT(a.date_published, 4)::integer AS "publicationYear",
       a.date_published AS "datePublished",
       (
         SELECT STRING_AGG(au.display_name, ', ' ORDER BY aa.author_order ASC)
         FROM article_authors aa
         JOIN authors au ON au.id = aa.author_id
         WHERE aa.article_id = a.id
       ) AS authors
     FROM articles a
     WHERE a.journal_id = $1 AND a.issue_id IS NULL
     ORDER BY a.date_published DESC NULLS LAST, a.title ASC`,
    [id]
  );

  const onlineFirstArticles = onlineFirstResult.rows.map((article) => ({
    ...article,
    authors: splitList(article.authors)
  }));

  return { ...journal, volumes, onlineFirstArticles };
}

async function listArticleRecords(search, field, limit) {
  const pool = getPool();
  const params = [];
  const searchWhere = buildSearchFilter(search, getArticleSearchClauses(field), params);
  params.push(limit);

  const result = await pool.query(
    `SELECT
       a.id,
       'article' AS "recordType",
       a.title,
       COALESCE(a.abstract, '') AS summary,
       COALESCE(
         jv.publication_year,
         LEFT(a.date_published, 4)::integer
       ) AS year,
       COALESCE(
         ji.publication_month,
         SUBSTRING(a.date_published, 6, 2)::integer
       ) AS "publicationMonth",
       a.doi,
       a.access_status AS "accessStatus",
       a.page_start AS "pageStart",
       a.page_end AS "pageEnd",
       j.title AS "journalTitle",
       j.subject_area AS "subjectArea",
       ji.id AS "issueId",
       jv.volume_number AS volume,
       ji.issue_number AS "issueNumber",
       ji.issue_title AS "issueTitle",
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
     LEFT JOIN journal_issues ji ON ji.id = a.issue_id
     LEFT JOIN journal_volumes jv ON jv.id = ji.volume_id
     JOIN journals j ON j.id = a.journal_id
     ${searchWhere}
     ORDER BY
       COALESCE(jv.publication_year, LEFT(a.date_published, 4)::integer) DESC NULLS LAST,
       COALESCE(ji.publication_month, SUBSTRING(a.date_published, 6, 2)::integer) DESC NULLS LAST,
       a.title ASC
     LIMIT $${params.length}`,
    params
  );

  return result.rows.map((row) => ({
    ...row,
    authors: splitList(row.authors),
    keywords: splitList(row.keywords),
    pageRange: formatPageRange(row.pageStart, row.pageEnd)
  }));
}

async function listIssueRecords(search, field, limit) {
  const pool = getPool();
  const params = [];
  const searchWhere = buildSearchFilter(search, getIssueSearchClauses(field), params);
  params.push(limit);

  const result = await pool.query(
    `SELECT
       ji.id,
       'issue' AS "recordType",
       j.title || ' Vol. ' || jv.volume_number || ', No. ' || ji.issue_number AS title,
       COALESCE(ji.issue_title, j.description, '') AS summary,
       jv.publication_year AS year,
       ji.publication_month AS "publicationMonth",
       jv.volume_number AS volume,
       ji.issue_number AS "issueNumber",
       ji.issue_title AS "issueTitle",
       ji.issue_cover_image AS "issueCoverImage",
       j.title AS "journalTitle",
       j.subject_area AS "subjectArea",
       (SELECT COUNT(*) FROM articles a WHERE a.issue_id = ji.id)::integer AS "articleCount"
     FROM journal_issues ji
     JOIN journal_volumes jv ON jv.id = ji.volume_id
     JOIN journals j ON j.id = ji.journal_id
     ${searchWhere}
     ORDER BY jv.publication_year DESC, ji.publication_month DESC NULLS LAST, j.title ASC
     LIMIT $${params.length}`,
    params
  );

  return result.rows.map((issue) => ({
    ...issue,
    monthLabel: formatMonth(issue.publicationMonth)
  }));
}

async function listJournalRecords(search, field, limit) {
  const pool = getPool();
  const params = [];
  const searchWhere = buildSearchFilter(search, getJournalSearchClauses(field), params);
  params.push(limit);

  const result = await pool.query(
    `SELECT
       j.id,
       'journal' AS "recordType",
       j.title,
       COALESCE(j.description, '') AS summary,
       NULL AS year,
       j.abbreviation,
       j.print_issn AS "printIssn",
       j.online_issn AS "onlineIssn",
       j.publisher_name AS "publisherName",
       j.place_of_publication AS "placeOfPublication",
       j.subject_area AS "subjectArea",
       j.default_cover_image AS "defaultCoverImage",
       j.ai_insight AS "aiInsight",
       j.ai_insight_updated_at AS "aiInsightUpdatedAt",
       (SELECT COUNT(*) FROM journal_issues ji WHERE ji.journal_id = j.id)::integer AS "issueCount",
       (SELECT COUNT(*) FROM articles a WHERE a.journal_id = j.id)::integer AS "articleCount",
       (SELECT COUNT(*) FROM articles a_online WHERE a_online.journal_id = j.id AND a_online.issue_id IS NULL)::integer AS "onlineFirstArticleCount",
       (SELECT MAX(jv_latest.publication_year) FROM journal_volumes jv_latest WHERE jv_latest.journal_id = j.id) AS "latestIssueYear"
     FROM journals j
     ${searchWhere}
     ORDER BY j.title ASC
     LIMIT $${params.length}`,
    params
  );

  return result.rows;
}

async function getAnnouncements() {
  const result = await getPool().query(
    `SELECT
       id,
       label,
       title,
       publish_date AS date,
       summary,
       href,
       link_label AS "linkLabel",
       image
     FROM announcements
     WHERE status = 'Published'
       AND publish_date <= CURRENT_DATE::text
     ORDER BY sort_order ASC, publish_date DESC, updated_at DESC, id DESC
     LIMIT 9`
  );
  return result.rows;
}

async function listHomepageJournals(mode) {
  const orderBy = {
    latest: `j.updated_at DESC, (SELECT MAX(jv2.publication_year) FROM journal_volumes jv2 WHERE jv2.journal_id = j.id) DESC NULLS LAST, j.title ASC`,
    mostViewed: `COALESCE(SUM(a.view_count), 0) DESC, COUNT(a.id) DESC, j.title ASC`,
    mostCited: `COALESCE(SUM(a.citation_count), 0) DESC, COUNT(a.id) DESC, j.title ASC`,
    popular: `COALESCE(SUM(a.view_count + a.download_count + (a.citation_count * 10)), 0) DESC, COUNT(a.id) DESC, j.title ASC`
  }[mode] ?? `j.updated_at DESC, j.title ASC`;

  const result = await getPool().query(
    `SELECT
       j.id,
       j.title,
       j.publisher_name AS "publisherName",
       j.subject_area AS "subjectArea",
       COALESCE(j.description, '') AS summary,
       (SELECT COUNT(*) FROM journal_issues ji WHERE ji.journal_id = j.id)::integer AS "issueCount",
       COUNT(a.id)::integer AS "articleCount",
       COALESCE(SUM(a.view_count), 0)::integer AS "viewCount",
       COALESCE(SUM(a.citation_count), 0)::integer AS "citationCount",
       COALESCE(SUM(a.download_count), 0)::integer AS "downloadCount",
       COALESCE(SUM(a.view_count + a.download_count + (a.citation_count * 10)), 0)::integer AS "popularScore",
       (SELECT MAX(jv_latest.publication_year) FROM journal_volumes jv_latest WHERE jv_latest.journal_id = j.id) AS "latestIssueYear"
     FROM journals j
     LEFT JOIN articles a ON a.journal_id = j.id
     GROUP BY j.id
     ORDER BY ${orderBy}
     LIMIT 10`
  );

  return result.rows.map((journal) => ({
    ...journal,
    summary: truncateText(journal.summary, 130)
  }));
}

async function listHomepageArticles(mode) {
  const orderBy = {
    latest: `
      COALESCE(jv.publication_year, LEFT(a.date_published, 4)::integer) DESC NULLS LAST,
      COALESCE(ji.publication_month, SUBSTRING(a.date_published, 6, 2)::integer) DESC NULLS LAST,
      a.date_published DESC NULLS LAST,
      a.title ASC
    `,
    mostViewed: `a.view_count DESC, a.title ASC`,
    mostDownloaded: `a.download_count DESC, a.title ASC`,
    mostCited: `a.citation_count DESC, a.title ASC`,
    popular: `(a.view_count + a.download_count + (a.citation_count * 10)) DESC, a.title ASC`
  }[mode] ?? `a.title ASC`;

  const result = await getPool().query(
    `SELECT
       a.id,
       a.title,
       COALESCE(a.abstract, '') AS summary,
       a.doi,
       a.access_status AS "accessStatus",
       a.view_count AS "viewCount",
       a.citation_count AS "citationCount",
       a.download_count AS "downloadCount",
       a.page_start AS "pageStart",
       a.page_end AS "pageEnd",
       COALESCE(jv.publication_year, LEFT(a.date_published, 4)::integer) AS year,
       j.title AS "journalTitle",
       j.subject_area AS "subjectArea",
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
     ORDER BY ${orderBy}
     LIMIT 10`
  );

  return result.rows.map((article) => ({
    ...article,
    authors: splitList(article.authors),
    keywords: splitList(article.keywords),
    pageRange: formatPageRange(article.pageStart, article.pageEnd),
    summary: truncateText(article.summary, 170)
  }));
}

async function listHomepageTopics(mode) {
  if (mode === "searched") {
    const result = await getPool().query(
      `SELECT
         search_term AS id,
         search_term AS name,
         COUNT(*)::integer AS "searchCount",
         MAX(created_at) AS "lastSearchedAt"
       FROM search_logs
       WHERE search_term IS NOT NULL AND search_term != ''
       GROUP BY search_term
       ORDER BY COUNT(*) DESC, MAX(created_at) DESC, search_term ASC
       LIMIT 10`
    );
    return result.rows;
  }

  const result = await getPool().query(
    `SELECT
       k.id,
       k.name,
       COUNT(DISTINCT a.id)::integer AS "articleCount",
       COALESCE(SUM(a.view_count), 0)::integer AS "viewCount",
       COALESCE(SUM(a.citation_count), 0)::integer AS "citationCount",
       COALESCE(SUM(a.download_count), 0)::integer AS "downloadCount",
       COALESCE(SUM(a.view_count + a.download_count + (a.citation_count * 10)), 0)::integer AS "popularScore"
     FROM keywords k
     JOIN article_keywords ak ON ak.keyword_id = k.id
     JOIN articles a ON a.id = ak.article_id
     GROUP BY k.id
     ORDER BY COUNT(DISTINCT a.id) DESC, COALESCE(SUM(a.view_count), 0) DESC, k.name ASC
     LIMIT 10`
  );
  return result.rows;
}

function buildSearchFilter(search, clauses, params) {
  if (!search || clauses.length === 0) return "";
  params.push(`%${search}%`);
  const ref = `$${params.length}`;
  const numbered = clauses.map((c) => c.replaceAll("?", ref));
  return `WHERE ${numbered.join("\n        OR ")}`;
}

function getArticleSearchClauses(field) {
  const fields = {
    title: ["a.title ILIKE ?"],
    author: [
      `EXISTS (
          SELECT 1
          FROM article_authors aa_search
          JOIN authors au_search ON au_search.id = aa_search.author_id
          WHERE aa_search.article_id = a.id
            AND au_search.display_name ILIKE ?
        )`
    ],
    doi: ["a.doi ILIKE ?"],
    subject: ["j.subject_area ILIKE ?"],
    keyword: [
      `EXISTS (
          SELECT 1
          FROM article_keywords ak_search
          JOIN keywords k_search ON k_search.id = ak_search.keyword_id
          WHERE ak_search.article_id = a.id
            AND k_search.name ILIKE ?
        )`
    ],
    publication_year: [
      `COALESCE(jv.publication_year, LEFT(a.date_published, 4)::integer)::text ILIKE ?`
    ],
    volume: ["jv.volume_number ILIKE ?"],
    issue_number: ["ji.issue_number ILIKE ?"]
  };
  const allFields = [
    ...fields.title,
    "a.abstract ILIKE ?",
    ...fields.author,
    ...fields.doi,
    ...fields.subject,
    ...fields.keyword,
    ...fields.publication_year,
    ...fields.volume,
    ...fields.issue_number
  ];

  if (field !== "all") {
    return fields[field] ?? allFields;
  }
  return allFields;
}

function getIssueSearchClauses(field) {
  const articleAuthorClause = `EXISTS (
          SELECT 1
          FROM articles a_search
          JOIN article_authors aa_search ON aa_search.article_id = a_search.id
          JOIN authors au_search ON au_search.id = aa_search.author_id
          WHERE a_search.issue_id = ji.id
            AND au_search.display_name ILIKE ?
        )`;
  const articleDoiClause = `EXISTS (
          SELECT 1
          FROM articles a_search
          WHERE a_search.issue_id = ji.id
            AND a_search.doi ILIKE ?
        )`;
  const articleKeywordClause = `EXISTS (
          SELECT 1
          FROM articles a_search
          JOIN article_keywords ak_search ON ak_search.article_id = a_search.id
          JOIN keywords k_search ON k_search.id = ak_search.keyword_id
          WHERE a_search.issue_id = ji.id
            AND k_search.name ILIKE ?
        )`;
  const fields = {
    title: ["j.title ILIKE ?", "ji.issue_title ILIKE ?"],
    author: [articleAuthorClause],
    doi: [articleDoiClause],
    issn: ["j.print_issn ILIKE ?", "j.online_issn ILIKE ?"],
    subject: ["j.subject_area ILIKE ?"],
    keyword: [articleKeywordClause],
    publisher: ["j.publisher_name ILIKE ?"],
    publication_year: ["jv.publication_year::text ILIKE ?"],
    volume: ["jv.volume_number ILIKE ?"],
    issue_number: ["ji.issue_number ILIKE ?"]
  };

  if (field !== "all") {
    return fields[field] ?? [];
  }

  return [
    ...fields.title,
    ...fields.author,
    ...fields.doi,
    ...fields.issn,
    ...fields.subject,
    ...fields.keyword,
    ...fields.publisher,
    ...fields.publication_year,
    ...fields.volume,
    ...fields.issue_number
  ];
}

function getJournalSearchClauses(field) {
  const fields = {
    title: ["j.title ILIKE ?", "j.abbreviation ILIKE ?"],
    issn: ["j.print_issn ILIKE ?", "j.online_issn ILIKE ?"],
    subject: ["j.subject_area ILIKE ?"],
    publisher: ["j.publisher_name ILIKE ?"]
  };
  const allFields = [
    ...fields.title,
    "j.description ILIKE ?",
    "j.place_of_publication ILIKE ?",
    ...fields.issn,
    ...fields.subject,
    ...fields.publisher
  ];

  if (field !== "all") {
    return fields[field] ?? allFields;
  }
  return allFields;
}

async function getAuthorsForArticle(articleId) {
  const result = await getPool().query(
    `SELECT
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
     ORDER BY aa.author_order ASC`,
    [articleId]
  );
  return result.rows.map((author) => ({
    ...author,
    isCorresponding: Boolean(author.isCorresponding)
  }));
}

async function getKeywordsForArticle(articleId) {
  const result = await getPool().query(
    `SELECT k.name
     FROM article_keywords ak
     JOIN keywords k ON k.id = ak.keyword_id
     WHERE ak.article_id = $1
     ORDER BY k.name ASC`,
    [articleId]
  );
  return result.rows.map((keyword) => keyword.name);
}

async function getRelatedArticles(article, sourceKeywords, sourceAuthors = []) {
  const sourceKeywordSet = new Set(
    sourceKeywords.map((keyword) => keyword.toLowerCase())
  );
  const sourceAuthorSet = new Set(
    sourceAuthors.map((author) => author.displayName?.toLowerCase()).filter(Boolean)
  );

  const result = await getPool().query(
    `SELECT
       a.id,
       a.title,
       COALESCE(a.abstract, '') AS summary,
       COALESCE(
         jv.publication_year,
         LEFT(a.date_published, 4)::integer
       ) AS year,
       COALESCE(
         ji.publication_month,
         SUBSTRING(a.date_published, 6, 2)::integer
       ) AS "publicationMonth",
       a.page_start AS "pageStart",
       a.page_end AS "pageEnd",
       j.id AS "journalId",
       j.title AS "journalTitle",
       j.subject_area AS "subjectArea",
       ji.id AS "issueId",
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
     LEFT JOIN journal_issues ji ON ji.id = a.issue_id
     LEFT JOIN journal_volumes jv ON jv.id = ji.volume_id
     JOIN journals j ON j.id = a.journal_id
     WHERE a.id <> $1
     AND (
       a.journal_id = $2
       OR (j.subject_area IS NOT NULL AND j.subject_area = $3)
       OR EXISTS (
         SELECT 1
         FROM article_keywords ak_src
         JOIN keywords k_src ON k_src.id = ak_src.keyword_id
         JOIN article_keywords ak_cand ON ak_cand.article_id = a.id
         JOIN keywords k_cand ON k_cand.id = ak_cand.keyword_id
         WHERE ak_src.article_id = $4
         AND LOWER(k_src.name) = LOWER(k_cand.name)
       )
       OR EXISTS (
         SELECT 1
         FROM article_authors aa_src
         JOIN authors au_src ON au_src.id = aa_src.author_id
         JOIN article_authors aa_cand ON aa_cand.article_id = a.id
         JOIN authors au_cand ON au_cand.id = aa_cand.author_id
         WHERE aa_src.article_id = $5
         AND LOWER(au_src.display_name) = LOWER(au_cand.display_name)
       )
     )`,
    [article.id, article.journalId, article.subjectArea ?? null, article.id, article.id]
  );

  return result.rows
    .map((candidate) => {
      const candidateKeywords = splitList(candidate.keywords);
      const candidateAuthors = splitList(candidate.authors);

      const matchedKeywords = candidateKeywords.filter((keyword) =>
        sourceKeywordSet.has(keyword.toLowerCase())
      );
      const matchedAuthors = candidateAuthors.filter((author) =>
        sourceAuthorSet.has(author.toLowerCase())
      );
      const sameSubject =
        article.subjectArea != null && candidate.subjectArea === article.subjectArea;
      const sameJournal = String(candidate.journalId) === String(article.journalId);

      const score =
        matchedKeywords.length * 4 +
        (sameSubject ? 5 : 0) +
        matchedAuthors.length * 2 +
        (sameJournal ? 1 : 0);

      return {
        ...candidate,
        recordType: "article",
        authors: candidateAuthors,
        keywords: candidateKeywords,
        pageRange: formatPageRange(candidate.pageStart, candidate.pageEnd),
        relatedReasons: [
          matchedKeywords.length
            ? `Shared keywords: ${matchedKeywords.join(", ")}`
            : null,
          matchedAuthors.length
            ? `Shared author${matchedAuthors.length === 1 ? "" : "s"}: ${matchedAuthors.join(", ")}`
            : null,
          sameSubject ? "Same subject area" : null,
          sameJournal ? "Same journal" : null
        ].filter(Boolean),
        relatedScore: score
      };
    })
    .filter((candidate) => candidate.relatedScore > 0)
    .sort(
      (first, second) =>
        second.relatedScore - first.relatedScore ||
        (second.year ?? 0) - (first.year ?? 0) ||
        first.title.localeCompare(second.title)
    )
    .slice(0, 6);
}

function normalizeFilters(filters) {
  return {
    subject: normalizeFilterValue(filters.subject),
    publisher: normalizeFilterValue(filters.publisher),
    journal: normalizeFilterValue(filters.journal),
    year: normalizeFilterValue(filters.year),
    yearFrom: normalizeYearBoundary(filters.yearFrom),
    yearTo: normalizeYearBoundary(filters.yearTo)
  };
}

function normalizeFilterValue(value) {
  const normalizedValue = String(value ?? "all").trim();
  return normalizedValue && normalizedValue !== "all" ? normalizedValue : "";
}

function normalizeYearBoundary(value) {
  const parsedYear = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isInteger(parsedYear) ? parsedYear : null;
}

function normalizeSearchField(recordType, field) {
  const allowedFieldsByType = {
    journal: new Set(["all", "title", "issn", "subject", "publisher"]),
    article: new Set([
      "all", "title", "author", "doi", "subject", "keyword",
      "publication_year", "volume", "issue_number", "semantic"
    ]),
    issue: VALID_SEARCH_FIELDS,
    all: VALID_SEARCH_FIELDS
  };
  const allowedFields = allowedFieldsByType[recordType] ?? allowedFieldsByType.all;
  return allowedFields.has(field) ? field : "all";
}

function normalizeSort(recordType, sort) {
  const sortKey = String(sort ?? "").trim();
  const allowedSortsByType = {
    journal: new Set(["title_asc", "title_desc", "newest_issue_year", "oldest_issue_year"]),
    article: new Set(["newest_year", "oldest_year", "title_asc", "title_desc"]),
    issue: new Set(["newest_year", "oldest_year", "title_asc", "title_desc"]),
    all: new Set(["newest_year", "oldest_year", "title_asc", "title_desc"])
  };
  const allowedSorts = allowedSortsByType[recordType] ?? allowedSortsByType.all;

  if (allowedSorts.has(sortKey)) return sortKey;
  return recordType === "journal" ? "title_asc" : "newest_year";
}

function normalizeLimit(limit) {
  const parsedLimit = Number.parseInt(limit, 10);
  if (!Number.isFinite(parsedLimit)) return 50;
  return Math.min(Math.max(parsedLimit, 1), 100);
}

function normalizePage(page) {
  const parsedPage = Number.parseInt(page, 10);
  if (!Number.isInteger(parsedPage)) return 1;
  return Math.max(parsedPage, 1);
}

function normalizePageSize(pageSize) {
  const parsedPageSize = Number.parseInt(pageSize, 10);
  return VALID_PAGE_SIZES.has(parsedPageSize) ? parsedPageSize : 10;
}

function recordMatchesFilters(record, filters) {
  if (filters.subject && record.subjectArea !== filters.subject) return false;
  if (filters.publisher && record.publisherName !== filters.publisher) return false;
  if (filters.journal && record.journalTitle !== filters.journal) return false;
  if (filters.year && String(record.year ?? "") !== filters.year) return false;

  const recordYear = Number(record.year);
  if (filters.yearFrom !== null && (!Number.isFinite(recordYear) || recordYear < filters.yearFrom)) return false;
  if (filters.yearTo !== null && (!Number.isFinite(recordYear) || recordYear > filters.yearTo)) return false;

  return true;
}

function sortRecords(first, second, sortKey) {
  if (sortKey === "title_asc") return first.title.localeCompare(second.title);
  if (sortKey === "title_desc") return second.title.localeCompare(first.title);
  if (sortKey === "oldest_year") return getRecordYear(first) - getRecordYear(second);
  if (sortKey === "newest_issue_year") {
    return (
      (second.latestIssueYear ?? 0) - (first.latestIssueYear ?? 0) ||
      first.title.localeCompare(second.title)
    );
  }
  if (sortKey === "oldest_issue_year") {
    return (
      (first.latestIssueYear ?? Infinity) - (second.latestIssueYear ?? Infinity) ||
      first.title.localeCompare(second.title)
    );
  }

  const firstYear = first.year ?? 0;
  const secondYear = second.year ?? 0;
  if (firstYear !== secondYear) return secondYear - firstYear;

  const firstMonth = first.publicationMonth ?? 0;
  const secondMonth = second.publicationMonth ?? 0;
  if (firstMonth !== secondMonth) return secondMonth - firstMonth;

  return first.title.localeCompare(second.title);
}

function getRecordYear(record) {
  return record.year ?? record.latestIssueYear ?? 0;
}

function splitList(value) {
  return value ? value.split(", ").filter(Boolean) : [];
}

function formatPageRange(start, end) {
  if (start && end) return `${start}-${end}`;
  return start ?? end ?? null;
}

function formatMonth(monthNumber) {
  if (!monthNumber) return null;
  return new Intl.DateTimeFormat("en", { month: "long" }).format(
    new Date(Date.UTC(2025, monthNumber - 1, 1))
  );
}

function truncateText(value, maxLength) {
  const text = String(value ?? "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}...`;
}

function formatApaCitation(article) {
  const authorText = formatApaAuthors(article.authors);
  const year = article.publicationYear ?? "n.d.";
  const issueText = article.volume
    ? article.issueNumber
      ? `${article.volume}(${article.issueNumber})`
      : article.volume
    : "";
  const pages = article.pageRange ? `${issueText ? ", " : ""}${article.pageRange}` : "";
  const publicationDetails = issueText || pages ? `, ${issueText}${pages}` : "";
  const doi = article.doi ? ` https://doi.org/${article.doi}` : "";

  return `${authorText} (${year}). ${article.title}. ${article.journalTitle}${publicationDetails}.${doi}`;
}

function formatApaAuthors(authors) {
  if (!authors.length) return "Unknown author";

  const formattedAuthors = authors.map((author) => {
    const initials = [author.firstName, author.middleName]
      .filter(Boolean)
      .map((name) => `${name.at(0)}.`)
      .join(" ");
    return `${author.lastName}, ${initials}`;
  });

  if (formattedAuthors.length === 1) return formattedAuthors[0];
  if (formattedAuthors.length === 2) return `${formattedAuthors[0]}, & ${formattedAuthors[1]}`;

  return `${formattedAuthors.slice(0, -1).join(", ")}, & ${formattedAuthors.at(-1)}`;
}
