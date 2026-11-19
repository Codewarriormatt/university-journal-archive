import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMedal } from "@fortawesome/free-solid-svg-icons";
import { fetchHomepageHighlights, fetchRecords } from "../api/repositoryApi.js";
import { SearchBar } from "../components/SearchBar.jsx";

const JOURNAL_TABS = [
  { key: "latest", label: "Most recent" },
  { key: "mostViewed", label: "Most viewed" },
  { key: "mostCited", label: "Most cited" }
];

const ARTICLE_TABS = [
  { key: "latest", label: "Most recent" },
  { key: "mostViewed", label: "Most viewed" },
  { key: "mostCited", label: "Most cited" },
  { key: "mostDownloaded", label: "Most downloaded" }
];

const EMPTY_HIGHLIGHTS = {
  announcements: [],
  latestJournals: [],
  latestArticles: [],
  journalRankings: {
    mostViewed: [],
    mostCited: [],
    popular: []
  },
  articleRankings: {
    mostViewed: [],
    mostCited: [],
    mostDownloaded: [],
    popular: []
  },
  topics: {
    mostSearched: [],
    popular: []
  }
};

export function HomePage() {
  const [highlights, setHighlights] = useState(EMPTY_HIGHLIGHTS);
  const [stats, setStats] = useState({
    journals: 0,
    issues: 0,
    articles: 0
  });
  const [status, setStatus] = useState("loading");
  const [journalTab, setJournalTab] = useState("latest");
  const [articleTab, setArticleTab] = useState("latest");

  useEffect(() => {
    let isActive = true;

    Promise.all([fetchRecords({ limit: 100 }), fetchHomepageHighlights()])
      .then(([recordsData, highlightsData]) => {
        if (isActive) {
          setHighlights(highlightsData);
          setStats({
            journals: countRecords(recordsData.items, "journal"),
            issues: countRecords(recordsData.items, "issue"),
            articles: countRecords(recordsData.items, "article")
          });
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

  return (
    <main>
      <section className="search-hero">
        <div className="search-hero__content">
          <p className="eyebrow">Online Journal and Article Repository</p>
          <h1>Find journals and articles.</h1>
          <SearchBar />
          <div className="repository-stats" aria-label="Repository summary">
            <div>
              <strong>{stats.journals}</strong>
              <span>Journals</span>
            </div>
            <div>
              <strong>{stats.issues}</strong>
              <span>Issues</span>
            </div>
            <div>
              <strong>{stats.articles}</strong>
              <span>Articles</span>
            </div>
          </div>
        </div>
      </section>

      <section className="content-section home-highlights-section">
        {status === "loading" ? <p className="status-text">Loading records...</p> : null}
        {status === "error" ? (
          <p className="status-text status-text--error">
            The API is not available yet.
          </p>
        ) : null}
        {status === "ready" ? (
          <HomepageRepositoryBoard
            highlights={highlights}
            journalTab={journalTab}
            articleTab={articleTab}
            onJournalTabChange={setJournalTab}
            onArticleTabChange={setArticleTab}
          />
        ) : null}
      </section>
    </main>
  );
}

function countRecords(records, recordType) {
  return records.filter((record) => record.recordType === recordType).length;
}

function HomepageRepositoryBoard({
  highlights,
  journalTab,
  articleTab,
  onJournalTabChange,
  onArticleTabChange
}) {
  const journalLists = {
    latest: highlights.latestJournals,
    ...highlights.journalRankings
  };
  const articleLists = {
    latest: highlights.latestArticles,
    ...highlights.articleRankings
  };

  return (
    <div className="home-board">
      <div className="home-board__header">
        <h2>New, ranked, and searchable records</h2>
        <Link className="button-link button-link--secondary" to="/records">
          Open full catalog
        </Link>
      </div>

      <AnnouncementBoard announcements={highlights.announcements} />

      <div className="home-board__grid">
        <RankedPanel
          title="Top 10 Journals"
          tabs={JOURNAL_TABS}
          activeTab={journalTab}
          onTabChange={onJournalTabChange}
          items={journalLists[journalTab] ?? []}
          itemType="journal"
        />
        <RankedPanel
          title="Top 10 Articles"
          tabs={ARTICLE_TABS}
          activeTab={articleTab}
          onTabChange={onArticleTabChange}
          items={articleLists[articleTab] ?? []}
          itemType="article"
        />
      </div>

      <TopicBoard topics={highlights.topics} />
    </div>
  );
}

function AnnouncementBoard({ announcements }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [timerKey, setTimerKey] = useState(0);
  const total = announcements.length;

  useEffect(() => {
    if (total <= 1) return;
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % total);
    }, 10_000);
    return () => clearInterval(id);
  }, [total, timerKey]);

  function goTo(index) {
    setActiveIndex(index);
    setTimerKey((k) => k + 1);
  }

  if (!total) {
    return (
      <section className="announcement-board" aria-labelledby="ann-heading">
        <div className="announcement-board__header">
          <h3 id="ann-heading">Announcement Board</h3>
        </div>
        <p className="status-text">No published announcements yet.</p>
      </section>
    );
  }

  const active = announcements[activeIndex];
  const isNew = isRecentAnnouncement(active.date);

  return (
    <section className="announcement-board" aria-labelledby="ann-heading">
      <div className="announcement-board__header">
        <h3 id="ann-heading">Announcement Board</h3>
        {total > 1 ? (
          <div className="announcement-nav" role="group" aria-label="Announcement navigation">
            <button
              className="announcement-nav__btn"
              onClick={() => goTo((activeIndex - 1 + total) % total)}
              aria-label="Previous announcement"
            >
              &#8592;
            </button>
            <span className="announcement-nav__count" aria-live="polite">
              {String(activeIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
            <button
              className="announcement-nav__btn"
              onClick={() => goTo((activeIndex + 1) % total)}
              aria-label="Next announcement"
            >
              &#8594;
            </button>
          </div>
        ) : null}
      </div>

      <div className={`announcement-spotlight${total === 1 ? " announcement-spotlight--solo" : ""}`}>
        {/* Featured card */}
        <div className="announcement-featured">
          <div className="announcement-featured__body" key={active.id} aria-live="polite" aria-atomic="true">
            <span className="announcement-featured__label">
              {isNew ? <span className="announcement-new-dot" aria-hidden="true" /> : null}
              {active.label}
            </span>
            <h4 className="announcement-featured__title">{active.title}</h4>
            <p className="announcement-featured__summary">{active.summary}</p>
            {active.image ? (
              <div className="announcement-featured__image">
                <img src={active.image} alt={`${active.title} announcement image`} />
              </div>
            ) : null}
            <div className="announcement-featured__footer">
              <time dateTime={active.date}>{formatDate(active.date)}</time>
              {active.href && active.linkLabel ? (
                <AnnouncementLink announcement={active} />
              ) : null}
            </div>
          </div>
          {total > 1 ? (
            <div className="announcement-progress" aria-hidden="true">
              <div key={`${activeIndex}-${timerKey}`} className="announcement-progress__bar" />
            </div>
          ) : null}
        </div>

        {/* Sidebar */}
        {total > 1 ? (
          <nav
            className="announcement-sidebar"
            aria-label="All announcements"
          >
            {announcements.map((item, i) => {
              const itemIsNew = isRecentAnnouncement(item.date);
              return (
                <button
                  key={item.id}
                  className={`announcement-sidebar__item${i === activeIndex ? " announcement-sidebar__item--active" : ""}`}
                  onClick={() => goTo(i)}
                  aria-current={i === activeIndex ? "true" : undefined}
                >
                  <span className="announcement-sidebar__label">
                    {itemIsNew ? <span className="announcement-new-dot" aria-hidden="true" /> : null}
                    {item.label}
                  </span>
                  <span className="announcement-sidebar__title">{item.title}</span>
                  <time className="announcement-sidebar__date" dateTime={item.date}>
                    {formatDate(item.date)}
                  </time>
                </button>
              );
            })}
          </nav>
        ) : null}
      </div>
    </section>
  );
}

function AnnouncementLink({ announcement }) {
  if (announcement.href.startsWith("http://") || announcement.href.startsWith("https://")) {
    return (
      <a href={announcement.href} target="_blank" rel="noreferrer">
        {announcement.linkLabel}
      </a>
    );
  }

  return <Link to={announcement.href}>{announcement.linkLabel}</Link>;
}

function RankedPanel({ title, tabs, activeTab, onTabChange, items, itemType }) {
  return (
    <section className="ranked-panel">
      <div className="ranked-panel__heading">
        <h3>{title}</h3>
      </div>
      <div className="ranked-tabs" role="tablist" aria-label={`${title} view`}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={activeTab === tab.key ? "ranked-tab ranked-tab--active" : "ranked-tab"}
            type="button"
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div key={activeTab} className="ranked-list">
        {items.length ? (
          items.map((item, index) => (
            <RankedItem
              key={`${itemType}-${activeTab}-${item.id}`}
              item={item}
              itemType={itemType}
              rank={index + 1}
              animIndex={index}
            />
          ))
        ) : (
          <p className="status-text">No records yet.</p>
        )}
      </div>
    </section>
  );
}

const MEDAL_COLORS = {
  1: { color: "#92650a", bg: "#fef3c7", border: "#fcd34d" },
  2: { color: "#4b5563", bg: "#f1f5f9", border: "#cbd5e1" },
  3: { color: "#7c3a1e", bg: "#fef0e7", border: "#fdba74" }
};

function RankedItem({ item, itemType, rank, animIndex }) {
  const href = itemType === "journal" ? `/journals/${item.id}` : `/articles/${item.id}`;
  const medal = MEDAL_COLORS[rank];
  const subtitle = getItemSubtitle(item, itemType);

  return (
    <Link to={href} className="ranked-item" style={{ "--item-delay": `${animIndex * 35}ms` }}>
      <div
        className="ranked-item__rank"
        style={medal ? { background: medal.bg, color: medal.color, border: `1px solid ${medal.border}` } : undefined}
        aria-label={`Rank ${rank}`}
      >
        {medal
          ? <FontAwesomeIcon icon={faMedal} />
          : String(rank).padStart(2, "0")}
      </div>

      <div className="ranked-item__body">
        <span className="ranked-item__title">{item.title}</span>
        <p className="ranked-item__subtitle">{subtitle}</p>

        <div className="ranked-item__expand">
          <div>
            <div className="ranked-item__expand-inner">
              <div className="ranked-item__meta">
                <span>{itemType === "journal" ? "Journal" : "Article"}</span>
                {item.subjectArea ? <span>{item.subjectArea}</span> : null}
              </div>
              {item.summary ? <p className="ranked-item__desc">{item.summary}</p> : null}
              <div className="ranked-item__metrics">
                {itemType === "article" && item.year ? <span>{item.year}</span> : null}
                {itemType === "journal" ? <span>{item.articleCount ?? 0} articles</span> : null}
                <span>{item.viewCount ?? 0} views</span>
                {itemType === "article" ? <span>{item.downloadCount ?? 0} downloads</span> : null}
                {itemType === "article" ? <span>{item.citationCount ?? 0} citations</span> : null}
                {itemType === "journal" && (item.citationCount ?? 0) > 0 ? <span>{item.citationCount} citations</span> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function getItemSubtitle(item, itemType) {
  if (itemType === "journal") {
    return item.publisherName ? `Publisher: ${item.publisherName}` : "Journal record";
  }
  const authors = item.authors?.length ? item.authors.join(", ") : "Unknown author";
  return authors;
}


function TopicBoard({ topics }) {
  return (
    <section className="topic-board" aria-labelledby="topic-board-heading">
      <div className="home-board__subheading">
        <Link to="/records?type=article&field=keyword">Search by keyword</Link>
      </div>
      <div className="topic-grid">
        <TopicList
          title="Top 10 Most Searched Topics"
          topics={topics.mostSearched}
          metricSingular="search"
          metricPlural="searches"
          metricKey="searchCount"
        />
        <TopicList
          title="Top 10 Article Keywords"
          topics={topics.popular}
          metricSingular="article"
          metricPlural="articles"
          metricKey="articleCount"
        />
      </div>
    </section>
  );
}

function TopicList({ title, topics, metricSingular, metricPlural, metricKey }) {
  return (
    <div className="topic-list">
      <h4>{title}</h4>
      {topics.length ? (
        <ol>
          {topics.map((topic, index) => {
            const rank = index + 1;
            const medal = MEDAL_COLORS[rank];
            return (
              <li key={`${title}-${topic.id}`}>
                <div
                  className="topic-rank"
                  style={medal ? { background: medal.bg, color: medal.color, border: `1px solid ${medal.border}` } : undefined}
                  aria-label={`Rank ${rank}`}
                >
                  {medal
                    ? <FontAwesomeIcon icon={faMedal} />
                    : String(rank).padStart(2, "0")}
                </div>
                <Link to={`/records?type=article&field=keyword&search=${encodeURIComponent(topic.name)}`}>
                  {topic.name}
                </Link>
                <span>
                  {topic[metricKey]} {topic[metricKey] === 1 ? metricSingular : metricPlural}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="status-text">No topics yet.</p>
      )}
    </div>
  );
}

function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [inView, threshold]);
  return [ref, inView];
}

function isRecentAnnouncement(dateString) {
  if (!dateString) return false;
  const posted = new Date(`${dateString}T00:00:00`);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  return posted >= cutoff;
}


function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}
