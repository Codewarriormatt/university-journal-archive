import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchRecords } from "../api/repositoryApi.js";

const STAT_CARDS = [
  { key: "journals",    label: "Journals"     },
  { key: "issues",      label: "Issues"       },
  { key: "articles",    label: "Articles"     },
  { key: "onlineFirst", label: "Online First" }
];

const INITIAL_STATS = {
  journals: 0,
  issues: 0,
  articles: 0,
  onlineFirst: 0
};

export function AboutPage() {
  const [stats, setStats] = useState(INITIAL_STATS);

  useEffect(() => {
    let isActive = true;

    fetchRecords({ limit: 100 })
      .then((data) => {
        if (isActive) {
          setStats(getRepositoryStats(data.items));
        }
      })
      .catch(() => {
        if (isActive) {
          setStats(INITIAL_STATS);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <main className="page-main about-page">
      <section className="about-hero">
        <div className="about-hero__copy">
          <p className="eyebrow">About the Journal Archive</p>
          <h1>A searchable home for university journals and articles.</h1>
          <p>
            The archive organizes journal, issue, and article records so academic
            work can be found, reviewed, cited, and maintained in one digital
            repository.
          </p>
          <Link className="button-link" to="/records">
            Open Catalog
          </Link>
        </div>
        <img
          src="https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1400&q=80"
          alt="Library shelves with academic books"
        />
      </section>

      <section className="about-stats" aria-label="Repository snapshot">
        {STAT_CARDS.map((card) => (
          <div key={card.key} className="about-stat-card">
            <strong className="about-stat-card__number">{stats[card.key]}</strong>
            <span className="about-stat-card__label">{card.label}</span>
          </div>
        ))}
      </section>

      <div className="about-paper-stack">
        <span className="about-paper-sheet about-paper-sheet--back" aria-hidden="true" />
        <span className="about-paper-sheet about-paper-sheet--front" aria-hidden="true" />
        <article className="about-paper">
          <header className="about-paper__meta">
            <p>Archive profile</p>
            <span>University Journal Archive</span>
          </header>

          <div className="about-paper__body">
            <section>
              <span>01</span>
              <img
                src="https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1000&q=80"
                alt="Rows of library shelves with research books"
              />
              <div>
                <h2>Our Mission</h2>
                <p>
                  To provide a dependable digital archive where university journal
                  records, issue information, article metadata, citations, and
                  access links are organized for discovery, reference, and
                  long-term academic use.
                </p>
              </div>
            </section>

            <section>
              <span>02</span>
              <img
                src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1000&q=80"
                alt="Academic papers and notes on a desk"
              />
              <div>
                <h2>Our Vision</h2>
                <p>
                  To make institutional research easier to find, evaluate, and
                  cite by maintaining a clear online record of journals and
                  articles that can support students, faculty, researchers, and
                  repository staff.
                </p>
              </div>
            </section>

            <section>
              <span>03</span>
              <img
                src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=80"
                alt="Laptop showing digital research work"
              />
              <div>
                <h2>Our Organisation</h2>
                <p>
                  The archive is structured around connected scholarly records:
                  journals, volumes, issues, articles, authors, and keywords.
                  This organization keeps metadata consistent and supports
                  practical workflows such as browsing an issue, opening a paper,
                  copying a citation, and managing article access.
                </p>
              </div>
            </section>

            <section>
              <span>04</span>
              <img
                src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1000&q=80"
                alt="People working together around laptops"
              />
              <div>
                <h2>Partnerships And Collaborations</h2>
                <p>
                  The repository supports collaboration between academic units,
                  editors, authors, and repository administrators by keeping
                  published records visible, maintainable, and ready for future
                  enhancements such as richer analytics and AI-assisted paper
                  insights.
                </p>
              </div>
            </section>
          </div>
        </article>
      </div>
    </main>
  );
}

function getRepositoryStats(records) {
  return records.reduce(
    (totals, record) => {
      if (record.recordType === "journal") {
        totals.journals += 1;
        totals.onlineFirst += record.onlineFirstArticleCount ?? 0;
      }

      if (record.recordType === "issue") {
        totals.issues += 1;
      }

      if (record.recordType === "article") {
        totals.articles += 1;
      }

      return totals;
    },
    { ...INITIAL_STATS }
  );
}
