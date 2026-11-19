import { getPool, closePool, runMigrations } from "./database.js";
import { hashPassword } from "../auth/password.js";

if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOWED !== "true") {
  console.error("seed.js must not be run in production — it drops and recreates all data.");
  process.exit(1);
}

const journals = [
  {
    key: "applied-computing",
    title: "Journal of Applied Computing",
    abbreviation: "J. Appl. Comput.",
    printIssn: "3021-1148",
    onlineIssn: "3021-1149",
    publisherName: "Metro Academic Press",
    placeOfPublication: "Manila, Philippines",
    journalUrl: "https://example.edu/journals/applied-computing",
    subjectArea: "Computing & Information Technology",
    description:
      "Peer-reviewed studies on practical software systems, human-computer interaction, and data-driven services.",
    defaultCoverImage:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=80"
  },
  {
    key: "education-review",
    title: "Philippine Education Review",
    abbreviation: "Philipp. Educ. Rev.",
    printIssn: "3021-2047",
    onlineIssn: "3021-2048",
    publisherName: "Learning Futures Institute",
    placeOfPublication: "Quezon City, Philippines",
    journalUrl: "https://example.edu/journals/education-review",
    subjectArea: "Interdisciplinary",
    description:
      "Research on classroom practice, curriculum development, assessment, and learner support.",
    defaultCoverImage:
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1000&q=80"
  },
  {
    key: "public-health",
    title: "Public Health Perspectives",
    abbreviation: "Public Health Perspect.",
    printIssn: "3021-3372",
    onlineIssn: "3021-3373",
    publisherName: "Community Health Research Center",
    placeOfPublication: "Cebu City, Philippines",
    journalUrl: "https://example.edu/journals/public-health-perspectives",
    subjectArea: "Psychology & Social Sciences",
    description:
      "Applied public health research focused on local service delivery and community outcomes.",
    defaultCoverImage:
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1000&q=80"
  },
  {
    key: "environmental-systems",
    title: "Environmental Systems Journal",
    abbreviation: "Environ. Syst. J.",
    printIssn: "3021-4496",
    onlineIssn: "3021-4497",
    publisherName: "Greenfield Research Network",
    placeOfPublication: "Davao City, Philippines",
    journalUrl: "https://example.edu/journals/environmental-systems",
    subjectArea: "Engineering",
    description:
      "Studies on sustainable systems, environmental monitoring, and resource management.",
    defaultCoverImage:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1000&q=80"
  },
  {
    key: "business-accountancy",
    title: "Journal of Business Administration and Accountancy",
    abbreviation: "J. Bus. Admin. Account.",
    printIssn: "3021-5100",
    onlineIssn: "3021-5101",
    publisherName: "Sample University Research and Publications",
    placeOfPublication: "Sample City, Philippines",
    subjectArea: "Business & Accountancy",
    description:
      "Research on financial management, accounting systems, marketing strategy, and business administration in local and regional contexts."
  },
  {
    key: "multimedia-arts",
    title: "Journal of Multimedia Arts and Digital Innovation",
    abbreviation: "J. Multimed. Arts Digit. Innov.",
    printIssn: "3021-5200",
    onlineIssn: "3021-5201",
    publisherName: "Sample University Research and Publications",
    placeOfPublication: "Sample City, Philippines",
    subjectArea: "Multimedia & Design",
    description:
      "Studies on digital media production, visual communication, interactive design, and multimedia applications in education and industry."
  },
  {
    key: "communication-media",
    title: "Journal of Communication and Media Studies",
    abbreviation: "J. Commun. Media Stud.",
    printIssn: "3021-5300",
    onlineIssn: "3021-5301",
    publisherName: "Sample University Research and Publications",
    placeOfPublication: "Sample City, Philippines",
    subjectArea: "Communication & Media",
    description:
      "Research on journalism, broadcast media, social media, public relations, and communication practices in Philippine contexts."
  },
  {
    key: "architecture-built",
    title: "Journal of Architecture and Built Environment Studies",
    abbreviation: "J. Archit. Built Environ.",
    printIssn: "3021-5400",
    onlineIssn: "3021-5401",
    publisherName: "Sample University Research and Publications",
    placeOfPublication: "Sample City, Philippines",
    subjectArea: "Architecture & Built Environment",
    description:
      "Applied research on architectural design, sustainable construction, urban planning, and the built environment in tropical and Philippine settings."
  }
];

const volumes = [
  { key: "applied-computing-12", journalKey: "applied-computing", volumeNumber: "12", publicationYear: 2025 },
  { key: "education-review-8", journalKey: "education-review", volumeNumber: "8", publicationYear: 2025 },
  { key: "public-health-5", journalKey: "public-health", volumeNumber: "5", publicationYear: 2024 },
  { key: "environmental-systems-9", journalKey: "environmental-systems", volumeNumber: "9", publicationYear: 2025 },
  { key: "business-accountancy-1", journalKey: "business-accountancy", volumeNumber: "1", publicationYear: 2026 },
  { key: "multimedia-arts-1", journalKey: "multimedia-arts", volumeNumber: "1", publicationYear: 2026 },
  { key: "communication-media-1", journalKey: "communication-media", volumeNumber: "1", publicationYear: 2026 },
  { key: "architecture-built-1", journalKey: "architecture-built", volumeNumber: "1", publicationYear: 2026 }
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
  },
  {
    key: "business-accountancy-1-1", journalKey: "business-accountancy", volumeKey: "business-accountancy-1",
    issueNumber: "1", issueTitle: "Financial Systems and Business Practices", publicationMonth: 3,
    datePublished: "2026-03-01"
  },
  {
    key: "multimedia-arts-1-1", journalKey: "multimedia-arts", volumeKey: "multimedia-arts-1",
    issueNumber: "1", issueTitle: "Digital Media and Creative Technologies", publicationMonth: 3,
    datePublished: "2026-03-01"
  },
  {
    key: "communication-media-1-1", journalKey: "communication-media", volumeKey: "communication-media-1",
    issueNumber: "1", issueTitle: "Media Literacy and Digital Communication", publicationMonth: 3,
    datePublished: "2026-03-01"
  },
  {
    key: "architecture-built-1-1", journalKey: "architecture-built", volumeKey: "architecture-built-1",
    issueNumber: "1", issueTitle: "Sustainable Design and Urban Development", publicationMonth: 3,
    datePublished: "2026-03-01"
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
    pageStart: "1", pageEnd: "16", articleUrl: "https://example.edu/articles/search-interfaces",
    pdfFilePath: "https://example.edu/pdfs/search-interfaces.pdf",
    citationCount: 12, downloadCount: 248, viewCount: 1430, averageRating: 4.6,
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
    pageStart: "17", pageEnd: "31", articleUrl: "https://example.edu/articles/lightweight-metadata-workflows",
    pdfFilePath: "https://example.edu/pdfs/lightweight-metadata-workflows.pdf",
    citationCount: 9, downloadCount: 190, viewCount: 1044, averageRating: 4.4,
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
    pageStart: null, pageEnd: null, articleUrl: "https://example.edu/articles/online-first-review-workflows",
    pdfFilePath: "https://example.edu/pdfs/online-first-review-workflows.pdf",
    citationCount: 1, downloadCount: 42, viewCount: 219, averageRating: 4.3,
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
    pageStart: "41", pageEnd: "58", articleUrl: "https://example.edu/articles/student-research-discovery",
    pdfFilePath: "https://example.edu/pdfs/student-research-discovery.pdf",
    citationCount: 7, downloadCount: 176, viewCount: 988, averageRating: 4.5,
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
    pageStart: "59", pageEnd: "73", articleUrl: "https://example.edu/articles/assessment-notes-remote-learning",
    pdfFilePath: "https://example.edu/pdfs/assessment-notes-remote-learning.pdf",
    citationCount: 4, downloadCount: 132, viewCount: 801, averageRating: 4.1,
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
    pageStart: "101", pageEnd: "118", articleUrl: "https://example.edu/articles/community-clinic-data",
    pdfFilePath: "https://example.edu/pdfs/community-clinic-data.pdf",
    citationCount: 18, downloadCount: 326, viewCount: 2119, averageRating: 4.7,
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
    pageStart: "119", pageEnd: "134", articleUrl: "https://example.edu/articles/health-information-access",
    pdfFilePath: "https://example.edu/pdfs/health-information-access.pdf",
    citationCount: 6, downloadCount: 144, viewCount: 920, averageRating: 4.2,
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
    pageStart: "5", pageEnd: "22", articleUrl: "https://example.edu/articles/low-cost-air-quality-sensors",
    pdfFilePath: "https://example.edu/pdfs/low-cost-air-quality-sensors.pdf",
    citationCount: 15, downloadCount: 287, viewCount: 1577, averageRating: 4.8,
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
    pageStart: "23", pageEnd: "39", articleUrl: "https://example.edu/articles/water-use-records",
    pdfFilePath: "https://example.edu/pdfs/water-use-records.pdf",
    citationCount: 5, downloadCount: 111, viewCount: 744, averageRating: 4.0,
    accessStatus: "Open Access", datePublished: "2025-02-28",
    keywords: ["water use", "records", "conservation"],
    authors: [
      { firstName: "Camille", lastName: "Ortega", affiliation: "Greenfield Research Network", orcid: "0000-0004-5555-6666", isCorresponding: true }
    ]
  },
  {
    journalKey: "business-accountancy", issueKey: "business-accountancy-1-1",
    title: "Financial Reporting Practices Among Small Enterprises in the Philippines", doi: "10.5555/jbaa.2026.001",
    abstract: "This study examines the financial reporting practices of small enterprises in the CALABARZON region and identifies common gaps in compliance with Philippine Accounting Standards.",
    pageStart: "1", pageEnd: "18",
    citationCount: 3, downloadCount: 95, viewCount: 410, averageRating: 4.3,
    accessStatus: "Open Access", datePublished: "2026-03-01",
    keywords: ["financial reporting", "small enterprises", "philippine accounting"],
    authors: [{ firstName: "Ana", lastName: "Valdez", affiliation: "Sample University", orcid: "0000-0005-1001-0001", isCorresponding: true }]
  },
  {
    journalKey: "business-accountancy", issueKey: "business-accountancy-1-1",
    title: "Digital Marketing Adoption Among Local Business Owners in Laguna", doi: "10.5555/jbaa.2026.002",
    abstract: "A survey-based study on the adoption of digital marketing tools by small business owners in Laguna province, examining awareness levels, usage patterns, and perceived effectiveness.",
    pageStart: "19", pageEnd: "34",
    citationCount: 2, downloadCount: 78, viewCount: 312, averageRating: 4.1,
    accessStatus: "Restricted", datePublished: "2026-03-01",
    keywords: ["digital marketing", "consumer behavior", "laguna"],
    authors: [{ firstName: "Carlo", lastName: "Santos", affiliation: "Sample University", orcid: "0000-0005-1001-0002", isCorresponding: true }]
  },
  {
    journalKey: "multimedia-arts", issueKey: "multimedia-arts-1-1",
    title: "User Interface Design Principles for Academic Repository Systems", doi: "10.5555/jmadi.2026.001",
    abstract: "This paper reviews user interface design decisions for academic repository systems and proposes a set of principles based on usability testing with undergraduate students.",
    pageStart: "1", pageEnd: "15",
    citationCount: 4, downloadCount: 120, viewCount: 530, averageRating: 4.5,
    accessStatus: "Open Access", datePublished: "2026-03-01",
    keywords: ["ui design", "usability", "academic repositories"],
    authors: [{ firstName: "Bianca", lastName: "Lim", affiliation: "Sample University", orcid: "0000-0005-1001-0003", isCorresponding: true }]
  },
  {
    journalKey: "multimedia-arts", issueKey: "multimedia-arts-1-1",
    title: "Digital Storytelling as a Tool for Student Engagement in Higher Education", doi: "10.5555/jmadi.2026.002",
    abstract: "An exploratory study on the use of digital storytelling projects as a learning strategy in undergraduate multimedia courses, with findings on student engagement and creative output.",
    pageStart: "16", pageEnd: "29",
    citationCount: 1, downloadCount: 64, viewCount: 280, averageRating: 4.2,
    accessStatus: "Restricted", datePublished: "2026-03-01",
    keywords: ["digital storytelling", "student engagement", "multimedia"],
    authors: [{ firstName: "Rafael", lastName: "Torres", affiliation: "Sample University", orcid: "0000-0005-1001-0004", isCorresponding: true }]
  },
  {
    journalKey: "communication-media", issueKey: "communication-media-1-1",
    title: "Social Media News Consumption Among Filipino University Students", doi: "10.5555/jcms.2026.001",
    abstract: "This study investigates social media news consumption habits among Filipino university students and examines how platform choice, frequency, and trust affect information quality perceptions.",
    pageStart: "1", pageEnd: "17",
    citationCount: 5, downloadCount: 140, viewCount: 620, averageRating: 4.4,
    accessStatus: "Open Access", datePublished: "2026-03-01",
    keywords: ["social media", "news consumption", "media literacy"],
    authors: [{ firstName: "Diane", lastName: "Cruz", affiliation: "Sample University", orcid: "0000-0005-1001-0005", isCorresponding: true }]
  },
  {
    journalKey: "communication-media", issueKey: "communication-media-1-1",
    title: "Framing of Environmental Issues in Philippine Broadsheet Coverage", doi: "10.5555/jcms.2026.002",
    abstract: "A framing analysis of environmental news in three major Philippine broadsheets over a two-year period, identifying dominant frames, source reliance, and thematic patterns.",
    pageStart: "18", pageEnd: "33",
    citationCount: 3, downloadCount: 88, viewCount: 390, averageRating: 4.0,
    accessStatus: "Restricted", datePublished: "2026-03-01",
    keywords: ["framing analysis", "environmental journalism", "media"],
    authors: [{ firstName: "Miguel", lastName: "Bautista", affiliation: "Sample University", orcid: "0000-0005-1001-0006", isCorresponding: true }]
  },
  {
    journalKey: "architecture-built", issueKey: "architecture-built-1-1",
    title: "Passive Cooling Strategies in Tropical Residential Architecture", doi: "10.5555/jabes.2026.001",
    abstract: "This paper evaluates passive cooling strategies applied in residential buildings across CALABARZON and assesses their effectiveness in reducing indoor temperatures in a tropical climate.",
    pageStart: "1", pageEnd: "19",
    citationCount: 6, downloadCount: 155, viewCount: 680, averageRating: 4.6,
    accessStatus: "Open Access", datePublished: "2026-03-01",
    keywords: ["passive cooling", "tropical architecture", "sustainable design"],
    authors: [{ firstName: "Patricia", lastName: "Ocampo", affiliation: "Sample University", orcid: "0000-0005-1001-0008", isCorresponding: true }]
  },
  {
    journalKey: "architecture-built", issueKey: "architecture-built-1-1",
    title: "Urban Green Space Provision in Mid-Sized Philippine Cities", doi: "10.5555/jabes.2026.002",
    abstract: "A comparative assessment of urban green space availability in five mid-sized Philippine cities, using land use data and resident surveys to evaluate accessibility and planning outcomes.",
    pageStart: "20", pageEnd: "36",
    citationCount: 4, downloadCount: 102, viewCount: 455, averageRating: 4.3,
    accessStatus: "Restricted", datePublished: "2026-03-01",
    keywords: ["urban green space", "urban planning", "philippines"],
    authors: [{ firstName: "Kevin", lastName: "Dela Cruz", affiliation: "Sample University", orcid: "0000-0005-1001-0008", isCorresponding: true }]
  }
];

async function main() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    // Reset schema entirely, then recreate via migrations
    await client.query("DROP SCHEMA public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("GRANT ALL ON SCHEMA public TO public");
    client.release();

    await runMigrations();

    const journalIds = await insertJournals(pool);
    const volumeIds = await insertVolumes(pool, journalIds);
    const issueIds = await insertIssues(pool, journalIds, volumeIds);
    await insertArticles(pool, journalIds, issueIds);
    await insertAnnouncements(pool);
    await seedAdminUser(pool);
    await pool.query(
      "INSERT INTO trusted_domains (domain) VALUES ($1) ON CONFLICT (domain) DO NOTHING",
      ["students.example.edu"]
    );

    console.log(
      `Seeded ${journals.length} journals, ${volumes.length} volumes, ${issues.length} issues, ${articles.length} articles, ${announcements.length} announcements, 1 admin user, and trusted domains.`
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

async function insertJournals(pool) {
  const ids = new Map();
  for (const j of journals) {
    const result = await pool.query(
      `INSERT INTO journals (title, abbreviation, print_issn, online_issn, publisher_name, place_of_publication, journal_url, subject_area, description, default_cover_image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (print_issn) DO UPDATE
         SET title = EXCLUDED.title, abbreviation = EXCLUDED.abbreviation,
             online_issn = EXCLUDED.online_issn, publisher_name = EXCLUDED.publisher_name,
             place_of_publication = EXCLUDED.place_of_publication, journal_url = EXCLUDED.journal_url,
             subject_area = EXCLUDED.subject_area, description = EXCLUDED.description,
             default_cover_image = EXCLUDED.default_cover_image
       RETURNING id`,
      [j.title, j.abbreviation, j.printIssn, j.onlineIssn, j.publisherName, j.placeOfPublication, j.journalUrl ?? null, j.subjectArea, j.description, j.defaultCoverImage ?? null]
    );
    ids.set(j.key, result.rows[0].id);
  }
  return ids;
}

async function insertVolumes(pool, journalIds) {
  const ids = new Map();
  for (const v of volumes) {
    const result = await pool.query(
      `INSERT INTO journal_volumes (journal_id, volume_number, publication_year) VALUES ($1, $2, $3)
       ON CONFLICT (journal_id, volume_number) DO UPDATE SET publication_year = EXCLUDED.publication_year
       RETURNING id`,
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
       ON CONFLICT (volume_id, issue_number) DO UPDATE
         SET issue_title = EXCLUDED.issue_title, publication_month = EXCLUDED.publication_month,
             date_published = EXCLUDED.date_published, issue_cover_image = EXCLUDED.issue_cover_image,
             issue_url = EXCLUDED.issue_url
       RETURNING id`,
      [journalIds.get(i.journalKey), volumeIds.get(i.volumeKey), i.issueNumber, i.issueTitle, i.publicationMonth, i.datePublished, i.issueCoverImage ?? null, i.issueUrl ?? null]
    );
    ids.set(i.key, result.rows[0].id);
  }
  return ids;
}

async function insertArticles(pool, journalIds, issueIds) {
  for (const a of articles) {
    const journalId = a.journalKey ? journalIds.get(a.journalKey) : getJournalIdForArticle(a, journalIds);
    const issueId = a.issueKey ? issueIds.get(a.issueKey) : null;

    const articleResult = await pool.query(
      `INSERT INTO articles (journal_id, issue_id, title, doi, abstract, page_start, page_end, article_url, pdf_file_path, citation_count, download_count, view_count, average_rating, access_status, date_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (doi) DO UPDATE
         SET title = EXCLUDED.title, abstract = EXCLUDED.abstract, page_start = EXCLUDED.page_start,
             page_end = EXCLUDED.page_end, article_url = EXCLUDED.article_url,
             pdf_file_path = EXCLUDED.pdf_file_path, citation_count = EXCLUDED.citation_count,
             download_count = EXCLUDED.download_count, view_count = EXCLUDED.view_count,
             average_rating = EXCLUDED.average_rating, access_status = EXCLUDED.access_status,
             date_published = EXCLUDED.date_published
       RETURNING id`,
      [journalId, issueId, a.title, a.doi, a.abstract, a.pageStart ?? null, a.pageEnd ?? null, a.articleUrl ?? null, a.pdfFilePath ?? null, a.citationCount, a.downloadCount, a.viewCount, a.averageRating, a.accessStatus, a.datePublished]
    );
    const articleId = articleResult.rows[0].id;

    for (let index = 0; index < a.authors.length; index++) {
      const author = a.authors[index];
      const orcid = normalizeOrcid(author.orcid);
      const displayName = formatAuthorName(author);

      let authorId;
      if (orcid) {
        const existing = await pool.query("SELECT id FROM authors WHERE orcid = $1 LIMIT 1", [orcid]);
        if (existing.rows.length > 0) {
          authorId = existing.rows[0].id;
        }
      }
      if (!authorId) {
        if (!orcid) {
          const byIdentity = await pool.query(
            `SELECT id FROM authors WHERE display_name = $1 AND first_name = $2 AND last_name = $3 AND COALESCE(affiliation, '') = COALESCE($4, '') LIMIT 1`,
            [displayName, author.firstName, author.lastName, author.affiliation ?? null]
          );
          if (byIdentity.rows.length > 0) {
            authorId = byIdentity.rows[0].id;
          }
        }
        if (!authorId) {
          const inserted = await pool.query(
            `INSERT INTO authors (display_name, first_name, middle_name, last_name, suffix, affiliation, orcid) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [displayName, author.firstName, author.middleName ?? null, author.lastName, author.suffix ?? null, author.affiliation ?? null, orcid]
          );
          authorId = inserted.rows[0].id;
        }
      }

      await pool.query(
        `INSERT INTO article_authors (article_id, author_id, author_order, is_corresponding) VALUES ($1, $2, $3, $4)
         ON CONFLICT (article_id, author_id) DO UPDATE
           SET author_order = EXCLUDED.author_order, is_corresponding = EXCLUDED.is_corresponding`,
        [articleId, authorId, index + 1, author.isCorresponding ? true : false]
      );
    }

    for (const keyword of a.keywords) {
      const kwResult = await pool.query(
        `INSERT INTO keywords (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [normalizeKeyword(keyword)]
      );
      await pool.query(
        `INSERT INTO article_keywords (article_id, keyword_id) VALUES ($1, $2)
         ON CONFLICT (article_id, keyword_id) DO NOTHING`,
        [articleId, kwResult.rows[0].id]
      );
    }
  }
}

async function insertAnnouncements(pool) {
  for (const a of announcements) {
    await pool.query(
      `INSERT INTO announcements (label, title, summary, href, link_label, publish_date, status, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (title, publish_date) DO UPDATE
         SET label = EXCLUDED.label, summary = EXCLUDED.summary, href = EXCLUDED.href,
             link_label = EXCLUDED.link_label, status = EXCLUDED.status, sort_order = EXCLUDED.sort_order`,
      [a.label, a.title, a.summary, a.href, a.linkLabel, a.publishDate, a.status, a.sortOrder]
    );
  }
}

async function seedAdminUser(pool) {
  const username = normalizeLoginValue(process.env.ADMIN_USERNAME ?? "admin");
  const email = normalizeLoginValue(process.env.ADMIN_EMAIL ?? "admin@example.com");
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    throw new Error("ADMIN_PASSWORD must be set in server/.env.");
  }

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
  }

  await pool.query(
    `INSERT INTO admin_users (username, email, display_name, password_hash, role, account_status, must_change_password, is_active)
     VALUES ($1, $2, $3, $4, 'Super Admin', 'active', true, true)
     ON CONFLICT (username) DO UPDATE
       SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash,
           must_change_password = EXCLUDED.must_change_password`,
    [username, email, "Repository Administrator", hashPassword(password)]
  );
}

function formatAuthorName(author) {
  return [author.firstName, author.middleName, author.lastName, author.suffix].filter(Boolean).join(" ");
}

function normalizeKeyword(keyword) {
  return keyword.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeOrcid(orcid) {
  if (!orcid) return null;
  const trimmed = orcid.trim();
  return trimmed.startsWith("https://orcid.org/") ? trimmed : `https://orcid.org/${trimmed}`;
}

function normalizeLoginValue(value) {
  return value.trim().toLowerCase();
}

function getJournalIdForArticle(article, journalIds) {
  const issue = issues.find((i) => i.key === article.issueKey);
  return issue ? journalIds.get(issue.journalKey) : null;
}

main();
