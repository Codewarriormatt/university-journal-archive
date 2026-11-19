import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookOpen, faDownload, faEye, faQuoteRight, faRobot } from "@fortawesome/free-solid-svg-icons";
import { fetchJournal } from "../api/repositoryApi.js";

export function JournalDetailPage() {
  const { id } = useParams();
  const [journal, setJournal] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let isActive = true;
    setStatus("loading");

    fetchJournal(id)
      .then((data) => {
        if (isActive) {
          setJournal(data);
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
  }, [id]);

  if (status === "loading") {
    return (
      <main className="page-main">
        <p className="status-text">Loading journal...</p>
      </main>
    );
  }

  if (status === "error" || !journal) {
    return (
      <main className="page-main">
        <p className="status-text status-text--error">Journal not found.</p>
        <Link to="/records" className="text-link">
          Back to records
        </Link>
      </main>
    );
  }

  const volumes = journal.volumes ?? [];
  const onlineFirstArticles = journal.onlineFirstArticles ?? [];
  const totalIssues = volumes.reduce((sum, v) => sum + v.issues.length, 0);

  return (
    <main className="page-main">
      <article className="detail-page detail-page--with-cover">
        <div>
          <Link to="/records" className="text-link">
            Back to records
          </Link>
          <p className="eyebrow">Journal</p>
          <h1>{journal.title}</h1>
          <p className="detail-summary">{journal.description}</p>
        </div>
        {journal.defaultCoverImage ? (
          <img
            className="detail-cover"
            src={journal.defaultCoverImage}
            alt={`${journal.title} cover`}
          />
        ) : null}
      </article>

      <section className="content-section content-section--narrow">
        <dl className="metadata-grid metadata-grid--single-card">
          <div>
            <dt>Subject Area</dt>
            <dd>{journal.subjectArea}</dd>
          </div>
          <div>
            <dt>Publisher</dt>
            <dd>{journal.publisherName}</dd>
          </div>
          <div>
            <dt>Place</dt>
            <dd>{journal.placeOfPublication}</dd>
          </div>
          <div>
            <dt>ISSN</dt>
            <dd>
              Print {journal.printIssn} / Online {journal.onlineIssn}
            </dd>
          </div>
          <div>
            <dt>Abbreviation</dt>
            <dd>{journal.abbreviation ?? "N/A"}</dd>
          </div>
          <div>
            <dt>Volumes</dt>
            <dd>{volumes.length}</dd>
          </div>
          <div>
            <dt>Issues</dt>
            <dd>{totalIssues}</dd>
          </div>
          <div>
            <dt>Online First</dt>
            <dd>{onlineFirstArticles.length}</dd>
          </div>
        </dl>

        {journal.journalUrl ? (
          <a className="button-link" href={journal.journalUrl}>
            Open journal site
          </a>
        ) : null}

        <div className="sidebar-panel" style={{ marginTop: "1.5rem" }}>
          <h2>Journal Metrics</h2>
          <dl className="metric-list">
            <div>
              <dt>
                <FontAwesomeIcon icon={faBookOpen} />
                Articles
              </dt>
              <dd>{journal.totalArticleCount ?? 0}</dd>
            </div>
            <div>
              <dt>
                <FontAwesomeIcon icon={faEye} />
                Total Views
              </dt>
              <dd>{journal.totalViewCount ?? 0}</dd>
            </div>
            <div>
              <dt>
                <FontAwesomeIcon icon={faDownload} />
                Total Downloads
              </dt>
              <dd>{journal.totalDownloadCount ?? 0}</dd>
            </div>
            <div>
              <dt>
                <FontAwesomeIcon icon={faQuoteRight} />
                Total Citations
              </dt>
              <dd>{journal.totalCitationCount ?? 0}</dd>
            </div>
          </dl>
        </div>

        <div className="sidebar-panel sidebar-panel--ai" id="insight" style={{ marginTop: "1.5rem" }}>
          <div className="sidebar-panel__ai-header">
            <FontAwesomeIcon icon={faRobot} className="sidebar-panel__ai-icon" aria-hidden="true" />
            <h2>Journal Overview</h2>
            <span className="ai-badge">AI-generated</span>
          </div>
          {journal.aiInsight ? (
            <>
              <p className="sidebar-panel__ai-text">{journal.aiInsight}</p>
              {journal.aiInsightUpdatedAt ? (
                <p className="sidebar-panel__ai-meta">
                  Updated {new Date(journal.aiInsightUpdatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              ) : null}
            </>
          ) : (
            <p className="sidebar-panel__ai-empty">
              {journal.totalArticleCount > 0
                ? "Insight is being generated — check back in a few minutes."
                : "Insight will be available once articles are added to this journal."}
            </p>
          )}
        </div>
      </section>

      <section className="content-section content-section--narrow">
        <div className="section-heading">
          <h2>Volumes in this journal</h2>
        </div>
        {volumes.length === 0 ? (
          <p className="status-text">No volumes yet.</p>
        ) : (
          volumes.map((volume) => (
            <div key={volume.id} className="volume-group">
              <div className="volume-sidebar">
                <span className="volume-sidebar__label">Vol. {volume.volumeNumber}</span>
                {volume.volumeTitle ? <span className="volume-sidebar__title">{volume.volumeTitle}</span> : null}
                <span className="volume-year">{volume.publicationYear}</span>
              </div>
              <div className="volume-issues">
                {volume.issues.length === 0 ? (
                  <p className="volume-issues__empty">No issues yet.</p>
                ) : (
                  volume.issues.map((issue) => (
                    <article className="issue-card" key={issue.id}>
                      {issue.issueCoverImage ? (
                        <img
                          className="issue-card__cover"
                          src={issue.issueCoverImage}
                          alt={`Issue ${issue.issueNumber} cover`}
                        />
                      ) : null}
                      <div className="issue-card__body">
                        <h4 className="issue-card__title">
                          <Link to={`/issues/${issue.id}`}>
                            No. {issue.issueNumber}
                            {issue.issueTitle ? ` — ${issue.issueTitle}` : ""}
                          </Link>
                        </h4>
                        <p className="issue-card__meta">
                          {issue.monthLabel ? `${issue.monthLabel} ${volume.publicationYear}` : volume.publicationYear}
                          {" · "}{issue.articleCount} article{issue.articleCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <Link to={`/issues/${issue.id}`} className="issue-card__btn">View Issue</Link>
                    </article>
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </section>

      {onlineFirstArticles.length ? (
        <section className="content-section content-section--narrow">
          <div className="section-heading">
            <p className="eyebrow">Online first</p>
            <h2>Articles not yet assigned to an issue</h2>
          </div>
          <div className="related-list">
            {onlineFirstArticles.map((article) => (
              <article className="related-item" key={article.id}>
                <h3>
                  <Link to={`/articles/${article.id}`}>{article.title}</Link>
                </h3>
                {article.authors.length ? (
                  <p className="related-item__authors">{article.authors.join(", ")}</p>
                ) : null}
                {article.publicationYear ? (
                  <p className="related-item__context">{article.publicationYear}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
