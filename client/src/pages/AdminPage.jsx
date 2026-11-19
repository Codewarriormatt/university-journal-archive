import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faArrowUpRightFromSquare,
  faBook,
  faBullhorn,
  faChevronDown,
  faCircleCheck,
  faCircleInfo,
  faClock,
  faEye,
  faEyeSlash,
  faFileLines,
  faGauge,
  faKey,
  faLayerGroup,
  faMedal,
  faNewspaper,
  faRightFromBracket,
  faShield,
  faTag,
  faUserGroup,
  faUserShield,
  faUsers,
  faClipboardList
} from "@fortawesome/free-solid-svg-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  bulkExpireReaderAccounts,
  changeAdminPassword,
  createAdminItem,
  deleteAdminItem,
  fetchAdminDashboard,
  fetchAdminItem,
  fetchAdminList,
  fetchAdminOptions,
  fetchAdminSession,
  fetchAuditLogs,
  loginAdmin,
  logoutAdmin,
  regenerateJournalInsight,
  updateAdminItem
} from "../api/adminApi.js";
import { FileUploadField } from "../components/FileUploadField.jsx";

const RESOURCES = [
  { key: "accounts", label: "Accounts", singular: "Account", sort: "name_asc", superAdminOnly: true },
  { key: "journals", label: "Journals", singular: "Journal", sort: "title_asc" },
  { key: "volumes", label: "Volumes", singular: "Volume", sort: "newest" },
  { key: "issues", label: "Issues", singular: "Issue", sort: "newest" },
  { key: "articles", label: "Articles", singular: "Article", sort: "newest" },
  { key: "announcements", label: "Announcements", singular: "Announcement", sort: "newest" },
  { key: "authors", label: "Authors", singular: "Author", sort: "name_asc" },
  { key: "keywords", label: "Keywords", singular: "Keyword", sort: "name_asc" }
];

const ADMIN_MEDAL_COLORS = {
  1: { color: "#92650a", bg: "#fef3c7", border: "#fcd34d" },
  2: { color: "#4b5563", bg: "#f1f5f9", border: "#cbd5e1" },
  3: { color: "#7c3a1e", bg: "#fef0e7", border: "#fdba74" }
};

const TABLE_COLUMNS = {
  journals: [
    { header: "Title", getValue: (item) => item.title, maxWidth: "280px" },
    { header: "Publisher", getValue: (item) => item.publisherName || "—", maxWidth: "180px" },
    { header: "ISSN", getValue: (item) => formatIssnPair(item.printIssn, item.onlineIssn) },
    { header: "Subject", getValue: (item) => item.subjectArea || "—" },
    { header: "Issues", getValue: (item) => item.issueCount ?? 0 },
    { header: "Articles", getValue: (item) => item.articleCount ?? 0 },
    { header: "Updated", getValue: (item) => item.updatedAt, type: "datetime" }
  ],
  volumes: [
    { header: "Journal", getValue: (item) => item.journalTitle || "—", maxWidth: "220px" },
    { header: "Volume", getValue: (item) => `Vol. ${item.volumeNumber}` },
    { header: "Volume year", getValue: (item) => item.publicationYear || "—" },
    { header: "Volume title", getValue: (item) => item.volumeTitle || "—", maxWidth: "220px" },
    { header: "Issues", getValue: (item) => item.issueCount ?? 0 },
    { header: "Updated", getValue: (item) => item.updatedAt, type: "datetime" }
  ],
  issues: [
    { header: "Journal", getValue: (item) => item.journalTitle || "—", maxWidth: "220px" },
    { header: "Vol / Issue", getValue: (item) => `Vol. ${item.volumeNumber}, No. ${item.issueNumber}` },
    { header: "Issue title", getValue: (item) => item.issueTitle || "—", maxWidth: "260px" },
    { header: "Volume year", getValue: (item) => item.publicationYear || "—" },
    { header: "Date published", getValue: (item) => item.datePublished, type: "date" },
    { header: "Articles", getValue: (item) => item.articleCount ?? 0 }
  ],
  articles: [
    { header: "Title", getValue: (item) => item.title, maxWidth: "300px" },
    { header: "Authors", getValue: (item) => item.authors || "—", maxWidth: "220px" },
    { header: "Journal", getValue: (item) => item.journalTitle || "—", maxWidth: "190px" },
    { header: "Vol / Issue", getValue: (item) => item.volume ? `Vol. ${item.volume}, No. ${item.issueNumber}` : "Online first" },
    { header: "Catalog year", getValue: (item) => item.year || "—" },
    { header: "Date published", getValue: (item) => item.datePublished, type: "date" },
    { header: "Access", getValue: (item) => item.accessStatus, type: "badge" },
    { header: "Updated", getValue: (item) => item.updatedAt, type: "datetime" }
  ],
  accounts: [
    { header: "Name", getValue: (item) => item.displayName },
    { header: "Username", getValue: (item) => item.username },
    { header: "Email", getValue: (item) => item.email || "—" },
    { header: "Role", getValue: (item) => item.role, type: "badge" },
    { header: "Status", getValue: (item) => item.accountStatus, type: "badge" },
    { header: "Password change", getValue: (item) => item.mustChangePassword ? "Required" : "No" },
    { header: "Updated", getValue: (item) => item.updatedAt, type: "datetime" }
  ],
  announcements: [
    { header: "Title", getValue: (item) => item.title, maxWidth: "260px" },
    { header: "Label", getValue: (item) => item.label },
    { header: "Status", getValue: (item) => item.status, type: "badge" },
    { header: "Publish date", getValue: (item) => item.publishDate, type: "date" },
    { header: "Summary", getValue: (item) => item.summary, maxWidth: "320px" },
    { header: "Link", getValue: (item) => item.href ? (item.linkLabel || item.href) : "—", maxWidth: "200px" },
    { header: "Sort", getValue: (item) => item.sortOrder ?? 0 },
    { header: "Updated", getValue: (item) => item.updatedAt, type: "datetime" }
  ],
  authors: [
    { header: "Name", getValue: (item) => item.displayName },
    { header: "Affiliation", getValue: (item) => item.affiliation || "—", maxWidth: "260px" },
    { header: "ORCID", getValue: (item) => item.orcid || "—" },
    { header: "Articles", getValue: (item) => item.articleCount ?? 0 },
    { header: "Updated", getValue: (item) => item.updatedAt, type: "datetime" }
  ],
  keywords: [
    { header: "Keyword", getValue: (item) => item.name },
    { header: "Articles", getValue: (item) => item.articleCount ?? 0 },
    { header: "Updated", getValue: (item) => item.updatedAt, type: "datetime" }
  ]
};

const SORT_OPTIONS = {
  accounts: [
    ["name_asc", "Name A-Z"],
    ["name_desc", "Name Z-A"],
    ["role", "Role"],
    ["status", "Status"],
    ["updated", "Recently updated"]
  ],
  journals: [
    ["title_asc", "Title A-Z"],
    ["title_desc", "Title Z-A"],
    ["updated", "Recently updated"]
  ],
  volumes: [
    ["newest", "Newest"],
    ["oldest", "Oldest"],
    ["journal", "Journal"],
    ["updated", "Recently updated"]
  ],
  issues: [
    ["newest", "Newest"],
    ["oldest", "Oldest"],
    ["journal", "By journal"],
    ["volume", "By volume"],
    ["updated", "Recently updated"]
  ],
  articles: [
    ["newest", "Newest"],
    ["oldest", "Oldest"],
    ["title_asc", "Title A-Z"],
    ["title_desc", "Title Z-A"],
    ["updated", "Recently updated"]
  ],
  authors: [
    ["name_asc", "Name A-Z"],
    ["name_desc", "Name Z-A"],
    ["updated", "Recently updated"]
  ],
  keywords: [
    ["name_asc", "Name A-Z"],
    ["name_desc", "Name Z-A"],
    ["most_used", "Most used"],
    ["updated", "Recently updated"]
  ],
  announcements: [
    ["newest", "Newest publish date"],
    ["oldest", "Oldest publish date"],
    ["title_asc", "Title A-Z"],
    ["status", "Status"],
    ["updated", "Recently updated"]
  ]
};

const ARTICLE_ACCESS = ["Open Access", "Restricted", "Unavailable"];
const ANNOUNCEMENT_LABELS = [
  "Repository update",
  "Access notice",
  "Metadata quality",
  "Service notice",
  "Event",
  "Maintenance"
];
const ANNOUNCEMENT_STATUSES = ["Draft", "Published", "Archived"];
const ACCOUNT_ROLES = ["Super Admin", "Content Admin", "Member"];
const ACCOUNT_STATUSES = ["active", "disabled"];
const OPTION_RESOURCES = new Set(["journals", "volumes", "issues", "articles", "authors", "keywords"]);
const PAGE_SIZE = 10;

const SEARCH_PLACEHOLDERS = {
  journals: "Search by title, publisher, or ISSN…",
  volumes: "Search by journal title or volume number…",
  issues: "Search by journal, issue title, or date…",
  articles: "Search by title, author, keyword, or DOI…",
  authors: "Search by name or affiliation…",
  keywords: "Search keywords…",
  announcements: "Search by title or summary…",
  accounts: "Search by name or username…"
};

const BLANK_FORMS = {
  journals: {
    title: "",
    abbreviation: "",
    printIssn: "",
    onlineIssn: "",
    publisherName: "",
    placeOfPublication: "",
    journalUrl: "",
    subjectArea: "",
    description: "",
    defaultCoverImage: ""
  },
  volumes: {
    journalId: "",
    volumeNumber: "",
    publicationYear: "",
    volumeTitle: ""
  },
  issues: {
    journalId: "",
    volumeId: "",
    issueNumber: "",
    issueTitle: "",
    publicationMonth: "",
    datePublished: "",
    issueCoverImage: "",
    issueUrl: ""
  },
  articles: {
    journalId: "",
    issueId: "",
    title: "",
    doi: "",
    abstract: "",
    pageStart: "",
    pageEnd: "",
    articleUrl: "",
    pdfFilePath: "",
    accessStatus: "Restricted",
    datePublished: "",
    authors: [],
    keywords: []
  },
  authors: {
    displayName: "",
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    affiliation: "",
    orcid: ""
  },
  keywords: {
    name: ""
  },
  announcements: {
    label: "Repository update",
    title: "",
    summary: "",
    href: "",
    linkLabel: "",
    publishDate: new Date().toISOString().slice(0, 10),
    status: "Draft",
    sortOrder: 0,
    image: ""
  },
  accounts: {
    username: "",
    email: "",
    displayName: "",
    role: "Member",
    accountStatus: "active",
    mustChangePassword: true,
    password: ""
  }
};

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ key: "dashboard", label: "Dashboard", icon: faGauge }]
  },
  {
    label: "Content",
    items: [
      { key: "journals", label: "Journals", icon: faBook },
      { key: "volumes", label: "Volumes", icon: faLayerGroup },
      { key: "issues", label: "Issues", icon: faNewspaper },
      { key: "articles", label: "Articles", icon: faFileLines },
      { key: "announcements", label: "Announcements", icon: faBullhorn }
    ]
  },
  {
    label: "Metadata",
    items: [
      { key: "authors", label: "Authors", icon: faUsers },
      { key: "keywords", label: "Keywords", icon: faTag }
    ]
  },
  {
    label: "Account",
    items: [
      { key: "password", label: "Password", icon: faKey }
    ]
  },
  {
    label: "Help",
    items: [
      { key: "guide", label: "Admin Guide", icon: faCircleInfo }
    ]
  }
];

const SUPER_ADMIN_NAV = {
  label: "Users",
  items: [
    { key: "accounts", label: "Accounts", icon: faUserShield },
    { key: "trusted-domains", label: "Trusted Domains", icon: faShield },
    { key: "reader-accounts", label: "Reader Accounts", icon: faUserGroup },
    { key: "audit-logs", label: "Audit Logs", icon: faClipboardList }
  ]
};

const STAT_CONFIG = [
  { key: "journals", label: "Journals", icon: faBook, accent: "#2B3990", bg: "#dde2f7", section: "journals" },
  { key: "issues", label: "Issues", icon: faNewspaper, accent: "#b8922e", bg: "#faefd1", section: "issues" },
  { key: "articles", label: "Articles", icon: faFileLines, accent: "#1e2a7a", bg: "#dde2f7", section: "articles" },
  { key: "onlineFirstArticles", label: "Online First", icon: faClock, accent: "#D4B04A", bg: "#faefd1", section: "articles" },
  { key: "authors", label: "Authors", icon: faUsers, accent: "#3d50b0", bg: "#f0f2fc", section: "authors" },
  { key: "keywords", label: "Keywords", icon: faTag, accent: "#9a7520", bg: "#fdf8ed", section: "keywords" },
  { key: "announcements", label: "Announcements", icon: faBullhorn, accent: "#2B3990", bg: "#f0f2fc", section: "announcements" },
  { key: "publishedAnnouncements", label: "Published Notices", icon: faCircleCheck, accent: "#0f766e", bg: "#f0fdf9", section: "announcements" }
];

const NEEDS_REVIEW_CONFIG = [
  { key: "restrictedArticlesWithoutPdf", label: "Restricted articles without PDF", section: "articles" },
  { key: "articlesWithoutPdf", label: "Articles without PDF", section: "articles" },
  { key: "articlesWithoutAuthors", label: "Articles without authors", section: "articles" },
  { key: "articlesWithoutKeywords", label: "Articles without keywords", section: "articles" },
  { key: "issuesWithoutArticles", label: "Issues without articles", section: "issues" },
  { key: "volumesWithoutIssues", label: "Volumes without issues", section: "volumes" },
  { key: "draftAnnouncements", label: "Draft announcements", section: "announcements" },
  { key: "adminPasswordChangesRequired", label: "Admin password changes required", section: "accounts" },
  { key: "expiredReaderAccounts", label: "Expired reader accounts", section: "reader-accounts" },
  { key: "disabledReaderAccounts", label: "Disabled reader accounts", section: "reader-accounts" }
];

const ACCESS_HEALTH_CONFIG = [
  { key: "activeAdmins", label: "Active admins" },
  { key: "disabledAdmins", label: "Disabled admins" },
  { key: "passwordChangeRequiredAdmins", label: "Password changes required" },
  { key: "activeReaders", label: "Active readers" },
  { key: "expiredReaders", label: "Expired readers" },
  { key: "disabledReaders", label: "Disabled readers" },
  { key: "trustedDomains", label: "Trusted domains" }
];

const ANNOUNCEMENT_HEALTH_CONFIG = [
  { key: "visibleOnHomepage", label: "Visible on homepage" },
  { key: "published", label: "Published total" },
  { key: "draft", label: "Draft" },
  { key: "archived", label: "Archived" },
  { key: "futurePublished", label: "Future published" }
];

const SECTION_LABELS = {
  dashboard: "Dashboard",
  password: "Change Password",
  guide: "Admin Guide",
  journals: "Journals",
  volumes: "Volumes",
  issues: "Issues",
  articles: "Articles",
  announcements: "Announcements",
  authors: "Authors",
  keywords: "Keywords",
  accounts: "Admin Accounts",
  "trusted-domains": "Trusted Domains",
  "reader-accounts": "Reader Accounts",
  "audit-logs": "Audit Logs"
};

export function AdminPage() {
  const [sessionStatus, setSessionStatus] = useState("loading");
  const [admin, setAdmin] = useState(null);
  const { section: activeSection = "dashboard" } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let isActive = true;

    fetchAdminSession()
      .then((data) => {
        if (isActive) {
          setAdmin(data.admin);
          setSessionStatus("ready");
        }
      })
      .catch(() => {
        if (isActive) {
          setAdmin(null);
          setSessionStatus("ready");
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (admin) {
      localStorage.setItem(
        "admin_viewing",
        JSON.stringify({ displayName: admin.displayName, role: admin.role, mustChangePassword: admin.mustChangePassword })
      );
    } else {
      localStorage.removeItem("admin_viewing");
    }
  }, [admin]);

  useEffect(() => {
    if (admin && admin.role === "Member" && !admin.mustChangePassword) {
      window.location.replace("/");
    }
  }, [admin]);

  async function handleLogout() {
    await logoutAdmin().catch(() => null);
    setAdmin(null);
    navigate("/admin");
  }

  if (sessionStatus === "loading") {
    return (
      <AdminGate>
        <p className="status-text">Checking session…</p>
      </AdminGate>
    );
  }

  if (!admin) {
    return <AdminLogin onLogin={setAdmin} />;
  }

  if (admin.mustChangePassword) {
    return (
      <AdminGate title="Change Default Password" subtitle="The seeded password must be changed before you can access management tools.">
        <PasswordChangeForm
          onChanged={(updatedAdmin) => {
            setAdmin(updatedAdmin);
            if (updatedAdmin.role !== "Member") navigate("/admin");
          }}
        />
        <button className="admin-gate__signout" type="button" onClick={handleLogout}>
          <FontAwesomeIcon icon={faRightFromBracket} /> Sign out
        </button>
      </AdminGate>
    );
  }

  if (!["Super Admin", "Content Admin"].includes(admin.role)) {
    // Member role: useEffect above handles the redirect to "/"
    return null;
  }

  const visibleResources = RESOURCES.filter(
    (resource) => !resource.superAdminOnly || admin.role === "Super Admin"
  );

  const navGroups = [
    ...NAV_GROUPS,
    ...(admin.role === "Super Admin" ? [SUPER_ADMIN_NAV] : [])
  ];

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <div className="admin-sidebar__brand-icon">
            <FontAwesomeIcon icon={faBook} />
          </div>
          <div className="admin-sidebar__brand-copy">
            <strong>University</strong>
            <span>Admin Portal</span>
          </div>
        </div>

        <nav className="admin-sidebar__nav" aria-label="Admin navigation">
          {navGroups.map((group) => (
            <div key={group.label} className="admin-sidebar__group">
              <p className="admin-sidebar__group-label">{group.label}</p>
              {group.items.map((item) => (
                <button
                  key={item.key}
                  className={`admin-sidebar__item${activeSection === item.key ? " active" : ""}`}
                  type="button"
                  onClick={() => navigate(`/admin/${item.key}`)}
                >
                  <FontAwesomeIcon icon={item.icon} className="admin-sidebar__item-icon" />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar__footer">
          <a className="admin-sidebar__back" href="/">
            <FontAwesomeIcon icon={faArrowLeft} />
            Back to site
          </a>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <h1 className="admin-topbar__title">
            {SECTION_LABELS[activeSection] ?? "Admin"}
          </h1>
          <div className="admin-topbar__actions">
            <span className="admin-topbar__user">{admin.displayName}</span>
            <span className="admin-topbar__role">{admin.role}</span>
            <button
              className="admin-topbar__btn admin-topbar__btn--ghost"
              type="button"
              onClick={handleLogout}
            >
              <FontAwesomeIcon icon={faRightFromBracket} />
              Sign out
            </button>
          </div>
        </header>

        <div className="admin-content">
          {activeSection === "dashboard" ? <AdminDashboard /> : null}
          {activeSection === "password" ? (
            <section className="admin-panel">
              <div className="admin-panel__heading">
                <div>
                  <h2>Change Password</h2>
                  <p>Update the current admin account password.</p>
                </div>
              </div>
              <PasswordChangeForm onChanged={setAdmin} />
            </section>
          ) : null}
          {activeSection === "guide" ? <AdminGuide /> : null}
          {visibleResources.map((resource) =>
            activeSection === resource.key ? (
              <ResourceManager
                key={resource.key}
                resource={resource}
                onNavigateSection={(key) => navigate(`/admin/${key}`)}
              />
            ) : null
          )}
          {activeSection === "trusted-domains" ? <TrustedDomainsManager /> : null}
          {activeSection === "reader-accounts" ? <ReaderAccountsManager /> : null}
          {activeSection === "audit-logs" ? <AuditLogsManager /> : null}
        </div>
      </div>
    </div>
  );
}

function AdminLogin({ onLogin }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [attemptsLeft, setAttemptsLeft] = useState(null);
  const [retryAfter, setRetryAfter] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!retryAfter) return;
    function tick() {
      const diff = Math.ceil((new Date(retryAfter) - Date.now()) / 1000);
      if (diff <= 0) {
        setRetryAfter(null);
        setSecondsLeft(0);
        setError(null);
        setAttemptsLeft(null);
      } else {
        setSecondsLeft(diff);
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [retryAfter]);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("saving");
    setError(null);

    try {
      const data = await loginAdmin(form);
      onLogin(data.admin);
    } catch (requestError) {
      setError(requestError);
      setStatus("idle");
      if (requestError.retryAfter) setRetryAfter(requestError.retryAfter);
      if (requestError.attemptsLeft != null) setAttemptsLeft(requestError.attemptsLeft);
    }
  }

  const isLocked = retryAfter && secondsLeft > 0;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const countdown = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <AdminGate title="Admin Sign In" subtitle="Sign in with your administrator account credentials.">
      <form className="admin-form" onSubmit={handleSubmit}>
        <Field label="Username or email" name="username" error={error} required>
          <input
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
            autoComplete="username"
            aria-required="true"
            disabled={isLocked}
          />
        </Field>
        <PasswordInput
          label="Password"
          name="password"
          value={form.password}
          onChange={(value) => setForm({ ...form, password: value })}
          autoComplete="current-password"
          error={isLocked ? null : error}
          required
          disabled={isLocked}
        />
        {isLocked ? (
          <div className="admin-alert admin-alert--error" role="alert">
            Too many failed attempts. Try again in <strong>{countdown}</strong>.
          </div>
        ) : error ? (
          <div>
            <ErrorMessage error={error} />
            {attemptsLeft != null && attemptsLeft > 0 && (
              <p style={{ marginTop: "0.25rem", fontSize: "0.85rem", color: "var(--color-text-muted, #666)" }}>
                {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining before lockout.
              </p>
            )}
          </div>
        ) : null}
        <div className="admin-form-actions">
          <button type="submit" disabled={status === "saving" || isLocked}>
            {status === "saving" ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </form>
      <a className="admin-gate__back" href="/">
        <FontAwesomeIcon icon={faArrowLeft} /> Back to site
      </a>
    </AdminGate>
  );
}

function AdminGate({ title, subtitle, children }) {
  return (
    <div className="admin-gate">
      <div className="admin-gate__card">
        <div className="admin-gate__brand">
          <div className="admin-gate__brand-icon">
            <FontAwesomeIcon icon={faBook} />
          </div>
          <span>University Journal Archive</span>
        </div>
        {title ? <h1 className="admin-gate__title">{title}</h1> : null}
        {subtitle ? <p className="admin-gate__subtitle">{subtitle}</p> : null}
        {children}
      </div>
    </div>
  );
}

function PasswordChangeForm({ onChanged }) {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("saving");
    setError(null);
    setMessage("");

    try {
      const data = await changeAdminPassword(form);
      setForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      setMessage(data.message ?? "Password changed successfully.");
      onChanged(data.admin);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      {message ? <div className="admin-alert admin-alert--success">{message}</div> : null}
      <PasswordInput
        label="Current password"
        name="currentPassword"
        value={form.currentPassword}
        onChange={(value) => setForm({ ...form, currentPassword: value })}
        autoComplete="current-password"
        error={error}
        required
      />
      <PasswordInput
        label="New password"
        name="newPassword"
        value={form.newPassword}
        onChange={(value) => setForm({ ...form, newPassword: value })}
        autoComplete="new-password"
        error={error}
        required
      />
      <PasswordInput
        label="Confirm new password"
        name="confirmPassword"
        value={form.confirmPassword}
        onChange={(value) => setForm({ ...form, confirmPassword: value })}
        autoComplete="new-password"
        error={error}
        required
      />
      <p className="admin-help-text">
        Use at least 10 characters with letters, numbers, and a special character.
      </p>
      {error ? <ErrorMessage error={error} /> : null}
      <div className="admin-form-actions">
        <button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Changing password..." : "Change password"}
        </button>
      </div>
    </form>
  );
}

function AdminDashboard() {
  const [status, setStatus] = useState("loading");
  const [dashboard, setDashboard] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isActive = true;

    fetchAdminDashboard()
      .then((data) => {
        if (isActive) {
          setDashboard(data.data);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (isActive) {
          setStatus("error");
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  if (status === "loading") {
    return <p className="status-text">Loading dashboard...</p>;
  }

  if (status === "error") {
    return <p className="status-text status-text--error">Dashboard failed to load.</p>;
  }

  const viewsMax = dashboard.topByViews[0]?.viewCount || 1;
  const downloadsMax = dashboard.topByDownloads[0]?.downloadCount || 1;
  const citationsMax = dashboard.topByCitations[0]?.citationCount || 1;

  return (
    <>
      <div className="admin-stat-groups">
        <div className="admin-stat-groups__top">
          <div className="admin-stat-section admin-stat-section--content">
            <p className="admin-stat-section__label">Content</p>
            <div className="admin-stat-grid admin-stat-grid--2col">
              {STAT_CONFIG.slice(0, 4).map((stat) => (
                <AdminStat key={stat.key} label={stat.label} value={dashboard.counts[stat.key] ?? 0}
                  icon={stat.icon} accent={stat.accent} bg={stat.bg}
                  onClick={() => navigate(`/admin/${stat.section}`)} />
              ))}
            </div>
          </div>
          <div className="admin-stat-section">
            <p className="admin-stat-section__label">Metadata</p>
            <div className="admin-stat-grid admin-stat-grid--1col">
              {STAT_CONFIG.slice(4, 6).map((stat) => (
                <AdminStat key={stat.key} label={stat.label} value={dashboard.counts[stat.key] ?? 0}
                  icon={stat.icon} accent={stat.accent} bg={stat.bg}
                  onClick={() => navigate(`/admin/${stat.section}`)} />
              ))}
            </div>
          </div>
        </div>
        <div className="admin-stat-section">
          <p className="admin-stat-section__label">Communications</p>
          <div className="admin-stat-grid admin-stat-grid--2col">
            {STAT_CONFIG.slice(6, 8).map((stat) => (
              <AdminStat key={stat.key} label={stat.label} value={dashboard.counts[stat.key] ?? 0}
                icon={stat.icon} accent={stat.accent} bg={stat.bg}
                onClick={() => navigate(`/admin/${stat.section}`)} />
            ))}
          </div>
        </div>
      </div>

      <div className="admin-health-grid">
        <DashboardMetricPanel
          title="Needs Review"
          description="Records that may need cleanup before release or routine publishing."
          items={NEEDS_REVIEW_CONFIG.map((item) => ({
            ...item,
            value: dashboard.needsReview?.[item.key] ?? 0
          }))}
          emptyText="No review issues found."
          onNavigate={(section) => navigate(`/admin/${section}`)}
        />
        <DashboardMetricPanel
          title="Access Health"
          description="Admin, reader, and trusted-domain account status."
          items={ACCESS_HEALTH_CONFIG.map((item) => ({
            ...item,
            value: dashboard.accessHealth?.[item.key] ?? 0
          }))}
        />
        <DashboardMetricPanel
          title="Announcement Health"
          description="Homepage notice publishing state."
          items={ANNOUNCEMENT_HEALTH_CONFIG.map((item) => ({
            ...item,
            value: dashboard.announcementHealth?.[item.key] ?? 0
          }))}
          footer={
            dashboard.announcementHealth?.latestVisible ? (
              <div className="admin-health-latest">
                <span>Current first visible notice</span>
                <strong>{dashboard.announcementHealth.latestVisible.title}</strong>
                <small>{dashboard.announcementHealth.latestVisible.publishDate}</small>
              </div>
            ) : (
              <p className="admin-health-empty">No visible homepage announcement.</p>
            )
          }
        />
      </div>

      <div className="admin-engagement-grid admin-engagement-grid--3col">
        <section className="admin-panel">
          <div className="admin-panel__heading">
            <div>
              <h2>Top Articles by Views</h2>
              <p>Most viewed articles in the repository.</p>
            </div>
          </div>
          <ol className="admin-rank-list">
            {dashboard.topByViews.map((article, index) => {
              const rank = index + 1;
              const medal = ADMIN_MEDAL_COLORS[rank];
              return (
                <li key={article.id} className="admin-rank-item">
                  <div
                    className="admin-rank-item__pos"
                    style={medal ? { background: medal.bg, color: medal.color, border: `1px solid ${medal.border}` } : undefined}
                  >
                    {medal ? <FontAwesomeIcon icon={faMedal} /> : String(rank).padStart(2, "0")}
                  </div>
                  <div className="admin-rank-item__body">
                    <strong className="admin-rank-item__title">{article.title}</strong>
                    <span className="admin-rank-item__meta">
                      {article.authors || "No authors"} · {article.subjectArea}
                    </span>
                    <div className="admin-rank-item__bar-wrap">
                      <div
                        className="admin-rank-item__bar"
                        style={{ width: `${Math.round((article.viewCount / viewsMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="admin-rank-item__count">{article.viewCount.toLocaleString()}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__heading">
            <div>
              <h2>Top Articles by Downloads</h2>
              <p>Most downloaded articles in the repository.</p>
            </div>
          </div>
          <ol className="admin-rank-list">
            {dashboard.topByDownloads.map((article, index) => {
              const rank = index + 1;
              const medal = ADMIN_MEDAL_COLORS[rank];
              return (
                <li key={article.id} className="admin-rank-item">
                  <div
                    className="admin-rank-item__pos"
                    style={medal ? { background: medal.bg, color: medal.color, border: `1px solid ${medal.border}` } : undefined}
                  >
                    {medal ? <FontAwesomeIcon icon={faMedal} /> : String(rank).padStart(2, "0")}
                  </div>
                  <div className="admin-rank-item__body">
                    <strong className="admin-rank-item__title">{article.title}</strong>
                    <span className="admin-rank-item__meta">
                      {article.authors || "No authors"} · {article.subjectArea}
                    </span>
                    <div className="admin-rank-item__bar-wrap">
                      <div
                        className="admin-rank-item__bar admin-rank-item__bar--gold"
                        style={{ width: `${Math.round((article.downloadCount / downloadsMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="admin-rank-item__count">{article.downloadCount.toLocaleString()}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__heading">
            <div>
              <h2>Top Articles by Citations</h2>
              <p>Most cited articles in the repository.</p>
            </div>
          </div>
          <ol className="admin-rank-list">
            {dashboard.topByCitations.map((article, index) => {
              const rank = index + 1;
              const medal = ADMIN_MEDAL_COLORS[rank];
              return (
                <li key={article.id} className="admin-rank-item">
                  <div
                    className="admin-rank-item__pos"
                    style={medal ? { background: medal.bg, color: medal.color, border: `1px solid ${medal.border}` } : undefined}
                  >
                    {medal ? <FontAwesomeIcon icon={faMedal} /> : String(rank).padStart(2, "0")}
                  </div>
                  <div className="admin-rank-item__body">
                    <strong className="admin-rank-item__title">{article.title}</strong>
                    <span className="admin-rank-item__meta">
                      {article.authors || "No authors"} · {article.subjectArea}
                    </span>
                    <div className="admin-rank-item__bar-wrap">
                      <div
                        className="admin-rank-item__bar admin-rank-item__bar--purple"
                        style={{ width: `${Math.round((article.citationCount / citationsMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="admin-rank-item__count">{article.citationCount.toLocaleString()}</span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel__heading">
          <div>
            <h2>Recent Updates</h2>
            <p>The most recently modified journals, volumes, issues, articles, and announcements.</p>
          </div>
        </div>
        {dashboard.recentUpdates?.length ? (
          <div className="admin-list admin-recent-update-list">
            {dashboard.recentUpdates.map((item) => (
              <div key={`${item.resource}-${item.id}`} className="admin-list-row">
                <div className="admin-list-row__main">
                  <div className="admin-list-row__text">
                    <strong>{item.title}</strong>
                    <span>{item.subtitle || "No summary"}</span>
                  </div>
                  <div className="admin-recent-update-meta">
                    <StatusBadge value={item.resourceLabel} />
                    <span>{formatDateTime(item.updatedAt)}</span>
                  </div>
                </div>
                <div className="admin-list-actions">
                  <button
                    className="admin-list-btn--edit"
                    type="button"
                    onClick={() => navigate(`/admin/${item.resource}`)}
                  >
                    Open {item.resourceLabel}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="status-text">No recently updated records yet.</p>
        )}
      </section>
    </>
  );
}

function DashboardMetricPanel({
  title,
  description,
  items,
  emptyText,
  footer,
  onNavigate
}) {
  const hasActionableItems = items.some((item) => Number(item.value) > 0);

  return (
    <section className="admin-panel admin-health-panel">
      <div className="admin-panel__heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {emptyText && !hasActionableItems ? (
        <p className="admin-health-empty">{emptyText}</p>
      ) : (
        <div className="admin-health-list">
          {items.map((item) => {
            const value = Number(item.value) || 0;
            const content = (
              <>
                <span className="admin-health-list__label">{item.label}</span>
                <strong className={value > 0 ? "admin-health-list__value active" : "admin-health-list__value"}>
                  {value}
                </strong>
              </>
            );

            return item.section && onNavigate ? (
              <button
                key={item.key}
                type="button"
                className="admin-health-list__item admin-health-list__item--button"
                onClick={() => onNavigate(item.section)}
              >
                {content}
              </button>
            ) : (
              <div key={item.key} className="admin-health-list__item">
                {content}
              </div>
            );
          })}
        </div>
      )}
      {footer}
    </section>
  );
}

function AdminStat({ label, value, icon, accent, bg, onClick }) {
  return (
    <button
      type="button"
      className="admin-stat-card"
      style={{ "--stat-accent": accent, "--stat-bg": bg }}
      onClick={onClick}
    >
      <div className="admin-stat-card__icon">
        <FontAwesomeIcon icon={icon} />
      </div>
      <div className="admin-stat-card__body">
        <strong className="admin-stat-card__value">{value}</strong>
        <span className="admin-stat-card__label">{label}</span>
      </div>
    </button>
  );
}

function AdminGuide() {
  return (
    <section className="admin-panel admin-guide">
      <div className="admin-panel__heading">
        <div>
          <h2>Admin Guide</h2>
          <p>Reference guide for managing journal records, users, and content in this portal.</p>
        </div>
      </div>

      <div className="admin-guide-grid">
        <GuideBlock title="Record Workflow">
          <p>
            Create journals first, then volumes (with publication year), then
            issues under each volume. Articles always need a journal, but the
            issue can stay blank for online-first records. Never skip levels —
            an issue must belong to a volume, and a volume must belong to a journal.
          </p>
        </GuideBlock>
        <GuideBlock title="Required Metadata">
          <p>
            Journals need a title and publisher. Volumes need a journal, volume
            number, and year. Issues need a journal, a volume, and an issue
            number. Articles need a journal, a title, and at least one author.
            Keywords and an abstract are optional but strongly recommended for
            discoverability and citation accuracy.
          </p>
        </GuideBlock>
        <GuideBlock title="Online First">
          <p>
            Articles can be published before they are assigned to an issue.
            Leave the Issue field blank when creating the article — it will
            appear under Online First on the public site. Once the issue is
            ready, edit the article and assign it. The article count and metrics
            will transfer to the issue automatically.
          </p>
        </GuideBlock>
        <GuideBlock title="Article Access">
          <p>
            Set an article's access status to <strong>Open Access</strong> to
            allow anyone to download the PDF. Set it to <strong>Restricted</strong>
            to require a signed-in reader account, or <strong>Unavailable</strong>
            if the PDF is not yet ready. The title and abstract remain visible to
            everyone — only the download is gated. Always upload the PDF before
            setting an article to Restricted. Use the Access type filter on the
            Articles page to quickly find all articles of a given status.
          </p>
        </GuideBlock>
        <GuideBlock title="Filtering Records">
          <p>
            Each list page has a search bar and a sort dropdown. Some pages have
            additional filters: Articles can be filtered by access type,
            Announcements by status, and Volumes by journal. Keywords can be
            sorted by most used to identify frequently applied terms.
            All filters reset when you switch to a different section.
          </p>
        </GuideBlock>
        <GuideBlock title="Delete Rules">
          <p>
            Journals, volumes, issues, authors, and keywords cannot be deleted
            while records still depend on them. Delete or reassign articles before
            deleting issues, and remove article relationships before deleting
            authors or keywords. The system will show a clear error if a
            dependency block is triggered — resolve it and retry.
          </p>
        </GuideBlock>
        <GuideBlock title="File Handling">
          <p>
            Use the Upload button on cover image and PDF fields to upload files
            directly. Accepted image formats: jpg, jpeg, png, webp, gif (max 5 MB).
            PDFs: max 50 MB. You can also paste any validated http/https URL or
            a managed /uploads/ path. Uploaded files are served from the server
            and are not deleted automatically when a record is edited.
          </p>
        </GuideBlock>
        <GuideBlock title="Citations & Metrics">
          <p>
            Views and downloads are tracked automatically — no action needed.
            Citation counts are <strong>not</strong> automatic. Look up the
            citation count from an external source (e.g. Google Scholar) and
            update the Citation Count field on each article manually.
            Keeping citations current ensures the rankings and popular scores
            on the public site stay accurate.
          </p>
        </GuideBlock>
        <GuideBlock title="Reader Accounts">
          <p>
            Reader accounts allow registered users to download restricted articles.
            Accounts can be set to expire on a specific date — once expired, they
            lose download access automatically. Use <strong>Bulk Set Expiry</strong>
            to apply a single expiry date to all active reader accounts at once.
            You can also allow anyone with a trusted email domain (e.g. @university.edu)
            to self-register without manual approval. Manage all of this under
            the Users menu.
          </p>
        </GuideBlock>
        <GuideBlock title="Audit Logs">
          <p>
            Every create, update, delete, login, logout, and password change
            performed by any admin is recorded automatically. Super Admins can
            view the full log under Users &rsaquo; Audit Logs. Use the action,
            resource, and date filters to narrow results. Logs cannot be edited
            or deleted — they are a permanent record of portal activity.
          </p>
        </GuideBlock>
        <GuideBlock title="Validation Tips">
          <p>
            Use ISSN format 1234-567X, DOI format starting with 10., ORCID as
            a full URL (https://orcid.org/0000-0000-0000-0000), and dates in
            YYYY-MM-DD format. Volume numbers and issue numbers must be whole
            numbers greater than zero. Fields marked with an asterisk (*) are
            required — the form will not submit until they are filled.
          </p>
        </GuideBlock>
        <GuideBlock title="Metadata Quality">
          <p>
            Search before adding new authors or keywords. Reuse existing entries
            when it is the same person or subject term. Duplicate authors or
            keywords inflate counts and clutter search results. Use the
            Keywords page sorted by Most Used to identify terms worth keeping
            and to spot near-duplicates worth merging.
          </p>
        </GuideBlock>
        <GuideBlock title="Subject Areas">
          <p>
            Journals can be assigned one subject area from a fixed list:
            Business &amp; Accountancy, Computing &amp; Information Technology,
            Multimedia &amp; Design, Communication &amp; Media, Psychology &amp; Social
            Sciences, Engineering, Architecture &amp; Built Environment, and
            Interdisciplinary. The field is optional but helps readers browse and
            filter journals by discipline. Use <strong>Interdisciplinary</strong> for
            journals that span multiple areas and do not fit neatly into one category.
          </p>
        </GuideBlock>
        <GuideBlock title="Announcements">
          <p>
            Announcements appear on the public homepage. Set a publish date to
            schedule when a notice becomes visible. Use <strong>Draft</strong> to
            prepare notices in advance. <strong>Archive</strong> old notices
            instead of deleting them — archived announcements are hidden from the
            homepage but kept for records. Sort order controls which notice
            appears first when multiple are published on the same date. Use the
            Status filter to view only Draft, Published, or Archived notices.
          </p>
        </GuideBlock>
        <GuideBlock title="Password & Security">
          <p>
            The default admin password must be changed after first login — the
            portal will block all other actions until this is done. New passwords
            require at least 10 characters and must include letters, numbers, and
            a special character. Changing your password ends all other active
            sessions automatically. Never share admin credentials.
          </p>
        </GuideBlock>
        <GuideBlock title="Roles & Access">
          <p>
            <strong>Super Admin</strong> can manage all content, user accounts,
            trusted domains, reader accounts, and view audit logs.{" "}
            <strong>Content Admin</strong> can manage all repository content but
            cannot access user management or audit logs.{" "}
            <strong>Member</strong> accounts are admin portal accounts with
            download-only access — they can sign in to the admin portal but
            cannot manage any content or settings. They are not the same as
            reader accounts, which are registered through the public site.
            Restricted PDF downloads are verified by the server before the file
            is served; changing access status takes effect immediately.
          </p>
        </GuideBlock>
      </div>
    </section>
  );
}

function GuideBlock({ title, children }) {
  return (
    <article className="admin-guide-block">
      <h3>{title}</h3>
      {children}
    </article>
  );
}

function ResourceManager({ resource, onNavigateSection }) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1
  });
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [sort, setSort] = useState(resource.sort);
  const [status, setStatus] = useState("loading");
  const [mode, setMode] = useState("list");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(BLANK_FORMS[resource.key]);
  const [options, setOptions] = useState(null);
  const [requestError, setRequestError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [filterValue, setFilterValue] = useState("");
  const [journalFilter, setJournalFilter] = useState("");

  useEffect(() => {
    setMode("list");
    setEditingId(null);
    setSearch("");
    setDraftSearch("");
    setSort(resource.sort);
    setRequestError(null);
    setWarnings([]);
    setToast(null);
    setDeleteTarget(null);
    setFilterValue("");
    setJournalFilter("");
  }, [resource.key, resource.sort]);

  useEffect(() => {
    if (!toast || toast.type !== "success") {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 4500);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    loadList(1);
  }, [resource.key, search, sort, pageSize, filterValue, journalFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(draftSearch);
    }, 350);
    return () => clearTimeout(timer);
  }, [draftSearch]);

  useEffect(() => {
    if (OPTION_RESOURCES.has(resource.key)) {
      fetchAdminOptions()
        .then(setOptions)
        .catch(() => setOptions(null));
    }
  }, [resource.key]);

  async function loadList(page = pagination.page) {
    setStatus("loading");
    try {
      const extraParams = {};
      if (resource.key === "articles" && filterValue) extraParams.accessStatus = filterValue;
      if (resource.key === "announcements" && filterValue) extraParams.status = filterValue;
      if (resource.key === "volumes" && journalFilter) extraParams.journalId = journalFilter;
      const data = await fetchAdminList(resource.key, {
        search,
        sort,
        page,
        pageSize,
        ...extraParams
      });
      setItems(data.items);
      setPagination({
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages
      });
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  async function openCreate() {
    setMode("create");
    setEditingId(null);
    setForm(getBlankForm(resource.key));
    setRequestError(null);
    setWarnings([]);
    setToast(null);
    if (OPTION_RESOURCES.has(resource.key)) {
      setOptions(await safeFetchOptions());
    }
  }

  async function openEdit(id) {
    setMode("list");
    setEditingId(id);
    setRequestError(null);
    setWarnings([]);
    setToast(null);
    if (OPTION_RESOURCES.has(resource.key)) {
      setOptions(await safeFetchOptions());
    }
    try {
      const data = await fetchAdminItem(resource.key, id);
      setForm(normalizeForm(resource.key, data.item));
    } catch (error) {
      setRequestError(error);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setRequestError(null);
    setWarnings([]);
    setToast(null);

    try {
      const payload = preparePayload(resource.key, form);
      const data = editingId
        ? await updateAdminItem(resource.key, editingId, payload)
        : await createAdminItem(resource.key, payload);
      const nextWarnings = data.warnings ?? [];
      const action = editingId ? "updated" : "created";
      setToast(
        nextWarnings.length
          ? {
              type: "warning",
              title: "Saved with warnings",
              message: `${resource.singular} ${action}. ${nextWarnings.join(" ")}`
            }
          : {
              type: "success",
              title: "Saved",
              message: `${resource.singular} ${action} successfully.`
            }
      );
      await loadList();
      if (OPTION_RESOURCES.has(resource.key)) {
        setOptions(await safeFetchOptions());
      }
      closeForm();
    } catch (error) {
      setRequestError(error);
      setToast(formatErrorToast(error));
    }
  }

  function handleDelete(item) {
    setDeleteTarget(item);
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setRequestError(null);
    setWarnings([]);
    setToast(null);

    try {
      await deleteAdminItem(resource.key, deleteTarget.id);
      setToast({
        type: "success",
        title: "Deleted",
        message: `${resource.singular} deleted successfully.`
      });
      await loadList(1);
      if (OPTION_RESOURCES.has(resource.key)) {
        setOptions(await safeFetchOptions());
      }
    } catch (error) {
      setRequestError(error);
      setToast(formatErrorToast(error));
    } finally {
      setDeleteTarget(null);
    }
  }

  async function safeFetchOptions() {
    try {
      return await fetchAdminOptions();
    } catch {
      return null;
    }
  }

  function clearFeedback() {
    setRequestError(null);
    setWarnings([]);
    setToast(null);
  }

  function submitSearch() {
    clearFeedback();
    setSearch(draftSearch);
  }

  function changeSort(nextSort) {
    clearFeedback();
    setSort(nextSort);
  }

  function changePage(nextPage) {
    clearFeedback();
    loadList(nextPage);
  }

  function closeForm() {
    setMode("list");
    setEditingId(null);
    setRequestError(null);
    setWarnings([]);
  }

  return (
    <section className="admin-panel">
      <AdminToast toast={toast} onClose={() => setToast(null)} />
      <ConfirmDialog
        item={deleteTarget}
        resource={resource}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
      <div className="admin-panel__heading">
        <div>
          <h2>Manage {resource.label}</h2>
          <p>Search, sort, create, edit, and safely delete {resource.label.toLowerCase()}.</p>
        </div>
        <button type="button" onClick={openCreate}>
          New {resource.singular}
        </button>
      </div>

      <div className="admin-toolbar">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch();
          }}
        >
          <input
            type="search"
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder={SEARCH_PLACEHOLDERS[resource.key] ?? `Search ${resource.label.toLowerCase()}`}
          />
          <button type="submit">Search</button>
        </form>
        <select value={sort} onChange={(event) => changeSort(event.target.value)}>
          {SORT_OPTIONS[resource.key].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {resource.key === "articles" ? (
          <select
            value={filterValue}
            onChange={(event) => { setFilterValue(event.target.value); clearFeedback(); }}
            aria-label="Filter by access type"
          >
            <option value="">All access types</option>
            {ARTICLE_ACCESS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        ) : null}
        {resource.key === "announcements" ? (
          <select
            value={filterValue}
            onChange={(event) => { setFilterValue(event.target.value); clearFeedback(); }}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {ANNOUNCEMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : null}
        {resource.key === "volumes" && options?.journals?.length > 0 ? (
          <select
            value={journalFilter}
            onChange={(event) => { setJournalFilter(event.target.value); clearFeedback(); }}
            aria-label="Filter by journal"
          >
            <option value="">All journals</option>
            {options.journals.map((j) => (
              <option key={j.id} value={String(j.id)}>{j.title}</option>
            ))}
          </select>
        ) : null}
        <label className="admin-page-size-label">
          Per page
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      {mode === "create" ? (
        <FormPanel
          requestError={requestError}
          warnings={warnings}
          onNavigateSection={onNavigateSection}
        >
          <ResourceForm
            resourceKey={resource.key}
            form={form}
            setForm={setForm}
            options={options}
            error={requestError}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            onOpenEdit={openEdit}
            isEditing={false}
            editingId={null}
          />
        </FormPanel>
      ) : null}

      <AdminList
        resourceKey={resource.key}
        items={items}
        status={status}
        pagination={pagination}
        onEdit={openEdit}
        onDelete={handleDelete}
        onPageChange={changePage}
        inlineEditId={editingId}
        emptyMessage={
          (search || filterValue || journalFilter)
            ? `No ${resource.label.toLowerCase()} match your search or filters.`
            : `No ${resource.label.toLowerCase()} have been added yet.`
        }
        renderInlineEdit={() => (
          <FormPanel
            requestError={requestError}
            warnings={warnings}
            onNavigateSection={onNavigateSection}
          >
            <ResourceForm
              resourceKey={resource.key}
              form={form}
              setForm={setForm}
              options={options}
              error={requestError}
              onSubmit={handleSubmit}
              onCancel={closeForm}
              onOpenEdit={openEdit}
              isEditing={true}
              editingId={editingId}
            />
          </FormPanel>
        )}
      />
    </section>
  );
}

function ResourceForm({
  resourceKey,
  form,
  setForm,
  options,
  error,
  onSubmit,
  onCancel,
  onOpenEdit,
  editingId,
  isEditing
}) {
  const title = `${isEditing ? "Edit" : "New"} ${getResourceSingular(resourceKey)}`;

  return (
    <form className="admin-form admin-form--wide" onSubmit={onSubmit}>
      <div className="admin-form__heading">
        <h3>{title}</h3>
        <button type="button" onClick={onCancel}>
          Close
        </button>
      </div>
      {resourceKey === "accounts" ? (
        <AccountForm form={form} setForm={setForm} error={error} isEditing={isEditing} />
      ) : null}
      {resourceKey === "journals" ? (
        <JournalForm form={form} setForm={setForm} options={options} error={error} editingId={isEditing ? editingId : null} />
      ) : null}
      {resourceKey === "volumes" ? (
        <VolumeForm form={form} setForm={setForm} options={options} error={error} />
      ) : null}
      {resourceKey === "issues" ? (
        <IssueForm form={form} setForm={setForm} options={options} error={error} />
      ) : null}
      {resourceKey === "articles" ? (
        <ArticleForm form={form} setForm={setForm} options={options} error={error} />
      ) : null}
      {resourceKey === "announcements" ? (
        <AnnouncementForm form={form} setForm={setForm} error={error} />
      ) : null}
      {resourceKey === "authors" ? (
        <AuthorForm
          form={form}
          setForm={setForm}
          options={options}
          error={error}
          currentId={editingId}
          onOpenEdit={onOpenEdit}
        />
      ) : null}
      {resourceKey === "keywords" ? (
        <KeywordForm
          form={form}
          setForm={setForm}
          options={options}
          error={error}
          currentId={editingId}
          onOpenEdit={onOpenEdit}
        />
      ) : null}
      <div className="admin-form-actions">
        <button type="submit">{isEditing ? "Save changes" : "Create record"}</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function AccountForm({ form, setForm, error, isEditing }) {
  return (
    <>
      <AdminFormSection
        title="Account Identity"
        note="Use a real name and a unique username. Email is optional for this local V1 system."
      >
        <div className="admin-form-grid">
          <TextInput
            label="Username"
            name="username"
            form={form}
            setForm={setForm}
            error={error}
            required
          />
          <TextInput
            label="Display name"
            name="displayName"
            form={form}
            setForm={setForm}
            error={error}
            required
          />
          <TextInput
            label="Email"
            name="email"
            form={form}
            setForm={setForm}
            error={error}
            type="email"
          />
        </div>
      </AdminFormSection>
      <AdminFormSection
        title="Role And Status"
        note="Super Admin can manage accounts. Content Admin manages repository records. Member can download permitted files only."
      >
        <div className="admin-form-grid">
          <SelectInput label="Role" name="role" form={form} setForm={setForm} error={error} required>
            {ACCOUNT_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </SelectInput>
          <SelectInput
            label="Account status"
            name="accountStatus"
            form={form}
            setForm={setForm}
            error={error}
            required
          >
            {ACCOUNT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </SelectInput>
          <CheckboxInput
            label="Require password change on next sign-in"
            name="mustChangePassword"
            form={form}
            setForm={setForm}
          />
        </div>
      </AdminFormSection>
      <AdminFormSection
        title="Password Setup"
        note={
          isEditing
            ? "Leave password blank to keep the current password."
            : "Set a temporary password. The account can be required to change it after sign-in."
        }
      >
        <PasswordInput
          label={isEditing ? "New temporary password" : "Temporary password"}
          name="password"
          value={form.password ?? ""}
          onChange={(value) => setForm({ ...form, password: value })}
          autoComplete="new-password"
          error={error}
          required={!isEditing}
        />
      </AdminFormSection>
    </>
  );
}

function JournalInsightPanel({ journalId }) {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);

  async function handleRegenerate() {
    setStatus("loading");
    setResult(null);
    try {
      const data = await regenerateJournalInsight(journalId);
      setResult({ ok: true, insight: data.insight, updatedAt: data.updatedAt });
      setStatus("done");
    } catch {
      setResult({ ok: false });
      setStatus("done");
    }
  }

  return (
    <AdminFormSection title="AI Journal Overview" note="Generates a 3-sentence plain-language overview of this journal using Claude AI.">
      <div className="insight-override-panel">
        <button
          type="button"
          className="insight-override-btn"
          onClick={handleRegenerate}
          disabled={status === "loading"}
        >
          {status === "loading" ? "Generating…" : "Regenerate Insight Now"}
        </button>
        {status === "done" && result?.ok && (
          <div className="insight-override-result insight-override-result--ok">
            <p className="insight-override-result__text">{result.insight}</p>
            {result.updatedAt ? (
              <p className="insight-override-result__meta">
                Updated {new Date(result.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            ) : null}
          </div>
        )}
        {status === "done" && !result?.ok && (
          <p className="insight-override-result insight-override-result--err">Generation failed — check that your API key is set and the journal has articles.</p>
        )}
      </div>
    </AdminFormSection>
  );
}

function JournalForm({ form, setForm, options, error, editingId }) {
  return (
    <>
      <AdminFormSection title="Journal Identity" note="Start with the publication name and subject area.">
        <div className="admin-form-grid">
        <TextInput label="Title" name="title" form={form} setForm={setForm} error={error} required />
        <TextInput
          label="Abbreviation"
          name="abbreviation"
          form={form}
          setForm={setForm}
          error={error}
        />
        <SelectInput label="Subject area" name="subjectArea" form={form} setForm={setForm} error={error}>
          <option value="">— None —</option>
          {(options?.subjectAreas ?? []).map((area) => (
            <option key={area} value={area}>{area}</option>
          ))}
        </SelectInput>
        </div>
      </AdminFormSection>
      <AdminFormSection title="Publication Details" note="ISSNs must be unique when provided.">
        <div className="admin-form-grid">
        <TextInput
          label="Publisher"
          name="publisherName"
          form={form}
          setForm={setForm}
          error={error}
          required
        />
        <TextInput
          label="Print ISSN"
          name="printIssn"
          form={form}
          setForm={setForm}
          error={error}
          placeholder="1234-567X"
        />
        <TextInput
          label="Online ISSN"
          name="onlineIssn"
          form={form}
          setForm={setForm}
          error={error}
          placeholder="1234-567X"
        />
        <TextInput
          label="Place of publication"
          name="placeOfPublication"
          form={form}
          setForm={setForm}
          error={error}
        />
        </div>
      </AdminFormSection>
      <AdminFormSection title="Links And Images">
        <div className="admin-form-grid">
          <TextInput
            label="Journal URL"
            name="journalUrl"
            form={form}
            setForm={setForm}
            error={error}
            placeholder="https://..."
            hint="Optional. Leave blank to hide the 'Open journal site' button on the public page."
          />
          <FileUploadField
            label="Cover image"
            name="defaultCoverImage"
            uploadType="image"
            form={form}
            setForm={setForm}
            error={error}
          />
        </div>
      </AdminFormSection>
      <AdminFormSection title="Description">
      <TextareaInput
        label="Description"
        name="description"
        form={form}
        setForm={setForm}
        error={error}
      />
      </AdminFormSection>
      {editingId ? <JournalInsightPanel journalId={editingId} /> : null}
    </>
  );
}

function VolumeForm({ form, setForm, options, error }) {
  return (
    <>
      <AdminFormSection
        title="Volume Identity"
        note="Each volume belongs to one journal. Volume number must be unique within the journal."
      >
        <div className="admin-form-grid">
          <SelectInput label="Journal" name="journalId" form={form} setForm={setForm} error={error} required>
            <option value="">Select journal</option>
            {(options?.journals ?? []).map((journal) => (
              <option key={journal.id} value={journal.id}>
                {journal.title}
              </option>
            ))}
          </SelectInput>
          <TextInput
            label="Volume number"
            name="volumeNumber"
            form={form}
            setForm={setForm}
            error={error}
            required
          />
          <TextInput
            label="Volume title"
            name="volumeTitle"
            form={form}
            setForm={setForm}
            error={error}
          />
        </div>
      </AdminFormSection>
      <AdminFormSection
        title="Publication Year"
        note="Publication year is shared by all issues in this volume."
      >
        <div className="admin-form-grid">
          <TextInput
            label="Publication year"
            name="publicationYear"
            form={form}
            setForm={setForm}
            error={error}
            type="number"
            required
          />
        </div>
      </AdminFormSection>
    </>
  );
}

function IssueForm({ form, setForm, options, error }) {
  const journalId = Number(form.journalId);
  const volumeOptions = (options?.volumes ?? []).filter(
    (volume) => Number(volume.journalId) === journalId
  );

  function updateField(name, value) {
    const nextForm = { ...form, [name]: value };

    if (name === "journalId") {
      const nextJournalId = Number(value);
      const nextVolumeOptions = (options?.volumes ?? []).filter(
        (volume) => Number(volume.journalId) === nextJournalId
      );
      const volumeStillValid = nextVolumeOptions.some(
        (volume) => String(volume.id) === String(form.volumeId)
      );
      if (!volumeStillValid) {
        nextForm.volumeId = "";
      }
    }

    setForm(nextForm);
  }

  return (
    <>
      <AdminFormSection title="Issue Identity" note="Issues group articles under a journal volume and issue number.">
        <div className="admin-form-grid">
          <Field label="Journal" name="journalId" error={error} required>
            <select
              value={form.journalId ?? ""}
              aria-required="true"
              onChange={(event) => updateField("journalId", event.target.value)}
            >
              <option value="">Select journal</option>
              {(options?.journals ?? []).map((journal) => (
                <option key={journal.id} value={journal.id}>
                  {journal.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Volume" name="volumeId" error={error} required>
            <select
              value={form.volumeId ?? ""}
              aria-required="true"
              onChange={(event) => updateField("volumeId", event.target.value)}
            >
              <option value="">Select volume</option>
              {volumeOptions.map((volume) => (
                <option key={volume.id} value={volume.id}>
                  Vol. {volume.volumeNumber} ({volume.publicationYear})
                  {volume.volumeTitle ? ` — ${volume.volumeTitle}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <TextInput
            label="Issue number"
            name="issueNumber"
            form={form}
            setForm={setForm}
            error={error}
            required
          />
          <TextInput
            label="Issue title"
            name="issueTitle"
            form={form}
            setForm={setForm}
            error={error}
          />
        </div>
      </AdminFormSection>
      <AdminFormSection title="Publication" note="Publication month is the label used in citations (e.g. February 2025). Date published is the exact online availability date.">
        <div className="admin-form-grid">
          <SelectInput
            label="Publication month"
            name="publicationMonth"
            form={form}
            setForm={setForm}
            error={error}
          >
            <option value="">Not specified</option>
            <option value="1">January</option>
            <option value="2">February</option>
            <option value="3">March</option>
            <option value="4">April</option>
            <option value="5">May</option>
            <option value="6">June</option>
            <option value="7">July</option>
            <option value="8">August</option>
            <option value="9">September</option>
            <option value="10">October</option>
            <option value="11">November</option>
            <option value="12">December</option>
          </SelectInput>
          <TextInput
            label="Date published"
            name="datePublished"
            form={form}
            setForm={(updated) => {
              const date = updated.datePublished;
              const month = date ? String(parseInt(date.split("-")[1], 10)) : updated.publicationMonth;
              setForm({ ...updated, publicationMonth: month });
            }}
            error={error}
            type="date"
          />
        </div>
      </AdminFormSection>
      <AdminFormSection title="Links">
        <div className="admin-form-grid">
          <TextInput
            label="Issue URL"
            name="issueUrl"
            form={form}
            setForm={setForm}
            error={error}
            placeholder="https://..."
            hint="Optional. Leave blank to hide the 'Open issue site' button on the public page."
          />
          <FileUploadField
            label="Cover image"
            name="issueCoverImage"
            uploadType="image"
            form={form}
            setForm={setForm}
            error={error}
          />
        </div>
      </AdminFormSection>
    </>
  );
}

function AnnouncementForm({ form, setForm, error }) {
  return (
    <>
      <AdminFormSection
        title="Announcement Content"
        note="Use short homepage notices for repository updates, access notices, events, or service messages."
      >
        <div className="admin-form-grid">
          <SelectInput label="Label" name="label" form={form} setForm={setForm} error={error} required>
            {ANNOUNCEMENT_LABELS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </SelectInput>
          <TextInput label="Title" name="title" form={form} setForm={setForm} error={error} required />
        </div>
        <TextareaInput
          label="Summary"
          name="summary"
          form={form}
          setForm={setForm}
          error={error}
          required
        />
      </AdminFormSection>
      <AdminFormSection
        title="Publishing"
        note="Only published announcements with a publish date of today or earlier appear on the homepage."
      >
        <div className="admin-form-grid">
          <TextInput
            label="Publish date"
            name="publishDate"
            form={form}
            setForm={setForm}
            error={error}
            type="date"
            required
          />
          <SelectInput label="Status" name="status" form={form} setForm={setForm} error={error} required>
            {ANNOUNCEMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </SelectInput>
          <TextInput
            label="Sort order"
            name="sortOrder"
            form={form}
            setForm={setForm}
            error={error}
            type="number"
          />
        </div>
      </AdminFormSection>
      <AdminFormSection
        title="Optional Link"
        note="Use an internal path such as /records or a full http/https URL. Add a link label when a link is provided."
      >
        <div className="admin-form-grid">
          <TextInput
            label="Link path or URL"
            name="href"
            form={form}
            setForm={setForm}
            error={error}
            placeholder="/records"
          />
          <TextInput
            label="Link label"
            name="linkLabel"
            form={form}
            setForm={setForm}
            error={error}
            placeholder="View catalog"
          />
        </div>
      </AdminFormSection>
      <AdminFormSection
        title="Optional Image"
        note="Displayed as announcement content on the homepage. For Facebook portrait posts, use 1080 x 1350 px (4:5)."
      >
        <div className="admin-form-grid">
          <FileUploadField
            label="Announcement image"
            name="image"
            uploadType="image"
            form={form}
            setForm={setForm}
            error={error}
          />
        </div>
      </AdminFormSection>
    </>
  );
}

function AuthorForm({ form, setForm, options, error, currentId, onOpenEdit }) {
  const suggestions = useMemo(
    () => findAuthorSuggestions(form, options?.authors ?? [], currentId),
    [form, options, currentId]
  );

  return (
    <>
      <div className="admin-form-grid">
        <TextInput label="First name" name="firstName" form={form} setForm={setForm} error={error} required />
        <TextInput label="Last name" name="lastName" form={form} setForm={setForm} error={error} required />
        <TextInput label="Middle name" name="middleName" form={form} setForm={setForm} error={error} />
        <TextInput label="Suffix" name="suffix" form={form} setForm={setForm} error={error} />
        <TextInput
          label="Display name"
          name="displayName"
          form={form}
          setForm={setForm}
          error={error}
          required
        />
        <TextInput
          label="Affiliation"
          name="affiliation"
          form={form}
          setForm={setForm}
          error={error}
        />
        <TextInput
          label="ORCID"
          name="orcid"
          form={form}
          setForm={setForm}
          error={error}
          placeholder="0000-0000-0000-0000"
        />
      </div>
      {suggestions.length ? (
        <SuggestionPanel
          title="Possible existing authors"
          note="Use the existing author if this is the same person. Create a new author only when the identity is different."
        >
          {suggestions.map((author) => (
            <SuggestionItem
              key={author.id}
              title={author.displayName}
              meta={[author.affiliation, author.orcid].filter(Boolean).join(" | ")}
              actionLabel="Edit existing"
              onAction={() => onOpenEdit?.(author.id)}
            />
          ))}
        </SuggestionPanel>
      ) : null}
    </>
  );
}

function KeywordForm({ form, setForm, options, error, currentId, onOpenEdit }) {
  const normalizedKeyword = normalizeKeywordInput(form.name);
  const existingKeyword = findExactKeyword(normalizedKeyword, options?.keywords ?? [], currentId);
  const changedPreview =
    form.name.trim() && normalizedKeyword && form.name.trim() !== normalizedKeyword;

  return (
    <>
      <TextInput
        label="Keyword name"
        name="name"
        form={form}
        setForm={setForm}
        error={error}
        required
      />
      {changedPreview ? (
        <p className="admin-normalization-note">
          This keyword will be saved as <strong>{normalizedKeyword}</strong>.
        </p>
      ) : null}
      {existingKeyword ? (
        <SuggestionPanel
          title="Existing keyword found"
          note="Exact keyword duplicates are blocked. Use the existing keyword instead of creating another record."
        >
          <SuggestionItem
            title={existingKeyword.name}
            meta={`${existingKeyword.articleCount ?? 0} linked articles`}
            actionLabel="Edit existing"
            onAction={() => onOpenEdit?.(existingKeyword.id)}
          />
        </SuggestionPanel>
      ) : null}
    </>
  );
}

function AdminFormSection({ title, note, children }) {
  return (
    <section className="admin-form-section">
      <div>
        <h4>{title}</h4>
        {note ? <p>{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SuggestionPanel({ title, note, children }) {
  return (
    <div className="admin-suggestion-panel">
      <div>
        <strong>{title}</strong>
        {note ? <p>{note}</p> : null}
      </div>
      <div className="admin-suggestion-list">{children}</div>
    </div>
  );
}

function SuggestionItem({ title, meta, actionLabel, onAction }) {
  return (
    <div className="admin-suggestion-item">
      <div>
        <strong>{title}</strong>
        {meta ? <span>{meta}</span> : null}
      </div>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function ArticleForm({ form, setForm, options, error }) {
  const [authorSearch, setAuthorSearch] = useState("");
  const [authorDropdownOpen, setAuthorDropdownOpen] = useState(false);
  const [newAuthor, setNewAuthor] = useState({
    firstName: "",
    lastName: "",
    affiliation: "",
    orcid: ""
  });
  const [selectedKeywordId, setSelectedKeywordId] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const journalId = Number(form.journalId);
  const issueOptions = (options?.issues ?? []).filter(
    (issue) => Number(issue.journalId) === journalId
  );
  const newAuthorSuggestions = useMemo(
    () => findAuthorSuggestions(newAuthor, options?.authors ?? []),
    [newAuthor, options]
  );
  const filteredAuthors = useMemo(() => {
    const q = authorSearch.trim().toLowerCase();
    if (!q) return [];
    return (options?.authors ?? [])
      .filter(
        (a) =>
          a.displayName?.toLowerCase().includes(q) ||
          a.affiliation?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [authorSearch, options]);
  const normalizedNewKeyword = normalizeKeywordInput(newKeyword);
  const keywordSuggestions = useMemo(
    () => findKeywordSuggestions(normalizedNewKeyword, options?.keywords ?? [], form.keywords),
    [normalizedNewKeyword, options, form.keywords]
  );
  const keywordPreviewChanged =
    newKeyword.trim() && normalizedNewKeyword && newKeyword.trim() !== normalizedNewKeyword;

  function updateField(name, value) {
    const nextForm = { ...form, [name]: value };
    if (name === "journalId") {
      const nextJournalId = Number(value);
      const nextIssueOptions = (options?.issues ?? []).filter(
        (issue) => Number(issue.journalId) === nextJournalId
      );
      const issueStillValid = nextIssueOptions.some(
        (issue) => String(issue.id) === String(form.issueId)
      );
      if (!issueStillValid) {
        nextForm.issueId = "";
      }
    }
    setForm(nextForm);
  }

  function selectExistingAuthor(author) {
    addAuthorRecord(author);
    setAuthorSearch("");
    setAuthorDropdownOpen(false);
  }

  function addAuthorRecord(author) {
    if (!author || authorAlreadySelected(form.authors, author)) {
      return;
    }

    setForm({ ...form, authors: [...form.authors, author] });
  }

  function addNewAuthor() {
    const authorDraft = normalizeAuthorDraft(newAuthor);
    if (!authorDraft.firstName || !authorDraft.lastName) {
      return;
    }

    const reusableAuthor = findExactAuthorMatch(authorDraft, options?.authors ?? []);
    if (reusableAuthor) {
      addAuthorRecord(reusableAuthor);
      setNewAuthor({ firstName: "", lastName: "", affiliation: "", orcid: "" });
      return;
    }

    if (authorAlreadySelected(form.authors, authorDraft)) {
      setNewAuthor({ firstName: "", lastName: "", affiliation: "", orcid: "" });
      return;
    }

    setForm({
      ...form,
      authors: [
        ...form.authors,
        {
          ...authorDraft,
          displayName: `${authorDraft.firstName} ${authorDraft.lastName}`.trim()
        }
      ]
    });
    setNewAuthor({ firstName: "", lastName: "", affiliation: "", orcid: "" });
  }

  function addExistingKeyword() {
    const keyword = (options?.keywords ?? []).find(
      (item) => String(item.id) === String(selectedKeywordId)
    );
    addKeywordRecord(keyword);
    setSelectedKeywordId("");
  }

  function addKeywordRecord(keyword) {
    if (!keyword || keywordAlreadySelected(form.keywords, keyword)) {
      return;
    }

    setForm({ ...form, keywords: [...form.keywords, keyword] });
  }

  function addNewKeyword() {
    if (!normalizedNewKeyword) {
      return;
    }

    const existingKeyword = findExactKeyword(normalizedNewKeyword, options?.keywords ?? []);
    if (existingKeyword) {
      addKeywordRecord(existingKeyword);
      setNewKeyword("");
      return;
    }

    if (keywordAlreadySelected(form.keywords, { name: normalizedNewKeyword })) {
      setNewKeyword("");
      return;
    }

    setForm({
      ...form,
      keywords: [...form.keywords, { name: normalizedNewKeyword }]
    });
    setNewKeyword("");
  }

  return (
    <>
      <AdminFormSection
        title="Basic Info"
        note="Start with the article identity users will search for."
      >
        <div className="admin-form-grid">
          <TextInput label="Title" name="title" form={form} setForm={setForm} error={error} required />
          <TextInput label="DOI" name="doi" form={form} setForm={setForm} error={error} />
        </div>
      </AdminFormSection>

      <AdminFormSection
        title="Publication"
        note="Journal is required. Issue is optional for online-first articles."
      >
        <div className="admin-form-grid">
          <SelectInput
            label="Journal"
            name="journalId"
            form={form}
            setForm={(next) => updateField("journalId", next.journalId)}
            error={error}
            required
          >
            <option value="">Select journal</option>
            {(options?.journals ?? []).map((journal) => (
              <option key={journal.id} value={journal.id}>
                {journal.title}
              </option>
            ))}
          </SelectInput>
          <Field label="Issue" name="issueId" error={error}>
            <select
              value={form.issueId ?? ""}
              onChange={(event) => updateField("issueId", event.target.value)}
            >
              <option value="">Online first / no issue yet</option>
              {issueOptions.map((issue) => (
                <option key={issue.id} value={issue.id}>
                  {issue.journalTitle} Vol. {issue.volumeNumber}, No. {issue.issueNumber} ({issue.publicationYear})
                </option>
              ))}
            </select>
          </Field>
          <TextInput
            label="Date published"
            name="datePublished"
            form={form}
            setForm={setForm}
            error={error}
            type="date"
          />
          <TextInput label="Page start" name="pageStart" form={form} setForm={setForm} error={error} />
          <TextInput label="Page end" name="pageEnd" form={form} setForm={setForm} error={error} />
        </div>
      </AdminFormSection>

      <AdminFormSection
        title="Authors"
        note="Add at least one author. Use ORCID when available to avoid duplicate author identities."
      >
        <div className="admin-inline-builder">
          <Field label="Search existing authors" name="authors" error={error} required>
            <div className="author-combobox">
              <input
                className="author-combobox__input"
                type="text"
                placeholder="Type to search by name or affiliation…"
                value={authorSearch}
                onChange={(e) => {
                  setAuthorSearch(e.target.value);
                  setAuthorDropdownOpen(true);
                }}
                onFocus={() => setAuthorDropdownOpen(true)}
                onBlur={() => setTimeout(() => setAuthorDropdownOpen(false), 150)}
                autoComplete="off"
              />
              {authorDropdownOpen && filteredAuthors.length > 0 && (
                <ul className="author-combobox__dropdown" role="listbox">
                  {filteredAuthors.map((author) => (
                    <li
                      key={author.id}
                      className="author-combobox__option"
                      role="option"
                      onMouseDown={() => selectExistingAuthor(author)}
                    >
                      <span className="author-combobox__name">{author.displayName}</span>
                      {author.affiliation && (
                        <span className="author-combobox__affil">{author.affiliation}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Field>
          <div className="admin-form-grid admin-form-grid--tight">
            <input
              value={newAuthor.firstName}
              onChange={(event) => setNewAuthor({ ...newAuthor, firstName: event.target.value })}
              placeholder="First name"
            />
            <input
              value={newAuthor.lastName}
              onChange={(event) => setNewAuthor({ ...newAuthor, lastName: event.target.value })}
              placeholder="Last name"
            />
            <input
              value={newAuthor.affiliation}
              onChange={(event) => setNewAuthor({ ...newAuthor, affiliation: event.target.value })}
              placeholder="Affiliation"
            />
            <input
              value={newAuthor.orcid}
              onChange={(event) => setNewAuthor({ ...newAuthor, orcid: event.target.value })}
              placeholder="ORCID"
            />
          </div>
          {newAuthorSuggestions.length ? (
            <SuggestionPanel
              title="Possible existing authors"
              note="Use an existing author when the person already exists in the repository."
            >
              {newAuthorSuggestions.map((author) => (
                <SuggestionItem
                  key={author.id}
                  title={author.displayName}
                  meta={[author.affiliation, author.orcid].filter(Boolean).join(" | ")}
                  actionLabel="Use existing"
                  onAction={() => {
                    addAuthorRecord(author);
                    setNewAuthor({ firstName: "", lastName: "", affiliation: "", orcid: "" });
                  }}
                />
              ))}
            </SuggestionPanel>
          ) : null}
          <button type="button" onClick={addNewAuthor}>
            Add New Author
          </button>
          <TokenList
            items={form.authors}
            getLabel={(author) => author.displayName ?? `${author.firstName} ${author.lastName}`}
            onRemove={(index) =>
              setForm({
                ...form,
                authors: form.authors.filter((_, itemIndex) => itemIndex !== index)
              })
            }
          />
        </div>
      </AdminFormSection>

      <AdminFormSection
        title="Keywords"
        note="Use short subject terms that help users discover similar articles."
      >
        <div className="admin-inline-builder">
          <div className="admin-inline-row">
            <select
              value={selectedKeywordId}
              onChange={(event) => setSelectedKeywordId(event.target.value)}
            >
              <option value="">Choose keyword</option>
              {(options?.keywords ?? []).map((keyword) => (
                <option key={keyword.id} value={keyword.id}>
                  {keyword.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={addExistingKeyword}>
              Add
            </button>
          </div>
          <div className="admin-inline-row">
            <input
              value={newKeyword}
              onChange={(event) => setNewKeyword(event.target.value)}
              placeholder="New keyword"
            />
            <button type="button" onClick={addNewKeyword}>
              Add New Keyword
            </button>
          </div>
          {keywordPreviewChanged ? (
            <p className="admin-normalization-note">
              This keyword will be saved as <strong>{normalizedNewKeyword}</strong>.
            </p>
          ) : null}
          {keywordSuggestions.length ? (
            <SuggestionPanel
              title="Suggested existing keywords"
              note="Use an existing keyword when it already describes the topic."
            >
              {keywordSuggestions.map((keyword) => (
                <SuggestionItem
                  key={keyword.id}
                  title={keyword.name}
                  meta={`${keyword.articleCount ?? 0} linked articles`}
                  actionLabel="Use keyword"
                  onAction={() => {
                    addKeywordRecord(keyword);
                    setNewKeyword("");
                  }}
                />
              ))}
            </SuggestionPanel>
          ) : null}
          <TokenList
            items={form.keywords}
            getLabel={(keyword) => keyword.name}
            onRemove={(index) =>
              setForm({
                ...form,
                keywords: form.keywords.filter((_, itemIndex) => itemIndex !== index)
              })
            }
          />
        </div>
      </AdminFormSection>

      <AdminFormSection
        title="Abstract"
        note="The abstract helps users decide whether the article is relevant."
      >
        <TextareaInput label="Abstract" name="abstract" form={form} setForm={setForm} error={error} />
      </AdminFormSection>

      <AdminFormSection
        title="Access And Files"
        note="Upload the PDF directly or paste a validated URL. Article URL is optional."
      >
        <div className="admin-form-grid">
          <SelectInput
            label="Access status"
            name="accessStatus"
            form={form}
            setForm={setForm}
            error={error}
          >
            {ARTICLE_ACCESS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </SelectInput>
          <TextInput label="Article URL" name="articleUrl" form={form} setForm={setForm} error={error} />
          <FileUploadField
            label="PDF file"
            name="pdfFilePath"
            uploadType="pdf"
            form={form}
            setForm={setForm}
            error={error}
          />
        </div>
        <div className="admin-metrics-note">
          <strong>Metrics are system-managed.</strong>
          <span>
            Views, downloads, and citation counts are not editable in article entry.
          </span>
        </div>
      </AdminFormSection>
    </>
  );
}

function AdminList({ resourceKey, items, status, pagination, onEdit, onDelete, onPageChange, inlineEditId, renderInlineEdit, emptyMessage }) {
  const columns = TABLE_COLUMNS[resourceKey];

  if (status === "loading") {
    return <p className="status-text">Loading records...</p>;
  }
  if (status === "error") {
    return <p className="status-text status-text--error">Records failed to load.</p>;
  }
  if (!items.length) {
    return <p className="status-text">{emptyMessage ?? "No records found."}</p>;
  }

  if (columns) {
    return (
      <>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.header}>{col.header}</th>
                ))}
                <th className="admin-table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) =>
                item.id === inlineEditId ? (
                  <tr key={item.id}>
                    <td colSpan={columns.length + 1} className="admin-table-inline-edit-cell">
                      <InlineEditSlot>{renderInlineEdit()}</InlineEditSlot>
                    </td>
                  </tr>
                ) : (
                  <AdminTableRow
                    key={item.id}
                    item={item}
                    columns={columns}
                    resourceKey={resourceKey}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                )
              )}
            </tbody>
          </table>
        </div>
        <AdminPagination pagination={pagination} onPageChange={onPageChange} />
      </>
    );
  }

  return (
    <>
      <div className="admin-list">
        {items.map((item) =>
          item.id === inlineEditId ? (
            <InlineEditSlot key={item.id}>{renderInlineEdit()}</InlineEditSlot>
          ) : (
            <AdminListRow
              key={item.id}
              resourceKey={resourceKey}
              item={item}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )
        )}
      </div>
      <AdminPagination pagination={pagination} onPageChange={onPageChange} />
    </>
  );
}

function AdminListRow({ resourceKey, item, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const publicUrl = getPublicUrl(resourceKey, item);
  const detail = getItemDetail(resourceKey, item);
  const expandable = !publicUrl && detail.length > 0;

  return (
    <div className={`admin-list-row${expanded ? " admin-list-row--open" : ""}`}>
      <div
        className={`admin-list-row__main${expandable ? " admin-list-row__main--clickable" : ""}`}
        onClick={expandable ? () => setExpanded((v) => !v) : undefined}
      >
        <div className="admin-list-row__text">
          <strong>{getItemTitle(resourceKey, item)}</strong>
          <span>{getItemMeta(resourceKey, item)}</span>
        </div>
        {expandable ? (
          <FontAwesomeIcon
            icon={faChevronDown}
            className={`admin-list-row__chevron${expanded ? " admin-list-row__chevron--open" : ""}`}
          />
        ) : null}
        <div className="admin-list-actions" onClick={(e) => e.stopPropagation()}>
          {publicUrl ? (
            <a
              className="admin-list-view"
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
            >
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
              View
            </a>
          ) : null}
          <button className="admin-list-btn--edit" type="button" onClick={() => onEdit(item.id)}>
            Edit
          </button>
          <button className="admin-list-btn--delete" type="button" onClick={() => onDelete(item)}>
            Delete
          </button>
        </div>
      </div>
      {expanded && expandable ? (
        <dl className="admin-list-row__detail">
          {detail
            .filter(({ value }) => value !== null && value !== undefined && value !== "")
            .map(({ label, value }) => (
              <div key={label} className="admin-list-row__detail-item">
                <dt>{label}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
        </dl>
      ) : null}
    </div>
  );
}

function InlineEditSlot({ children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);
  return (
    <div ref={ref} className="admin-inline-edit">
      {children}
    </div>
  );
}

function FormPanel({ requestError, warnings, onNavigateSection, children }) {
  return (
    <div className="admin-form-panel">
      {warnings.length ? (
        <div className="admin-alert admin-alert--warning">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
      {requestError ? (
        <ErrorMessage error={requestError} onNavigateSection={onNavigateSection} />
      ) : null}
      {children}
    </div>
  );
}

function AdminPagination({ pagination, onPageChange }) {
  const { page, totalPages, total } = pagination;
  const pageSize = pagination.pageSize || PAGE_SIZE;
  const pages = totalPages || 1;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const countText = total === 0 ? "0 records" : `${from}–${to} of ${total}`;

  return (
    <div className="admin-table-controls">
      <span className="admin-table-controls__count">{countText}</span>
      <div className="admin-pagination">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(1)}>First</button>
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</button>
        <span>Page {page} of {pages}</span>
        <button type="button" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Next</button>
        <button type="button" disabled={page >= pages} onClick={() => onPageChange(pages)}>Last</button>
      </div>
    </div>
  );
}

function StatusBadge({ value }) {
  if (value == null || value === "") return <span>—</span>;
  const slug = String(value).toLowerCase().replace(/\s+/g, "-");
  return <span className={`admin-status-badge admin-status-badge--${slug}`}>{value}</span>;
}

function SortTh({ col, label, sortCol, sortDir, onSort }) {
  const active = sortCol === col;
  return (
    <th
      className={`admin-table-th--sortable${active ? " admin-table-th--active" : ""}`}
      onClick={() => onSort(col)}
    >
      {label}
      <span className="admin-sort-icon" aria-hidden="true">
        {active ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}
      </span>
    </th>
  );
}

function AdminTableRow({ item, columns, resourceKey, onEdit, onDelete }) {
  const publicUrl = getPublicUrl(resourceKey, item);
  return (
    <tr className="admin-table-row">
      {columns.map((col) => {
        const value = col.getValue(item);
        return (
          <td
            key={col.header}
            style={col.maxWidth ? { maxWidth: col.maxWidth, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : undefined}
            title={col.maxWidth ? String(value ?? "") : undefined}
          >
            {renderTableValue(value, col.type)}
          </td>
        );
      })}
      <td className="admin-table-actions-cell">
        <div className="admin-list-actions">
          {publicUrl ? (
            <a className="admin-list-view" href={publicUrl} target="_blank" rel="noreferrer">
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} /> View
            </a>
          ) : null}
          <button className="admin-list-btn--edit" type="button" onClick={() => onEdit(item.id)}>Edit</button>
          <button className="admin-list-btn--delete" type="button" onClick={() => onDelete(item)}>Delete</button>
        </div>
      </td>
    </tr>
  );
}

function renderTableValue(value, type) {
  if (type === "badge") {
    return <StatusBadge value={value} />;
  }

  if (type === "date") {
    return formatDateOnly(value);
  }

  if (type === "datetime") {
    return formatDateTime(value);
  }

  return value ?? "—";
}

function formatDateOnly(value) {
  if (!value) {
    return "—";
  }

  const dateText = String(value).slice(0, 10);
  const parsed = new Date(`${dateText}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(parsed);
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const normalized = String(value).includes("T")
    ? String(value)
    : String(value).replace(" ", "T");
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

function Field({ label, name, error, children, required = false, hint = null }) {
  const fieldError = error?.fieldErrors?.[name];

  return (
    <label className={fieldError ? "admin-field admin-field--invalid" : "admin-field"}>
      <span>
        {label}
        {required ? <em aria-label="required">*</em> : null}
      </span>
      {children}
      {hint && !fieldError ? <small className="admin-field__hint">{hint}</small> : null}
      {fieldError ? <small>{fieldError}</small> : null}
    </label>
  );
}

function TextInput({ label, name, form, setForm, error, type = "text", placeholder = "", required = false, hint = null }) {
  return (
    <Field label={label} name={name} error={error} required={required} hint={hint}>
      <input
        type={type}
        value={form[name] ?? ""}
        placeholder={placeholder}
        aria-required={required}
        onChange={(event) => setForm({ ...form, [name]: event.target.value })}
      />
    </Field>
  );
}

function PasswordInput({ label, name, value, onChange, autoComplete, error, required = false }) {
  const [isVisible, setIsVisible] = useState(false);
  const action = isVisible ? "Hide" : "Show";

  return (
    <Field label={label} name={name} error={error} required={required}>
      <div className="admin-password-control">
        <input
          type={isVisible ? "text" : "password"}
          value={value}
          aria-required={required}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="admin-password-toggle"
          onClick={() => setIsVisible((current) => !current)}
          aria-label={`${action} ${label.toLowerCase()}`}
          aria-pressed={isVisible}
        >
          <FontAwesomeIcon icon={isVisible ? faEyeSlash : faEye} />
        </button>
      </div>
    </Field>
  );
}

function TextareaInput({ label, name, form, setForm, error, required = false }) {
  return (
    <Field label={label} name={name} error={error} required={required}>
      <textarea
        value={form[name] ?? ""}
        aria-required={required}
        onChange={(event) => setForm({ ...form, [name]: event.target.value })}
      />
    </Field>
  );
}

function SelectInput({ label, name, form, setForm, error, children, required = false }) {
  return (
    <Field label={label} name={name} error={error} required={required}>
      <select
        value={form[name] ?? ""}
        aria-required={required}
        onChange={(event) => setForm({ ...form, [name]: event.target.value })}
      >
        {children}
      </select>
    </Field>
  );
}

function CheckboxInput({ label, name, form, setForm }) {
  return (
    <label className="admin-checkbox-field">
      <input
        type="checkbox"
        checked={Boolean(form[name])}
        onChange={(event) => setForm({ ...form, [name]: event.target.checked })}
      />
      <span>{label}</span>
    </label>
  );
}

function TokenList({ items, getLabel, onRemove }) {
  if (!items.length) {
    return <p className="status-text">No selections yet.</p>;
  }

  return (
    <div className="admin-token-list">
      {items.map((item, index) => (
        <span key={`${getLabel(item)}-${index}`}>
          {getLabel(item)}
          <button type="button" onClick={() => onRemove(index)} aria-label="Remove">
            x
          </button>
        </span>
      ))}
    </div>
  );
}

function ErrorMessage({ error, onNavigateSection }) {
  const dependencyText = error.dependencies
    ? Object.entries(error.dependencies)
        .filter(([, value]) => Number(value) > 0)
        .map(([key, value]) => `${value} ${key}`)
        .join(", ")
    : "";
  const linkedSections = Object.entries(error.linkedRecords ?? {}).filter(
    ([, records]) => records?.length
  );

  return (
    <div className="admin-alert admin-alert--error">
      <p>{error.message}</p>
      {dependencyText ? <p>Linked records: {dependencyText}</p> : null}
      {error.guidance?.length ? (
        <ul className="admin-guidance-list">
          {error.guidance.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {linkedSections.length ? (
        <div className="admin-linked-records">
          {linkedSections.map(([resourceKey, records]) => (
            <div key={resourceKey}>
              <strong>{formatResourceLabel(resourceKey)}</strong>
              <ul>
                {records.map((record) => (
                  <li key={`${resourceKey}-${record.id}`}>{record.label}</li>
                ))}
              </ul>
              {onNavigateSection ? (
                <button type="button" onClick={() => onNavigateSection(resourceKey)}>
                  Open {formatResourceLabel(resourceKey)}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AdminToast({ toast, onClose }) {
  if (!toast) {
    return null;
  }

  return (
    <div
      className={`admin-toast admin-toast--${toast.type}`}
      role="status"
      aria-live="polite"
    >
      <div>
        <strong>{toast.title}</strong>
        <p>{toast.message}</p>
      </div>
      <button type="button" onClick={onClose} aria-label="Close notification">
        x
      </button>
    </div>
  );
}

function ConfirmDialog({ item, resource, onCancel, onConfirm }) {
  if (!item) {
    return null;
  }

  const label = getItemTitle(resource.key, item);

  return (
    <div className="admin-dialog-backdrop" role="presentation">
      <section
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-delete-title"
      >
        <h3 id="admin-delete-title">Delete {resource.singular}</h3>
        <p>
          This will delete <strong>{label}</strong>. The backend will block the
          action if other records still depend on it.
        </p>
        <div className="admin-form-actions">
          <button type="button" onClick={onConfirm}>
            Delete
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}

function getBlankForm(resourceKey) {
  return structuredClone(BLANK_FORMS[resourceKey]);
}

function normalizeForm(resourceKey, item) {
  const blank = getBlankForm(resourceKey);

  if (resourceKey === "articles") {
    return {
      ...blank,
      ...toInputValues(item),
      authors: item.authors ?? [],
      keywords: item.keywords ?? []
    };
  }

  if (resourceKey === "issues") {
    const base = { ...blank, ...toInputValues(item) };
    return {
      ...base,
      publicationMonth: item.publicationMonth != null ? String(item.publicationMonth) : ""
    };
  }

  return {
    ...blank,
    ...toInputValues(item)
  };
}

function toInputValues(item) {
  return Object.fromEntries(
    Object.entries(item ?? {}).map(([key, value]) => [key, value ?? ""])
  );
}

function preparePayload(resourceKey, form) {
  if (resourceKey === "articles") {
    return {
      ...form,
      journalId: toOptionalNumber(form.journalId),
      issueId: toOptionalNumber(form.issueId),
      authors: form.authors.map((author) =>
        author.id
          ? { id: author.id, isCorresponding: Boolean(author.isCorresponding) }
          : author
      ),
      keywords: form.keywords.map((keyword) =>
        keyword.id ? { id: keyword.id } : { name: keyword.name }
      )
    };
  }

  if (resourceKey === "volumes") {
    return {
      ...form,
      journalId: toOptionalNumber(form.journalId),
      publicationYear: toOptionalNumber(form.publicationYear)
    };
  }

  if (resourceKey === "issues") {
    return {
      ...form,
      journalId: toOptionalNumber(form.journalId),
      volumeId: toOptionalNumber(form.volumeId),
      publicationMonth: toOptionalNumber(form.publicationMonth)
    };
  }

  if (resourceKey === "announcements") {
    return {
      ...form,
      sortOrder: toOptionalNumber(form.sortOrder)
    };
  }

  if (resourceKey === "accounts") {
    return {
      ...form,
      mustChangePassword: Boolean(form.mustChangePassword)
    };
  }

  return form;
}

function toOptionalNumber(value) {
  return value === "" || value === null || value === undefined ? "" : Number(value);
}

function getResourceSingular(resourceKey) {
  return RESOURCES.find((resource) => resource.key === resourceKey)?.singular ?? "Record";
}

function normalizeAuthorDraft(author) {
  const firstName = cleanText(author.firstName);
  const lastName = cleanText(author.lastName);
  const affiliation = cleanText(author.affiliation);
  const orcid = normalizeOrcidInput(author.orcid);

  return {
    ...author,
    firstName,
    lastName,
    affiliation,
    orcid,
    displayName: cleanText(author.displayName) || [firstName, lastName].filter(Boolean).join(" ")
  };
}

function findAuthorSuggestions(input, authors, currentId = null) {
  const draft = normalizeAuthorDraft(input);

  if (!draft.orcid && (!draft.firstName || !draft.lastName)) {
    return [];
  }

  return authors
    .filter((author) => String(author.id) !== String(currentId ?? ""))
    .filter((author) => authorMatchesDraft(author, draft))
    .sort((left, right) => scoreAuthorMatch(right, draft) - scoreAuthorMatch(left, draft))
    .slice(0, 5);
}

function findExactAuthorMatch(input, authors) {
  const draft = normalizeAuthorDraft(input);

  return (
    authors.find((author) => draft.orcid && normalizeOrcidInput(author.orcid) === draft.orcid) ??
    authors.find(
      (author) =>
        draft.firstName &&
        draft.lastName &&
        draft.affiliation &&
        cleanText(author.firstName).toLowerCase() === draft.firstName.toLowerCase() &&
        cleanText(author.lastName).toLowerCase() === draft.lastName.toLowerCase() &&
        cleanText(author.affiliation).toLowerCase() === draft.affiliation.toLowerCase()
    ) ??
    null
  );
}

function authorMatchesDraft(author, draft) {
  if (draft.orcid && normalizeOrcidInput(author.orcid) === draft.orcid) {
    return true;
  }

  return (
    draft.firstName &&
    draft.lastName &&
    cleanText(author.firstName).toLowerCase() === draft.firstName.toLowerCase() &&
    cleanText(author.lastName).toLowerCase() === draft.lastName.toLowerCase()
  );
}

function scoreAuthorMatch(author, draft) {
  if (draft.orcid && normalizeOrcidInput(author.orcid) === draft.orcid) {
    return 3;
  }

  if (
    draft.affiliation &&
    cleanText(author.affiliation).toLowerCase() === draft.affiliation.toLowerCase()
  ) {
    return 2;
  }

  return 1;
}

function authorAlreadySelected(selectedAuthors, author) {
  const draft = normalizeAuthorDraft(author);

  return selectedAuthors.some((selected) => {
    if (selected.id && author.id) {
      return Number(selected.id) === Number(author.id);
    }

    const selectedDraft = normalizeAuthorDraft(selected);

    if (draft.orcid && selectedDraft.orcid && draft.orcid === selectedDraft.orcid) {
      return true;
    }

    return (
      draft.firstName &&
      draft.lastName &&
      draft.affiliation &&
      selectedDraft.firstName.toLowerCase() === draft.firstName.toLowerCase() &&
      selectedDraft.lastName.toLowerCase() === draft.lastName.toLowerCase() &&
      selectedDraft.affiliation.toLowerCase() === draft.affiliation.toLowerCase()
    );
  });
}

function normalizeKeywordInput(value) {
  return cleanText(value).toLowerCase();
}

function findExactKeyword(normalizedKeyword, keywords, currentId = null) {
  if (!normalizedKeyword) {
    return null;
  }

  return (
    keywords.find(
      (keyword) =>
        String(keyword.id) !== String(currentId ?? "") &&
        normalizeKeywordInput(keyword.name) === normalizedKeyword
    ) ?? null
  );
}

function findKeywordSuggestions(normalizedKeyword, keywords, selectedKeywords = []) {
  if (!normalizedKeyword) {
    return [];
  }

  return keywords
    .filter((keyword) => !keywordAlreadySelected(selectedKeywords, keyword))
    .filter((keyword) => normalizeKeywordInput(keyword.name).includes(normalizedKeyword))
    .sort((left, right) => {
      const leftExact = normalizeKeywordInput(left.name) === normalizedKeyword ? 1 : 0;
      const rightExact = normalizeKeywordInput(right.name) === normalizedKeyword ? 1 : 0;
      return rightExact - leftExact || left.name.localeCompare(right.name);
    })
    .slice(0, 5);
}

function keywordAlreadySelected(selectedKeywords, keyword) {
  const normalizedKeyword = normalizeKeywordInput(keyword.name);

  return selectedKeywords.some((selected) => {
    if (selected.id && keyword.id) {
      return Number(selected.id) === Number(keyword.id);
    }

    return normalizeKeywordInput(selected.name) === normalizedKeyword;
  });
}

function cleanText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeOrcidInput(value) {
  const text = cleanText(value);

  if (!text) {
    return "";
  }

  return text.startsWith("https://orcid.org/") ? text : `https://orcid.org/${text}`;
}

function formatIssnPair(printIssn, onlineIssn) {
  const values = [
    printIssn ? `Print ${printIssn}` : "",
    onlineIssn ? `Online ${onlineIssn}` : ""
  ].filter(Boolean);

  return values.length ? values.join(" / ") : "—";
}

function getItemTitle(resourceKey, item) {
  if (resourceKey === "accounts") {
    return item.displayName;
  }

  if (resourceKey === "volumes") {
    return `${item.journalTitle} Vol. ${item.volumeNumber}`;
  }

  if (resourceKey === "issues") {
    return `${item.journalTitle} Vol. ${item.volumeNumber}, No. ${item.issueNumber}`;
  }

  if (resourceKey === "authors") {
    return item.displayName;
  }

  if (resourceKey === "keywords") {
    return item.name;
  }

  if (resourceKey === "announcements") {
    return item.title;
  }

  return item.title;
}

function getItemMeta(resourceKey, item) {
  if (resourceKey === "accounts") {
    return `${item.username} | ${item.role} | ${item.accountStatus}${item.mustChangePassword ? " | password change required" : ""}`;
  }

  if (resourceKey === "journals") {
    return `${item.publisherName ?? "No publisher"} | ${item.issueCount ?? 0} issues | ${item.articleCount ?? 0} articles`;
  }

  if (resourceKey === "volumes") {
    return `${item.publicationYear ?? "No year"} | ${item.issueCount ?? 0} issues`;
  }

  if (resourceKey === "issues") {
    return `Volume year ${item.publicationYear ?? "not set"} | Published ${item.datePublished ?? "not set"} | ${item.articleCount ?? 0} articles`;
  }

  if (resourceKey === "articles") {
    return `${item.journalTitle}${item.volume ? ` | Vol. ${item.volume}, No. ${item.issueNumber}` : " | Online first"} | ${item.authors?.join(", ") ?? "No authors"}`;
  }

  if (resourceKey === "authors") {
    return `${item.affiliation ?? "No affiliation"} | ${item.articleCount ?? 0} articles`;
  }

  if (resourceKey === "announcements") {
    return `${item.label} | ${item.status} | ${item.publishDate ?? "No publish date"}`;
  }

  return `${item.articleCount ?? 0} articles`;
}

function getPublicUrl(resourceKey, item) {
  if (resourceKey === "articles") return `/articles/${item.id}`;
  if (resourceKey === "issues") return `/issues/${item.id}`;
  if (resourceKey === "journals") return `/journals/${item.id}`;
  return null;
}

function getItemDetail(resourceKey, item) {
  if (resourceKey === "volumes") {
    return [
      { label: "Journal", value: item.journalTitle },
      { label: "Volume Number", value: item.volumeNumber },
      { label: "Publication Year", value: item.publicationYear },
      { label: "Volume Title", value: item.volumeTitle },
      { label: "Issues", value: item.issueCount ?? 0 }
    ];
  }
  if (resourceKey === "issues") {
    return [
      { label: "Journal", value: item.journalTitle },
      { label: "Volume", value: `Vol. ${item.volumeNumber}` },
      { label: "Issue Number", value: item.issueNumber },
      { label: "Issue Title", value: item.issueTitle },
      { label: "Volume Year", value: item.publicationYear },
      { label: "Date Published", value: item.datePublished },
      { label: "Publication Month", value: item.publicationMonth },
      { label: "Articles", value: item.articleCount ?? 0 }
    ];
  }
  if (resourceKey === "authors") {
    return [
      { label: "Display Name", value: item.displayName },
      { label: "First Name", value: item.firstName },
      { label: "Middle Name", value: item.middleName },
      { label: "Last Name", value: item.lastName },
      { label: "Suffix", value: item.suffix },
      { label: "Affiliation", value: item.affiliation },
      { label: "ORCID", value: item.orcid },
      { label: "Articles", value: item.articleCount ?? 0 }
    ];
  }
  if (resourceKey === "keywords") {
    return [];
  }
  if (resourceKey === "announcements") {
    return [
      { label: "Label", value: item.label },
      { label: "Status", value: item.status },
      { label: "Publish Date", value: item.publishDate },
      { label: "Summary", value: item.summary },
      { label: "Link URL", value: item.href },
      { label: "Link Label", value: item.linkLabel },
      { label: "Sort Order", value: item.sortOrder }
    ];
  }
  if (resourceKey === "accounts") {
    return [
      { label: "Username", value: item.username },
      { label: "Email", value: item.email },
      { label: "Role", value: item.role },
      { label: "Status", value: item.accountStatus },
      { label: "Password Change Required", value: item.mustChangePassword ? "Yes" : "No" }
    ];
  }
  return [];
}

function formatErrorToast(error) {
  const dependencyText = error.dependencies
    ? Object.entries(error.dependencies)
        .filter(([, value]) => Number(value) > 0)
        .map(([key, value]) => `${value} ${key}`)
        .join(", ")
    : "";

  return {
    type: "error",
    title: "Action needed",
    message: dependencyText
      ? `${error.message} Linked records: ${dependencyText}.`
      : error.message
  };
}

function formatResourceLabel(resourceKey) {
  if (resourceKey === "issues") {
    return "Issues";
  }

  if (resourceKey === "articles") {
    return "Articles";
  }

  return getResourceSingular(resourceKey);
}

function TrustedDomainsManager() {
  const [domains, setDomains] = useState([]);
  const [loadStatus, setLoadStatus] = useState("loading");
  const [newDomain, setNewDomain] = useState("");
  const [addStatus, setAddStatus] = useState("idle");
  const [addError, setAddError] = useState("");
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadDomains();
  }, []);

  useEffect(() => {
    if (!message || message.type !== "success") return undefined;
    const t = setTimeout(() => setMessage(null), 4500);
    return () => clearTimeout(t);
  }, [message]);

  async function loadDomains() {
    setLoadStatus("loading");
    try {
      const data = await fetchAdminList("trusted-domains");
      setDomains(Array.isArray(data) ? data : (data.items ?? []));
      setLoadStatus("ready");
    } catch {
      setLoadStatus("error");
    }
  }

  async function handleAdd(event) {
    event.preventDefault();
    setAddStatus("saving");
    setAddError("");
    setMessage(null);
    try {
      await createAdminItem("trusted-domains", { domain: newDomain.trim() });
      setNewDomain("");
      setMessage({ type: "success", text: "Domain added successfully." });
      await loadDomains();
    } catch (error) {
      setAddError(error.fieldErrors?.domain ?? error.message ?? "Failed to add domain.");
    } finally {
      setAddStatus("idle");
    }
  }

  async function handleRemove(id, domain) {
    if (!window.confirm(`Remove trusted domain "${domain}"?\n\nExisting reader accounts from this domain are not deleted.`)) {
      return;
    }
    setMessage(null);
    try {
      await deleteAdminItem("trusted-domains", id);
      setMessage({ type: "success", text: `"${domain}" removed.` });
      await loadDomains();
    } catch (error) {
      setMessage({ type: "error", text: error.message ?? "Failed to remove domain." });
    }
  }

  const addErrorObj = addError ? { fieldErrors: { domain: addError } } : null;

  return (
    <section className="admin-panel">
      <div className="admin-panel__heading">
        <div>
          <h2>Trusted Domains</h2>
          <p>
            Email domains allowed for reader self-registration. Students with an
            email from a trusted domain can create a reader account automatically.
          </p>
        </div>
      </div>

      {message ? (
        <div className={`admin-alert admin-alert--${message.type}`}>{message.text}</div>
      ) : null}

      <div className="admin-trusted-domain-add">
        <div className="admin-trusted-domain-add__heading">
          <h3>Add a domain</h3>
          <p>Enter the domain without "@" — for example: <strong>students.example.edu</strong></p>
        </div>
        <form className="admin-trusted-domain-add__form" onSubmit={handleAdd}>
          <div className="admin-trusted-domain-add__row">
            <input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="students.example.edu.ph"
              className={addError ? "admin-trusted-domain-add__input--error" : ""}
              aria-label="Domain"
            />
            <button
              type="submit"
              className="admin-trusted-domain-add__btn"
              disabled={addStatus === "saving" || !newDomain.trim()}
            >
              {addStatus === "saving" ? "Adding…" : "Add Domain"}
            </button>
          </div>
          {addError ? <p className="admin-trusted-domain-add__error">{addError}</p> : null}
        </form>
      </div>

      <div className="admin-trusted-domain-list">
        <h3>Current Trusted Domains</h3>
        {loadStatus === "loading" ? (
          <p className="status-text">Loading domains…</p>
        ) : loadStatus === "error" ? (
          <p className="status-text status-text--error">Failed to load domains.</p>
        ) : domains.length === 0 ? (
          <p className="status-text">No trusted domains configured yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Date added</th>
                  <th className="admin-table-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((d) => (
                  <tr key={d.id} className="admin-table-row">
                    <td>
                      <code className="admin-domain-code">{d.domain}</code>
                    </td>
                    <td>
                      {new Intl.DateTimeFormat("en", {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      }).format(new Date(d.createdAt))}
                    </td>
                    <td className="admin-table-actions-cell">
                      <div className="admin-list-actions">
                        <button
                          type="button"
                          className="admin-list-btn--delete"
                          onClick={() => handleRemove(d.id, d.domain)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function ReaderAccountsManager() {
  const [accounts, setAccounts] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
  const [loadStatus, setLoadStatus] = useState("loading");
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [sortCol, setSortCol] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [message, setMessage] = useState(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [expiryStatus, setExpiryStatus] = useState("idle");
  const [expiryError, setExpiryError] = useState("");
  const [editingExpiryId, setEditingExpiryId] = useState(null);

  useEffect(() => {
    if (!message || message.type !== "success") return undefined;
    const t = setTimeout(() => setMessage(null), 4500);
    return () => clearTimeout(t);
  }, [message]);
  const [editingExpiryDate, setEditingExpiryDate] = useState("");
  const [expiryEditStatus, setExpiryEditStatus] = useState("idle");

  useEffect(() => {
    loadAccounts(1);
  }, [search, statusFilter, pageSize, sortCol, sortDir]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(draftSearch), 350);
    return () => clearTimeout(timer);
  }, [draftSearch]);

  async function loadAccounts(page = 1) {
    setLoadStatus("loading");
    try {
      const data = await fetchAdminList("reader-accounts", {
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        pageSize,
        sort: sortCol,
        dir: sortDir
      });
      setAccounts(data.items ?? []);
      setPagination({
        total: data.total ?? 0,
        page: data.page ?? 1,
        pageSize: data.pageSize ?? pageSize,
        totalPages: Math.ceil((data.total ?? 0) / (data.pageSize ?? pageSize)) || 1
      });
      setLoadStatus("ready");
    } catch {
      setLoadStatus("error");
    }
  }

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function getReaderStatus(account) {
    if (account.status === "disabled") return "disabled";
    if (account.expiresAt && new Date(account.expiresAt) < new Date()) return "expired";
    return "active";
  }

  async function handleSaveExpiry(accountId) {
    if (!editingExpiryDate) return;
    setExpiryEditStatus("saving");
    setMessage(null);
    try {
      await updateAdminItem("reader-accounts", accountId, {
        expiresAt: new Date(editingExpiryDate).toISOString()
      });
      setEditingExpiryId(null);
      setEditingExpiryDate("");
      await loadAccounts(pagination.page);
    } catch (error) {
      setMessage({ type: "error", text: error.message ?? "Failed to update expiry." });
    } finally {
      setExpiryEditStatus("idle");
    }
  }

  function openExpiryEdit(account) {
    setEditingExpiryId(account.id);
    setEditingExpiryDate(account.expiresAt ? account.expiresAt.slice(0, 10) : "");
  }

  async function handleToggleStatus(account) {
    const derivedStatus = getReaderStatus(account);
    setMessage(null);

    if (derivedStatus === "expired") {
      if (!window.confirm(`Re-enable account: ${account.email}?\nThis will clear the expiry date.`)) return;
      try {
        await updateAdminItem("reader-accounts", account.id, { expiresAt: null });
        setMessage({ type: "success", text: "Account re-enabled — expiry cleared." });
        await loadAccounts(pagination.page);
      } catch (error) {
        setMessage({ type: "error", text: error.message ?? "Failed to update account." });
      }
      return;
    }

    const newStatus = derivedStatus === "active" ? "disabled" : "active";
    const label = newStatus === "disabled" ? "Disable" : "Re-enable";
    if (!window.confirm(`${label} account: ${account.email}?`)) return;
    try {
      await updateAdminItem("reader-accounts", account.id, { status: newStatus });
      setMessage({ type: "success", text: `Account ${newStatus === "active" ? "re-enabled" : "disabled"}.` });
      await loadAccounts(pagination.page);
    } catch (error) {
      setMessage({ type: "error", text: error.message ?? "Failed to update account." });
    }
  }

  async function handleBulkExpiry(event) {
    event.preventDefault();
    if (!expiryDate) return;
    const formatted = new Date(expiryDate).toLocaleDateString("en-PH", {
      year: "numeric", month: "long", day: "numeric"
    });
    if (!window.confirm(`Set expiry to ${formatted} for ALL active reader accounts?\n\nAccounts with this expiry will need admin renewal to continue accessing the system.`)) {
      return;
    }
    setExpiryStatus("saving");
    setExpiryError("");
    setMessage(null);
    try {
      const data = await bulkExpireReaderAccounts(new Date(expiryDate).toISOString());
      setMessage({ type: "success", text: data.message ?? "Expiry updated." });
      setExpiryDate("");
      await loadAccounts(1);
    } catch (error) {
      setExpiryError(error.fieldErrors?.expiresAt ?? error.message ?? "Failed to set expiry.");
    } finally {
      setExpiryStatus("idle");
    }
  }

  function formatDate(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
  }

  const expiryErrorObj = expiryError ? { fieldErrors: { expiresAt: expiryError } } : null;

  return (
    <section className="admin-panel">
      <div className="admin-panel__heading">
        <div>
          <h2>Reader Accounts</h2>
          <p>Student accounts created via self-registration. Accounts are created automatically when a student first requests a sign-in link.</p>
        </div>
      </div>

      {message ? (
        <div className={`admin-alert admin-alert--${message.type}`}>{message.text}</div>
      ) : null}

      <div className="admin-toolbar">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(draftSearch); }}>
          <input
            type="search"
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            placeholder="Search by email…"
          />
          <button type="submit">Search</button>
          {search ? (
            <button type="button" onClick={() => { setSearch(""); setDraftSearch(""); }}>Clear</button>
          ) : null}
        </form>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="expired">Expired</option>
        </select>
        <label className="admin-page-size-label">
          Per page
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      {loadStatus === "loading" ? (
        <p className="status-text">Loading reader accounts…</p>
      ) : loadStatus === "error" ? (
        <p className="status-text status-text--error">Failed to load reader accounts.</p>
      ) : accounts.length === 0 ? (
        <p className="status-text">No reader accounts found.</p>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <SortTh col="email" label="Email" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <th>Status</th>
                  <SortTh col="createdAt" label="Joined" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="lastSeenAt" label="Last seen" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="expiresAt" label="Expires" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <th className="admin-table-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => {
                  const derivedStatus = getReaderStatus(account);
                  const isEditingExpiry = editingExpiryId === account.id;
                  return (
                    <tr key={account.id} className="admin-table-row">
                      <td className="admin-table-primary">{account.email}</td>
                      <td><StatusBadge value={derivedStatus} /></td>
                      <td>{formatDate(account.createdAt)}</td>
                      <td>{formatDate(account.lastSeenAt)}</td>
                      <td>
                        {isEditingExpiry ? (
                          <div className="admin-expiry-edit">
                            <input
                              type="date"
                              value={editingExpiryDate}
                              onChange={(e) => setEditingExpiryDate(e.target.value)}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="admin-list-btn--edit"
                              disabled={!editingExpiryDate || expiryEditStatus === "saving"}
                              onClick={() => handleSaveExpiry(account.id)}
                            >
                              {expiryEditStatus === "saving" ? "…" : "Save"}
                            </button>
                            <button type="button" onClick={() => { setEditingExpiryId(null); setEditingExpiryDate(""); }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button type="button" className="admin-expiry-btn" onClick={() => openExpiryEdit(account)}>
                            {account.expiresAt ? formatDate(account.expiresAt) : <span className="admin-expiry-unset">Set expiry</span>}
                          </button>
                        )}
                      </td>
                      <td className="admin-table-actions-cell">
                        <div className="admin-list-actions">
                          <button
                            type="button"
                            className={derivedStatus === "active" ? "admin-list-btn--delete" : "admin-list-btn--edit"}
                            onClick={() => handleToggleStatus(account)}
                          >
                            {derivedStatus === "active" ? "Disable" : "Enable"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <AdminPagination pagination={pagination} onPageChange={loadAccounts} />
        </>
      )}

      <div className="admin-form-section" style={{ marginTop: "32px" }}>
        <h3>Bulk Expiry — Academic Year End</h3>
        <p>Set an expiry date for all active reader accounts at once. Use this at the end of each academic year. Accounts past their expiry date cannot generate new sessions until a Super Admin updates the date.</p>
        <form className="admin-form" onSubmit={handleBulkExpiry}>
          <Field label="Expiry date" name="expiresAt" error={expiryErrorObj}>
            <input
              type="date"
              value={expiryDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </Field>
          <div className="admin-form-actions">
            <button type="submit" disabled={expiryStatus === "saving" || !expiryDate}>
              {expiryStatus === "saving" ? "Saving…" : "Set Expiry for All Active Accounts"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

const AUDIT_ACTION_STYLES = {
  create:          { bg: "#dcfce7", color: "#166534", border: "#86efac" },
  update:          { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" },
  delete:          { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
  login:           { bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" },
  logout:          { bg: "#f3f4f6", color: "#374151", border: "#d1d5db" },
  password_change: { bg: "#f5f3ff", color: "#5b21b6", border: "#c4b5fd" },
  bulk_action:     { bg: "#ffedd5", color: "#9a3412", border: "#fdba74" }
};

const AUDIT_ACTION_LABELS = {
  create: "Create", update: "Update", delete: "Delete",
  login: "Login", logout: "Logout",
  password_change: "Password Change",
  bulk_action: "Bulk Action"
};

const AUDIT_RESOURCE_TYPES = [
  "journal", "volume", "issue", "article", "announcement",
  "author", "keyword", "account", "trusted_domain", "reader_account"
];

const AUDIT_DATE_FORMAT = new Intl.DateTimeFormat("en", {
  year: "numeric", month: "short", day: "numeric",
  hour: "2-digit", minute: "2-digit"
});

function formatResourceTypeLabel(rt) {
  if (!rt) return null;
  return rt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseAuditDate(str) {
  if (!str) return new Date(NaN);
  return new Date(str.includes("T") ? str : str.replace(" ", "T") + "Z");
}

function getAuditTarget(log) {
  const typeLabel = formatResourceTypeLabel(log.resourceType);
  if (!typeLabel) return null;
  if (log.action === "bulk_action") return typeLabel;
  if (log.resourceLabel) return `${typeLabel} — ${log.resourceLabel}`;
  if (log.resourceId != null) return `${typeLabel} #${log.resourceId}`;
  return typeLabel;
}

function getAuditDetails(log) {
  if (log.details) return log.details;
  if (log.action === "bulk_action") return log.resourceLabel ?? null;
  const rt = (log.resourceType ?? "").replace(/_/g, " ");
  const fallbacks = {
    login: "Signed in",
    logout: "Signed out",
    password_change: "Changed password",
    create: rt ? `Created new ${rt}` : "Created",
    update: rt ? `Updated ${rt}` : "Updated",
    delete: rt ? `Deleted ${rt}` : "Deleted",
  };
  return fallbacks[log.action] ?? null;
}

function AuditLogsManager() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 25, totalPages: 1 });
  const [loadStatus, setLoadStatus] = useState("loading");
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pageSize, setPageSize] = useState(25);

  const hasActiveFilters = search || actionFilter || resourceTypeFilter || dateFrom || dateTo;

  useEffect(() => { loadLogs(1); }, [search, actionFilter, resourceTypeFilter, dateFrom, dateTo, pageSize]);

  async function loadLogs(page = 1) {
    setLoadStatus("loading");
    try {
      const data = await fetchAuditLogs({
        page,
        limit: pageSize,
        search: search || undefined,
        action: actionFilter || undefined,
        resourceType: resourceTypeFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      });
      setLogs(data.items ?? []);
      setPagination({
        total: data.total ?? 0,
        page: data.page ?? 1,
        pageSize: data.limit ?? pageSize,
        totalPages: Math.ceil((data.total ?? 0) / (data.limit ?? pageSize)) || 1
      });
      setLoadStatus("ready");
    } catch {
      setLoadStatus("error");
    }
  }

  function clearAllFilters() {
    setDraftSearch("");
    setSearch("");
    setActionFilter("");
    setResourceTypeFilter("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel__heading">
        <div>
          <h2>Audit Logs</h2>
          <p>A record of all administrative actions performed in this portal.</p>
        </div>
      </div>

      <div className="admin-toolbar admin-toolbar--inline">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(draftSearch.trim()); }}>
          <input
            type="search"
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            placeholder="Search admin or resource…"
          />
          <button type="submit">Search</button>
          {search ? (
            <button type="button" onClick={() => { setSearch(""); setDraftSearch(""); }}>Clear</button>
          ) : null}
        </form>

        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} aria-label="Filter by action">
          <option value="">All actions</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select value={resourceTypeFilter} onChange={(e) => setResourceTypeFilter(e.target.value)} aria-label="Filter by resource">
          <option value="">All resources</option>
          {AUDIT_RESOURCE_TYPES.map((rt) => (
            <option key={rt} value={rt}>{formatResourceTypeLabel(rt)}</option>
          ))}
        </select>

        <label className="admin-page-size-label">
          From
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>

        <label className="admin-page-size-label">
          To
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>

        <label className="admin-page-size-label">
          Per page
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>

        {hasActiveFilters ? (
          <button type="button" onClick={clearAllFilters}>Clear filters</button>
        ) : null}
      </div>

      {loadStatus === "loading" ? (
        <p className="status-text">Loading audit logs…</p>
      ) : loadStatus === "error" ? (
        <p className="status-text status-text--error">Failed to load audit logs.</p>
      ) : logs.length === 0 ? (
        <p className="status-text">
          {hasActiveFilters ? "No entries match the current filters." : "No audit log entries yet."}
        </p>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date / Time</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const style = AUDIT_ACTION_STYLES[log.action] ?? AUDIT_ACTION_STYLES.update;
                  const target = getAuditTarget(log);
                  const details = getAuditDetails(log);
                  return (
                    <tr key={log.id} className="admin-table-row">
                      <td>{AUDIT_DATE_FORMAT.format(parseAuditDate(log.createdAt))}</td>
                      <td>
                        <div className="admin-table-primary">{log.adminDisplayName}</div>
                        <div className="admin-table-secondary">{log.adminRole}</div>
                      </td>
                      <td>
                        <span className="admin-status-badge"
                          style={{
                            background: style.bg,
                            color: style.color,
                            border: `1px solid ${style.border}`
                          }}>
                          {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      <td>{target ?? "—"}</td>
                      <td className="admin-table-secondary">{details ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <AdminPagination pagination={pagination} onPageChange={loadLogs} />
        </>
      )}
    </section>
  );
}
