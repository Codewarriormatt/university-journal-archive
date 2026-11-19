import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchIssue } from "../api/repositoryApi.js";

export function IssueDetailPage() {
  const { id } = useParams();
  const [issue, setIssue] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let isActive = true;
    setStatus("loading");

    fetchIssue(id)
      .then((data) => {
        if (isActive) {
          setIssue(data);
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
        <p className="status-text">Loading issue...</p>
      </main>
    );
  }

  if (status === "error" || !issue) {
    return (
      <main className="page-main">
        <p className="status-text status-text--error">Issue not found.</p>
        <Link to="/records" className="text-link">
          Back to records
        </Link>
      </main>
    );
  }

  return (
    <main className="page-main">
      <article className="detail-page detail-page--with-cover">
        <div>
          <Link to={`/journals/${issue.journalId}`} className="text-link">
            Back to journal
          </Link>
          <p className="eyebrow">Journal issue</p>
          <h1>
            {issue.journalTitle} Vol. {issue.volume}, No. {issue.issueNumber}
          </h1>
          {issue.issueTitle ? (
            <p className="detail-summary">{issue.issueTitle}</p>
          ) : null}
        </div>
        {issue.issueCoverImage ? (
          <img
            className="detail-cover"
            src={issue.issueCoverImage}
            alt={`${issue.journalTitle} issue cover`}
          />
        ) : null}
      </article>

      <section className="content-section content-section--narrow">
        <dl className="metadata-grid metadata-grid--single-card">
          <div>
            <dt>Journal</dt>
            <dd>
              <Link to={`/journals/${issue.journalId}`}>{issue.journalTitle}</Link>
            </dd>
          </div>
          <div>
            <dt>Month / Year</dt>
            <dd>
              {issue.monthLabel ? `${issue.monthLabel} ` : ""}
              {issue.publicationYear}
            </dd>
          </div>
          <div>
            <dt>Date Published</dt>
            <dd>{issue.datePublished ?? "N/A"}</dd>
          </div>
          <div>
            <dt>Publisher</dt>
            <dd>{issue.publisherName}</dd>
          </div>
          <div>
            <dt>ISSN</dt>
            <dd>
              Print {issue.printIssn} / Online {issue.onlineIssn}
            </dd>
          </div>
        </dl>

      </section>

      <section className="content-section content-section--narrow">
        <div className="section-heading">
          <h2>Articles in this issue</h2>
        </div>
        <div className="related-list">
          {issue.articles.map((article) => (
            <article className="issue-card issue-card--article" key={article.id}>
              <div className="issue-card__body">
                <h4 className="issue-card__title">
                  <Link to={`/articles/${article.id}`}>{article.title}</Link>
                </h4>
                {article.authors.length ? (
                  <p className="issue-card__authors">{article.authors.join(", ")}</p>
                ) : null}
                {(article.pageRange || article.doi) ? (
                  <p className="issue-card__meta">
                    {[
                      article.pageRange ? `pp. ${article.pageRange}` : null,
                      article.doi
                    ].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                {article.keywords.length ? (
                  <div className="keyword-list keyword-list--sm">
                    {article.keywords.map((keyword) => (
                      <span key={keyword}>{keyword}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              <Link to={`/articles/${article.id}`} className="issue-card__btn">Read Article</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
