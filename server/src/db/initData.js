import { hashPassword } from "../auth/password.js";

const journals = [
  {
    key: "applied-computing",
    title: "Journal of Applied Computing",
    abbreviation: "J. Appl. Comput.",
    printIssn: "3021-1148",
    onlineIssn: "3021-1149",
    publisherName: "Metro Academic Press",
    placeOfPublication: "Manila, Philippines",
    journalUrl: null,
    subjectArea: "Technology",
    description: "Peer-reviewed studies on practical software systems, human-computer interaction, and data-driven services.",
    defaultCoverImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=80"
  },
  {
    key: "education-review",
    title: "Philippine Education Review",
    abbreviation: "Philipp. Educ. Rev.",
    printIssn: "3021-2047",
    onlineIssn: "3021-2048",
    publisherName: "Learning Futures Institute",
    placeOfPublication: "Quezon City, Philippines",
    journalUrl: null,
    subjectArea: "Education",
    description: "Research on classroom practice, curriculum development, assessment, and learner support.",
    defaultCoverImage: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1000&q=80"
  },
  {
    key: "public-health",
    title: "Public Health Perspectives",
    abbreviation: "Public Health Perspect.",
    printIssn: "3021-3372",
    onlineIssn: "3021-3373",
    publisherName: "Community Health Research Center",
    placeOfPublication: "Cebu City, Philippines",
    journalUrl: null,
    subjectArea: "Health Sciences",
    description: "Applied public health research focused on local service delivery and community outcomes.",
    defaultCoverImage: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1000&q=80"
  },
  {
    key: "environmental-systems",
    title: "Environmental Systems Journal",
    abbreviation: "Environ. Syst. J.",
    printIssn: "3021-4496",
    onlineIssn: "3021-4497",
    publisherName: "Greenfield Research Network",
    placeOfPublication: "Davao City, Philippines",
    journalUrl: null,
    subjectArea: "Environment",
    description: "Studies on sustainable systems, environmental monitoring, and resource management.",
    defaultCoverImage: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1000&q=80"
  }
];

const volumes = [
  { key: "applied-computing-12", journalKey: "applied-computing", volumeNumber: "12", publicationYear: 2025 },
  { key: "education-review-8", journalKey: "education-review", volumeNumber: "8", publicationYear: 2025 },
  { key: "public-health-5", journalKey: "public-health", volumeNumber: "5", publicationYear: 2024 },
  { key: "environmental-systems-9", journalKey: "environmental-systems", volumeNumber: "9", publicationYear: 2025 }
];

const issues = [
  {
    key: "applied-computing-12-1", journalKey: "applied-computing", volumeKey: "applied-computing-12",
    issueNumber: "1", issueTitle: "Repository Systems and Digital Discovery", publicationMonth: 3,
    datePublished: "2025-03-15",
    issueCoverImage: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1000&q=80",
    issueUrl: "https://example.edu/journals/applied-computing/12/1"
  },
  {
    key: "education-review-8-1", journalKey: "education-review", volumeKey: "education-review-8",
    issueNumber: "1", issueTitle: "Student Learning and Assessment", publicationMonth: 6,
    datePublished: "2025-06-20",
    issueCoverImage: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1000&q=80",
    issueUrl: "https://example.edu/journals/education-review/8/1"
  },
  {
    key: "public-health-5-2", journalKey: "public-health", volumeKey: "public-health-5",
    issueNumber: "2", issueTitle: "Community Health Data and Access", publicationMonth: 9,
    datePublished: "2024-09-10",
    issueCoverImage: "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&w=1000&q=80",
    issueUrl: "https://example.edu/journals/public-health-perspectives/5/2"
  },
  {
    key: "environmental-systems-9-1", journalKey: "environmental-systems", volumeKey: "environmental-systems-9",
    issueNumber: "1", issueTitle: "Monitoring and Resource Conservation", publicationMonth: 2,
    datePublished: "2025-02-28",
    issueCoverImage: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?auto=format&fit=crop&w=1000&q=80",
    issueUrl: "https://example.edu/journals/environmental-systems/9/1"
  }
];

const announcements = [
  { label: "Repository update", title: "Online-first articles are included in discovery", publishDate: "2026-04-15", summary: "Articles can be searched and opened even before final volume and issue assignment.", href: "/records?type=article&sort=newest_year", linkLabel: "Browse articles", status: "Published", sortOrder: 1 },
  { label: "Access notice", title: "Open access records are highlighted on article pages", publishDate: "2026-04-15", summary: "Article details include access status, PDF links, citations, abstracts, and keywords when available.", href: "/records?type=article&subject=all", linkLabel: "View catalog", status: "Published", sortOrder: 2 },
  { label: "Metadata quality", title: "Author and keyword suggestions help keep records clean", publishDate: "2026-04-15", summary: "The admin workflow now encourages reuse of existing authors and subject terms.", href: "/about", linkLabel: "Learn more", status: "Published", sortOrder: 3 },
  { label: "Access notice", title: "Register for a reader account to access restricted articles", publishDate: "2026-04-28", summary: "Verified readers with institutional email addresses can request full-text access to restricted journal articles directly from the repository.", href: "/register", linkLabel: "Create account", status: "Published", sortOrder: 4 },
  { label: "Repository update", title: "Article citations are now available in multiple formats", publishDate: "2026-05-01", summary: "Each article detail page now includes a formatted citation ready to copy. Additional citation styles can be configured by the repository administrator.", href: "/records?type=article", linkLabel: "Browse articles", status: "Published", sortOrder: 5 }
];

const articles = [
  {
    journalKey: "applied-computing", issueKey: "applied-computing-12-1",
    title: "Search Interfaces for Small Academic Repositories", doi: "10.5555/jac.2025.001",
    abstract: "This article evaluates simple search patterns for small academic repositories and identifies interface choices that improve record discovery without increasing maintenance cost.",
    pageStart: "1", pageEnd: "16", articleUrl: null,
    pdfFilePath: null,
    citationCount: 0, downloadCount: 0, viewCount: 0, averageRating: 0,
    accessStatus: "Restricted", datePublished: "2025-03-15",
    keywords: ["search", "repository", "metadata", "usability"],
    authors: [
      { firstName: "Maria", lastName: "Santos", affiliation: "Metro State University", orcid: "0000-0002-1111-2223", isCorresponding: true },
      { firstName: "Daniel", lastName: "Cruz", affiliation: "North Valley College", orcid: "0000-0002-3333-4444" }
    ]
  },
  {
    journalKey: "applied-computing", issueKey: "applied-computing-12-1",
    title: "Lightweight Metadata Workflows for Online Journals", doi: "10.5555/jac.2025.014",
    abstract: "A practical metadata workflow is proposed for small editorial teams that need consistent journal and article records without a complex publishing platform.",
    pageStart: "17", pageEnd: "31", articleUrl: null,
    pdfFilePath: null,
    citationCount: 0, downloadCount: 0, viewCount: 0, averageRating: 0,
    accessStatus: "Open Access", datePublished: "2025-03-15",
    keywords: ["metadata", "workflow", "online journals"],
    authors: [
      { firstName: "Alicia", lastName: "Valdez", affiliation: "Metro Academic Press", orcid: "0000-0002-5555-6666", isCorresponding: true }
    ]
  },
  {
    journalKey: "applied-computing", issueKey: null,
    title: "Online-First Article Review Workflows in Repository Systems", doi: "10.5555/jac.online.2026.001",
    abstract: "This online-first article outlines a review workflow for repository systems where article metadata is available before final volume and issue assignment.",
    pageStart: null, pageEnd: null, articleUrl: null,
    pdfFilePath: null,
    citationCount: 0, downloadCount: 0, viewCount: 0, averageRating: 0,
    accessStatus: "Open Access", datePublished: "2026-01-12",
    keywords: ["online first", "repository", "workflow"],
    authors: [
      { firstName: "Tessa", lastName: "Molina", affiliation: "Metro State University", orcid: "0000-0005-1111-2222", isCorresponding: true }
    ]
  },
  {
    journalKey: "education-review", issueKey: "education-review-8-1",
    title: "Student Research Discovery in Web-Based Catalogs", doi: "10.5555/per.2025.003",
    abstract: "The study examines how students use search terms, filters, and record summaries when locating research articles in a web-based academic catalog.",
    pageStart: "41", pageEnd: "58", articleUrl: null,
    pdfFilePath: null,
    citationCount: 0, downloadCount: 0, viewCount: 0, averageRating: 0,
    accessStatus: "Restricted", datePublished: "2025-06-20",
    keywords: ["student research", "catalogs", "discovery"],
    authors: [
      { firstName: "Janelle", lastName: "Lim", affiliation: "Learning Futures Institute", orcid: "0000-0002-7777-8888", isCorresponding: true },
      { firstName: "Marco", lastName: "Villanueva", affiliation: "East Bay College", orcid: "0000-0002-9999-1111" }
    ]
  },
  {
    journalKey: "education-review", issueKey: "education-review-8-1",
    title: "Assessment Notes from Remote Learning Courses", doi: "10.5555/per.2025.021",
    abstract: "This paper summarizes assessment patterns from remote learning courses and documents common issues in feedback timing, rubric clarity, and student participation.",
    pageStart: "59", pageEnd: "73", articleUrl: null,
    pdfFilePath: null,
    citationCount: 0, downloadCount: 0, viewCount: 0, averageRating: 0,
    accessStatus: "Open Access", datePublished: "2025-06-20",
    keywords: ["assessment", "remote learning", "rubrics"],
    authors: [
      { firstName: "Leah", lastName: "Mendoza", affiliation: "Southern Teaching College", orcid: "0000-0003-1111-2222", isCorresponding: true }
    ]
  },
  {
    journalKey: "public-health", issueKey: "public-health-5-2",
    title: "Community Clinic Data for Preventive Care Planning", doi: "10.5555/php.2024.008",
    abstract: "Clinic visit data is used to identify preventive care gaps and support practical planning for outreach schedules in underserved communities.",
    pageStart: "101", pageEnd: "118", articleUrl: null,
    pdfFilePath: null,
    citationCount: 0, downloadCount: 0, viewCount: 0, averageRating: 0,
    accessStatus: "Restricted", datePublished: "2024-09-10",
    keywords: ["preventive care", "community clinic", "planning"],
    authors: [
      { firstName: "Ramon", lastName: "Flores", affiliation: "Community Health Research Center", orcid: "0000-0003-3333-4444", isCorresponding: true },
      { firstName: "Nina", lastName: "Bautista", affiliation: "City Public Health Office", orcid: "0000-0003-5555-6667" }
    ]
  },
  {
    journalKey: "public-health", issueKey: "public-health-5-2",
    title: "Health Information Access Among First-Year Students", doi: "10.5555/php.2024.019",
    abstract: "A campus survey highlights where first-year students look for health information and which sources they trust for routine wellness decisions.",
    pageStart: "119", pageEnd: "134", articleUrl: null,
    pdfFilePath: null,
    citationCount: 0, downloadCount: 0, viewCount: 0, averageRating: 0,
    accessStatus: "Open Access", datePublished: "2024-09-10",
    keywords: ["health information", "students", "wellness"],
    authors: [
      { firstName: "Irene", lastName: "Navarro", affiliation: "Metro State University", orcid: "0000-0003-7777-8888", isCorresponding: true }
    ]
  },
  {
    journalKey: "environmental-systems", issueKey: "environmental-systems-9-1",
    title: "Low-Cost Sensors for Campus Air Quality Monitoring", doi: "10.5555/esj.2025.004",
    abstract: "The article reports on a pilot deployment of low-cost air quality sensors and describes calibration issues found during campus monitoring.",
    pageStart: "5", pageEnd: "22", articleUrl: null,
    pdfFilePath: null,
    citationCount: 0, downloadCount: 0, viewCount: 0, averageRating: 0,
    accessStatus: "Restricted", datePublished: "2025-02-28",
    keywords: ["air quality", "sensors", "campus monitoring"],
    authors: [
      { firstName: "Gabriel", lastName: "Tan", affiliation: "Greenfield Research Network", orcid: "0000-0004-1111-2222", isCorresponding: true },
      { firstName: "Sofia", lastName: "Ramos", affiliation: "Metro State University", orcid: "0000-0004-3333-4444" }
    ]
  },
  {
    journalKey: "environmental-systems", issueKey: "environmental-systems-9-1",
    title: "Water Use Records for Small Research Facilities", doi: "10.5555/esj.2025.017",
    abstract: "A record-keeping model is presented for small research facilities that need to track water use and identify opportunities for conservation.",
    pageStart: "23", pageEnd: "39", articleUrl: null,
    pdfFilePath: null,
    citationCount: 0, downloadCount: 0, viewCount: 0, averageRating: 0,
    accessStatus: "Open Access", datePublished: "2025-02-28",
    keywords: ["water use", "records", "conservation"],
    authors: [
      { firstName: "Camille", lastName: "Ortega", affiliation: "Greenfield Research Network", orcid: "0000-0004-5555-6666", isCorresponding: true }
    ]
  }
];

export async function seedInitialData(pool, adminUsername, adminEmail, adminPassword) {
  const journalIds = await insertJournals(pool);
  const volumeIds = await insertVolumes(pool, journalIds);
  const issueIds = await insertIssues(pool, journalIds, volumeIds);
  await insertArticles(pool, journalIds, issueIds);
  await insertAnnouncements(pool);
  await insertAdminUser(pool, adminUsername, adminEmail, adminPassword);
  await pool.query(
    "INSERT INTO trusted_domains (domain) VALUES ($1) ON CONFLICT (domain) DO NOTHING",
    ["students.example.edu"]
  );
}

async function insertJournals(pool) {
  const ids = new Map();
  for (const j of journals) {
    const result = await pool.query(
      `INSERT INTO journals (title, abbreviation, print_issn, online_issn, publisher_name, place_of_publication, journal_url, subject_area, description, default_cover_image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [j.title, j.abbreviation, j.printIssn, j.onlineIssn, j.publisherName, j.placeOfPublication, j.journalUrl, j.subjectArea, j.description, j.defaultCoverImage]
    );
    ids.set(j.key, result.rows[0].id);
  }
  return ids;
}

async function insertVolumes(pool, journalIds) {
  const ids = new Map();
  for (const v of volumes) {
    const result = await pool.query(
      `INSERT INTO journal_volumes (journal_id, volume_number, publication_year) VALUES ($1, $2, $3) RETURNING id`,
      [journalIds.get(v.journalKey), v.volumeNumber, v.publicationYear]
    );
    ids.set(v.key, result.rows[0].id);
  }
  return ids;
}

async function insertIssues(pool, journalIds, volumeIds) {
  const ids = new Map();
  for (const i of issues) {
    const result = await pool.query(
      `INSERT INTO journal_issues (journal_id, volume_id, issue_number, issue_title, publication_month, date_published, issue_cover_image, issue_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [journalIds.get(i.journalKey), volumeIds.get(i.volumeKey), i.issueNumber, i.issueTitle, i.publicationMonth, i.datePublished, i.issueCoverImage, i.issueUrl]
    );
    ids.set(i.key, result.rows[0].id);
  }
  return ids;
}

async function insertArticles(pool, journalIds, issueIds) {
  for (const a of articles) {
    const journalId = journalIds.get(a.journalKey);
    const issueId = a.issueKey ? issueIds.get(a.issueKey) : null;

    const articleResult = await pool.query(
      `INSERT INTO articles (journal_id, issue_id, title, doi, abstract, page_start, page_end, article_url, pdf_file_path, citation_count, download_count, view_count, average_rating, access_status, date_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,
      [journalId, issueId, a.title, a.doi, a.abstract, a.pageStart, a.pageEnd, a.articleUrl, a.pdfFilePath, a.citationCount, a.downloadCount, a.viewCount, a.averageRating, a.accessStatus, a.datePublished]
    );
    const articleId = articleResult.rows[0].id;

    for (let index = 0; index < a.authors.length; index++) {
      const author = a.authors[index];
      const orcid = author.orcid ? `https://orcid.org/${author.orcid}` : null;
      const displayName = [author.firstName, author.lastName].filter(Boolean).join(" ");

      let authorId;
      if (orcid) {
        const existing = await pool.query("SELECT id FROM authors WHERE orcid = $1 LIMIT 1", [orcid]);
        if (existing.rows.length > 0) {
          authorId = existing.rows[0].id;
        }
      }
      if (!authorId) {
        const inserted = await pool.query(
          `INSERT INTO authors (display_name, first_name, middle_name, last_name, suffix, affiliation, orcid)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [displayName, author.firstName, null, author.lastName, null, author.affiliation ?? null, orcid]
        );
        authorId = inserted.rows[0].id;
      }

      await pool.query(
        `INSERT INTO article_authors (article_id, author_id, author_order, is_corresponding) VALUES ($1, $2, $3, $4)`,
        [articleId, authorId, index + 1, author.isCorresponding ? true : false]
      );
    }

    for (const keyword of a.keywords) {
      const kwResult = await pool.query(
        `INSERT INTO keywords (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [keyword.trim().toLowerCase()]
      );
      await pool.query(
        `INSERT INTO article_keywords (article_id, keyword_id) VALUES ($1, $2)`,
        [articleId, kwResult.rows[0].id]
      );
    }
  }
}

async function insertAnnouncements(pool) {
  for (const a of announcements) {
    await pool.query(
      `INSERT INTO announcements (label, title, summary, href, link_label, publish_date, status, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [a.label, a.title, a.summary, a.href, a.linkLabel, a.publishDate, a.status, a.sortOrder]
    );
  }
}

async function insertAdminUser(pool, username, email, password) {
  await pool.query(
    `INSERT INTO admin_users (username, email, display_name, password_hash, role, account_status, must_change_password, is_active)
     VALUES ($1, $2, $3, $4, 'Super Admin', 'active', true, true)`,
    [username.trim().toLowerCase(), email.trim().toLowerCase(), "Repository Administrator", hashPassword(password)]
  );
}
