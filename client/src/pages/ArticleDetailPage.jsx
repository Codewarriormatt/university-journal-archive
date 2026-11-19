import { useContext, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRightFromSquare,
  faCopy,
  faDownload,
  faEye,
  faFilePdf,
  faLock,
  faQuoteRight
} from "@fortawesome/free-solid-svg-icons";
import { Link, useLocation, useParams } from "react-router-dom";
import { fetchArticle, getArticlePdfDownloadUrl, recordArticleCitation } from "../api/repositoryApi.js";
import { ReaderAuthContext } from "../context/ReaderAuthContext.jsx";

export function ArticleDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const { canDownload } = useContext(ReaderAuthContext);
  const [article, setArticle] = useState(null);
  const [status, setStatus] = useState("loading");
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    let isActive = true;
    setStatus("loading");

    fetchArticle(id)
      .then((data) => {
        if (isActive) {
          setArticle(data);
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
        <p className="status-text">Loading article...</p>
      </main>
    );
  }

  if (status === "error" || !article) {
    return (
      <main className="page-main">
        <p className="status-text status-text--error">Article not found.</p>
        <Link to="/records" className="text-link">
          Back to records
        </Link>
      </main>
    );
  }

  async function handleCopyCitation() {
    try {
      await navigator.clipboard.writeText(article.apaCitation);
      setCopyStatus("Citation copied.");
      recordArticleCitation(article.id);
    } catch {
      setCopyStatus("Copy failed. Select the citation text manually.");
    }
  }

  function handleDownloadCitation(format) {
    const citationText =
      format === "bibtex" ? formatBibTexCitation(article) : formatRisCitation(article);
    const extension = format === "bibtex" ? "bib" : "ris";
    const fileName = `${buildCitationFileName(article)}.${extension}`;
    const blob = new Blob([citationText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setCopyStatus(`${format === "bibtex" ? "BibTeX" : "RIS"} citation downloaded.`);
    recordArticleCitation(article.id);
  }

  const authorText = article.authors.map((author) => author.displayName).join(", ");
  const issueText = article.issueId
    ? `Vol. ${article.volume}, No. ${article.issueNumber}`
    : "Online first / Issue not assigned";
  const pdfDownloadUrl = getArticlePdfDownloadUrl(article.id);

  return (
    <main className="page-main">
      <article className="article-detail">
        <div className="article-detail__header">
          <Link to="/records" className="text-link">
            Back to records
          </Link>
          <p className="eyebrow">Article</p>
          <h1>{article.title}</h1>
          <p className="article-authors">{authorText}</p>
        </div>

        <div className="article-detail__layout">
          <div className="article-detail__main">
            <dl className="metadata-grid metadata-grid--article metadata-grid--single-card">
              <div>
                <dt>Journal</dt>
                <dd>
                  <Link to={`/journals/${article.journalId}`}>
                    {article.journalTitle}
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Issue</dt>
                <dd>
                  {article.issueId ? (
                    <Link to={`/issues/${article.issueId}`}>{issueText}</Link>
                  ) : (
                    issueText
                  )}
                </dd>
              </div>
              <div>
                <dt>Date Published</dt>
                <dd>{article.datePublished ?? article.issueDatePublished ?? "N/A"}</dd>
              </div>
              <div>
                <dt>Pages</dt>
                <dd>{article.pageRange ? `pp. ${article.pageRange}` : "Not assigned"}</dd>
              </div>
              <div>
                <dt>DOI</dt>
                <dd>{article.doi ?? "N/A"}</dd>
              </div>
              <div>
                <dt>Subject Area</dt>
                <dd>{article.subjectArea}</dd>
              </div>
              <div>
                <dt>Publisher</dt>
                <dd>{article.publisherName}</dd>
              </div>
              <div>
                <dt>ISSN</dt>
                <dd>
                  {[article.printIssn, article.onlineIssn].filter(Boolean).join(" / ") ||
                    "N/A"}
                </dd>
              </div>
            </dl>

            <section className="detail-block">
              <h2>Abstract</h2>
              <p className="detail-summary">{article.abstract}</p>
            </section>

            {article.keywords.length ? (
              <section className="detail-block">
                <h2>Keywords</h2>
                <div className="keyword-list" aria-label="Article keywords">
                  {article.keywords.map((keyword) => (
                    <Link
                      key={keyword}
                      to={`/records?type=article&field=keyword&search=${encodeURIComponent(
                        keyword
                      )}`}
                    >
                      {keyword}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="detail-block">
              <div className="detail-block__heading">
                <h2>How to Cite</h2>
                <div className="citation-actions">
                  <button
                    className="inline-action"
                    type="button"
                    onClick={handleCopyCitation}
                  >
                    <FontAwesomeIcon icon={faCopy} />
                    Copy APA Citation
                  </button>
                  <button
                    className="inline-action"
                    type="button"
                    onClick={() => handleDownloadCitation("bibtex")}
                  >
                    <FontAwesomeIcon icon={faDownload} />
                    Download BibTeX
                  </button>
                  <button
                    className="inline-action"
                    type="button"
                    onClick={() => handleDownloadCitation("ris")}
                  >
                    <FontAwesomeIcon icon={faDownload} />
                    Download RIS
                  </button>
                </div>
              </div>
              <textarea
                className="citation-textbox"
                value={article.apaCitation}
                readOnly
                aria-label="APA citation"
              />
              {copyStatus ? <p className="copy-status">{copyStatus}</p> : null}
            </section>

            {article.relatedArticles?.length ? (
              <section className="detail-block">
                <h2>Related Articles</h2>
                <div className="related-list related-list--articles">
                  {article.relatedArticles.map((relatedArticle) => (
                    <article className="issue-card issue-card--article" key={relatedArticle.id}>
                      <div className="issue-card__body">
                        {relatedArticle.relatedReasons.length ? (
                          <p className="issue-card__reasons">{relatedArticle.relatedReasons.join(" · ")}</p>
                        ) : null}
                        <h4 className="issue-card__title">
                          <Link to={`/articles/${relatedArticle.id}`}>
                            {relatedArticle.title}
                          </Link>
                        </h4>
                        {relatedArticle.authors?.length ? (
                          <p className="issue-card__authors">{relatedArticle.authors.join(", ")}</p>
                        ) : null}
                        <p className="issue-card__meta">
                          {[
                            relatedArticle.year,
                            relatedArticle.journalTitle,
                            relatedArticle.issueId
                              ? `Vol. ${relatedArticle.volume}, No. ${relatedArticle.issueNumber}`
                              : "Online first"
                          ].filter(Boolean).join(" · ")}
                        </p>
                        {relatedArticle.summary ? (
                          <p className="issue-card__summary">{relatedArticle.summary}</p>
                        ) : null}
                      </div>
                      <Link to={`/articles/${relatedArticle.id}`} className="issue-card__btn">Read Article</Link>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="article-detail__sidebar" aria-label="Article actions and metrics">
            <section className="sidebar-panel">
              <h2>Access</h2>
              <p>{article.accessStatus}</p>
              <div className="button-stack">
                {article.accessStatus === "Restricted" && !canDownload ? (
                  <div className="pdf-locked">
                    <FontAwesomeIcon icon={faLock} />
                    <p>Sign in to download this PDF.</p>
                    <Link
                      className="button-link"
                      to={`/login?redirect=${encodeURIComponent(location.pathname)}`}
                    >
                      Sign in
                    </Link>
                  </div>
                ) : (
                  <>
                    <a
                      className={`button-link${!article.hasPdf ? " button-link--disabled" : ""}`}
                      href={article.hasPdf ? `${pdfDownloadUrl}?inline=1` : undefined}
                      target={article.hasPdf ? "_blank" : undefined}
                      rel={article.hasPdf ? "noreferrer" : undefined}
                      aria-disabled={!article.hasPdf}
                      title={!article.hasPdf ? "No PDF file uploaded for this article" : undefined}
                    >
                      <FontAwesomeIcon icon={faFilePdf} />
                      View PDF
                    </a>
                    <a
                      className={`button-link button-link--secondary${!article.hasPdf ? " button-link--disabled" : ""}`}
                      href={article.hasPdf ? pdfDownloadUrl : undefined}
                      aria-disabled={!article.hasPdf}
                      title={!article.hasPdf ? "No PDF file uploaded for this article" : undefined}
                    >
                      <FontAwesomeIcon icon={faDownload} />
                      Download PDF
                    </a>
                  </>
                )}
                <a
                  className={`button-link button-link--secondary${!article.articleUrl ? " button-link--disabled" : ""}`}
                  href={article.articleUrl || undefined}
                  target={article.articleUrl ? "_blank" : undefined}
                  rel={article.articleUrl ? "noreferrer" : undefined}
                  aria-disabled={!article.articleUrl}
                  title={!article.articleUrl ? "No article URL set for this article" : undefined}
                >
                  <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                  Open Article Page
                </a>
              </div>
            </section>

            <section className="sidebar-panel">
              <h2>Article Metrics</h2>
              <dl className="metric-list">
                <div>
                  <dt>
                    <FontAwesomeIcon icon={faEye} />
                    Views
                  </dt>
                  <dd>{article.viewCount}</dd>
                </div>
                <div>
                  <dt>
                    <FontAwesomeIcon icon={faDownload} />
                    Downloads
                  </dt>
                  <dd>{article.downloadCount}</dd>
                </div>
                <div>
                  <dt>
                    <FontAwesomeIcon icon={faQuoteRight} />
                    Citations
                  </dt>
                  <dd>{article.citationCount}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </article>
    </main>
  );
}

function formatBibTexCitation(article) {
  return [
    `@article{${buildCitationKey(article)},`,
    `  title = {${escapeBibTex(article.title)}},`,
    `  author = {${article.authors.map(formatBibTexAuthor).join(" and ")}},`,
    `  journal = {${escapeBibTex(article.journalTitle)}},`,
    article.publicationYear ? `  year = {${article.publicationYear}},` : null,
    article.volume ? `  volume = {${escapeBibTex(article.volume)}},` : null,
    article.issueNumber ? `  number = {${escapeBibTex(article.issueNumber)}},` : null,
    article.pageRange ? `  pages = {${escapeBibTex(article.pageRange)}},` : null,
    article.doi ? `  doi = {${escapeBibTex(article.doi)}},` : null,
    article.articleUrl ? `  url = {${escapeBibTex(article.articleUrl)}},` : null,
    "}"
  ]
    .filter(Boolean)
    .join("\n");
}

function formatRisCitation(article) {
  return [
    "TY  - JOUR",
    `TI  - ${article.title}`,
    ...article.authors.map((author) => `AU  - ${formatRisAuthor(author)}`),
    `T2  - ${article.journalTitle}`,
    article.publicationYear ? `PY  - ${article.publicationYear}` : null,
    article.volume ? `VL  - ${article.volume}` : null,
    article.issueNumber ? `IS  - ${article.issueNumber}` : null,
    article.pageStart ? `SP  - ${article.pageStart}` : null,
    article.pageEnd ? `EP  - ${article.pageEnd}` : null,
    article.doi ? `DO  - ${article.doi}` : null,
    article.articleUrl ? `UR  - ${article.articleUrl}` : null,
    article.abstract ? `AB  - ${article.abstract}` : null,
    ...article.keywords.map((keyword) => `KW  - ${keyword}`),
    "ER  -"
  ]
    .filter(Boolean)
    .join("\n");
}

function formatBibTexAuthor(author) {
  if (!author.lastName) {
    return escapeBibTex(author.displayName);
  }

  return escapeBibTex(
    `${author.lastName}, ${[author.firstName, author.middleName]
      .filter(Boolean)
      .join(" ")}`
  );
}

function formatRisAuthor(author) {
  if (!author.lastName) {
    return author.displayName;
  }

  return `${author.lastName}, ${[author.firstName, author.middleName]
    .filter(Boolean)
    .join(" ")}`;
}

function buildCitationKey(article) {
  const firstAuthor = article.authors.at(0)?.lastName ?? "article";
  const firstTitleWord = article.title.split(/\s+/).find(Boolean) ?? "record";

  return sanitizeCitationKey(
    `${firstAuthor}${article.publicationYear ?? "nd"}${firstTitleWord}`
  );
}

function buildCitationFileName(article) {
  return sanitizeCitationKey(`${article.title}-${article.publicationYear ?? "nd"}`);
}

function sanitizeCitationKey(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeBibTex(value) {
  return String(value).replace(/[{}]/g, "");
}
