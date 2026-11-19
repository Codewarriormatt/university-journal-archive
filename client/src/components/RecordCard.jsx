import { useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronUp,
  faLink,
  faLock,
  faLockOpen,
  faRobot
} from "@fortawesome/free-solid-svg-icons";
import { useReaderAuth } from "../context/ReaderAuthContext.jsx";

export function RecordCard({ record }) {
  const detailsPath = getDetailsPath(record);
  const typeLabel = getTypeLabel(record.recordType);
  const isRestricted = record.accessStatus === "Restricted";
  const { canDownload } = useReaderAuth();
  const { authors, context } = getMetaParts(record);
  const sideDetails = getSideDetails(record);
  const [insightOpen, setInsightOpen] = useState(false);
  const isJournal = record.recordType === "journal";

  return (
    <article className={`record-card${insightOpen ? " record-card--expanded" : ""}`}>
      <div className="record-card__main">
        <div className="record-card__topline">
          <span className={`record-type record-type--${record.recordType}`}>
            {typeLabel}
          </span>
          {record.subjectArea ? <span>{record.subjectArea}</span> : null}
          {isRestricted && canDownload ? (
            <span className="record-type record-type--unlocked" title="You have download access">
              <FontAwesomeIcon icon={faLockOpen} /> Access granted
            </span>
          ) : isRestricted ? (
            <span className="record-type record-type--restricted" title="Sign in required to download">
              <FontAwesomeIcon icon={faLock} /> Restricted
            </span>
          ) : null}
        </div>
        <h3>
          <Link to={detailsPath}>
            {record.title}
            <FontAwesomeIcon icon={faLink} aria-hidden="true" />
          </Link>
        </h3>
        {authors ? <p className="record-card__authors">{authors}</p> : null}
        {context ? <p className="record-card__context">{context}</p> : null}
        {record.summary ? <p className="record-card__summary">{record.summary}</p> : null}
        {record.keywords?.length ? (
          <div className="keyword-list" aria-label="Keywords">
            {record.keywords.slice(0, 4).map((keyword) => (
              <span key={keyword}>{keyword}</span>
            ))}
          </div>
        ) : null}
        {isJournal ? (
          <div className="record-card__insight-wrap">
            <button
              type="button"
              className={`record-card__insight record-card__insight--active${insightOpen ? " record-card__insight--open" : ""}`}
              onClick={() => setInsightOpen((o) => !o)}
              aria-expanded={insightOpen}
            >
              <FontAwesomeIcon icon={faRobot} aria-hidden="true" />
              Journal Overview
              <FontAwesomeIcon icon={insightOpen ? faChevronUp : faChevronDown} className="record-card__insight-chevron" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      <aside className="record-card__side" aria-label={`${typeLabel} quick actions`}>
        <dl>
          {sideDetails.map((detail) => (
            <div key={detail.label}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      </aside>

      {isJournal && insightOpen ? (
        <div className="record-card__insight-panel" role="region" aria-label="AI-generated journal overview">
          <div className="record-card__insight-panel-header">
            <FontAwesomeIcon icon={faRobot} aria-hidden="true" />
            <span>Journal Overview</span>
            <span className="ai-badge">AI-generated</span>
          </div>
          {record.aiInsight ? (
            <>
              <p className="record-card__insight-text">{record.aiInsight}</p>
              {record.aiInsightUpdatedAt ? (
                <p className="record-card__insight-meta">
                  Updated {new Date(record.aiInsightUpdatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              ) : null}
            </>
          ) : (
            <p className="record-card__insight-empty">
              {record.articleCount > 0
                ? "Insight is being generated — check back in a few minutes."
                : "Insight will be available once articles are added to this journal."}
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function getMetaParts(record) {
  if (record.recordType === "journal") {
    return { authors: null, context: null };
  }

  if (record.recordType === "issue") {
    return {
      authors: null,
      context: [
        record.journalTitle,
        record.monthLabel && record.year
          ? `${record.monthLabel} ${record.year}`
          : record.year,
        `${record.articleCount ?? 0} articles`
      ].filter(Boolean).join(" · ")
    };
  }

  return {
    authors: record.authors?.length ? record.authors.join(", ") : null,
    context: record.pageRange ? `pp. ${record.pageRange}` : null
  };
}

function getSideDetails(record) {
  if (record.recordType === "journal") {
    return [
      { label: "Publisher", value: record.publisherName ?? "N/A" },
      { label: "ISSN", value: record.onlineIssn ?? record.printIssn ?? "N/A" },
      { label: "Latest", value: record.latestIssueYear ?? "N/A" },
      { label: "Articles", value: record.articleCount ?? 0 }
    ];
  }

  if (record.recordType === "issue") {
    return [
      { label: "Journal", value: record.journalTitle ?? "N/A" },
      { label: "Year", value: record.year ?? "N/A" },
      { label: "Volume", value: record.volume ? `Vol. ${record.volume}` : "N/A" },
      { label: "Articles", value: record.articleCount ?? 0 }
    ];
  }

  return [
    { label: "Year", value: record.year ?? "N/A" },
    { label: "Journal", value: record.journalTitle ?? "N/A" },
    { label: "Issue", value: record.issueId ? `Vol. ${record.volume}, No. ${record.issueNumber}` : "Online first" },
    { label: "DOI", value: record.doi ?? "N/A" }
  ];
}

function getDetailsPath(record) {
  if (record.recordType === "journal") {
    return `/journals/${record.id}`;
  }

  if (record.recordType === "issue") {
    return `/issues/${record.id}`;
  }

  return `/articles/${record.id}`;
}

function getTypeLabel(recordType) {
  if (recordType === "journal") {
    return "Journal";
  }

  if (recordType === "issue") {
    return "Issue";
  }

  return "Article";
}
