import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchRecords } from "../api/repositoryApi.js";
import { RecordCard } from "../components/RecordCard.jsx";

const FIELD_OPTIONS = {
  journal: [
    { value: "all", label: "All fields" },
    { value: "title", label: "Title" },
    { value: "issn", label: "ISSN" },
    { value: "subject", label: "Subject area" },
    { value: "publisher", label: "Publisher" }
  ],
  article: [
    { value: "all", label: "All fields" },
    { value: "title", label: "Title" },
    { value: "author", label: "Author" },
    { value: "doi", label: "DOI" },
    { value: "subject", label: "Subject area" },
    { value: "keyword", label: "Keyword" },
    { value: "publication_year", label: "Publication year" },
    { value: "volume", label: "Volume" },
    { value: "issue_number", label: "Issue number" },
    { value: "semantic", label: "Semantic search (AI)" }
  ]
};

const SORT_OPTIONS = {
  journal: [
    { value: "title_asc", label: "Title A-Z" },
    { value: "title_desc", label: "Title Z-A" },
    { value: "newest_issue_year", label: "Newest issue year" },
    { value: "oldest_issue_year", label: "Oldest issue year" }
  ],
  article: [
    { value: "newest_year", label: "Newest publication year" },
    { value: "oldest_year", label: "Oldest publication year" },
    { value: "title_asc", label: "Title A-Z" },
    { value: "title_desc", label: "Title Z-A" }
  ]
};
const PAGE_SIZE_OPTIONS = [10, 25, 50];
const DEFAULT_PAGE_SIZE = 10;

export function ListingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const type = normalizeType(searchParams.get("type"));
  const search = searchParams.get("search") ?? "";
  const field = normalizeField(searchParams.get("field"), type);
  const subject = searchParams.get("subject") ?? "all";
  const publisher = type === "journal" ? searchParams.get("publisher") ?? "all" : "all";
  const journal = type === "article" ? searchParams.get("journal") ?? "all" : "all";
  const year = type === "article" ? searchParams.get("year") ?? "all" : "all";
  const yearFrom = type === "article" ? normalizeYearInput(searchParams.get("yearFrom")) : "";
  const yearTo = type === "article" ? normalizeYearInput(searchParams.get("yearTo")) : "";
  const sort = normalizeSort(searchParams.get("sort"), type);
  const page = normalizePage(searchParams.get("page"));
  const pageSize = normalizePageSize(searchParams.get("pageSize"));

  const [draftSearch, setDraftSearch] = useState(search);
  const [draftField, setDraftField] = useState(field);
  const [records, setRecords] = useState([]);
  const [facetRecords, setFacetRecords] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize,
    totalPages: 1
  });
  const [status, setStatus] = useState("loading");
  const [semanticSearch, setSemanticSearch] = useState(false);
  const [semanticUnavailable, setSemanticUnavailable] = useState(false);

  const pageText = getPageText(type);
  const resultLabel = pagination.total === 1 ? pageText.singular : pageText.plural;
  const subjectOptions = useMemo(
    () => getUniqueOptions(facetRecords, "subjectArea"),
    [facetRecords]
  );
  const publisherOptions = useMemo(
    () => getUniqueOptions(facetRecords, "publisherName"),
    [facetRecords]
  );
  const journalOptions = useMemo(
    () => getUniqueOptions(facetRecords, "journalTitle"),
    [facetRecords]
  );
  const hasActiveControls =
    Boolean(search) ||
    field !== "all" ||
    subject !== "all" ||
    publisher !== "all" ||
    journal !== "all" ||
    year !== "all" ||
    Boolean(yearFrom) ||
    Boolean(yearTo) ||
    sort !== getDefaultSort(type);

  useEffect(() => {
    setDraftSearch(search);
  }, [search]);

  useEffect(() => {
    setDraftField(semanticUnavailable && field === "semantic" ? "all" : field);
  }, [field, semanticUnavailable]);

  useEffect(() => {
    if (semanticUnavailable && draftField === "semantic") setDraftField("all");
  }, [semanticUnavailable]);

  useEffect(() => {
    let isActive = true;
    setStatus("loading");

    fetchRecords({
      search,
      type,
      field,
      subject,
      publisher,
      journal,
      year,
      yearFrom,
      yearTo,
      sort,
      page,
      pageSize
    })
      .then((data) => {
        if (isActive) {
          setRecords(data.items);
          setPagination({
            total: data.total,
            page: data.page,
            pageSize: data.pageSize,
            totalPages: data.totalPages
          });
          setSemanticSearch(data.semanticSearch ?? false);
          if (data.semanticUnavailable) setSemanticUnavailable(true);
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
  }, [
    search,
    type,
    field,
    subject,
    publisher,
    journal,
    year,
    yearFrom,
    yearTo,
    sort,
    page,
    pageSize
  ]);

  useEffect(() => {
    let isActive = true;

    fetchRecords({ type, limit: 100 })
      .then((data) => {
        if (isActive) {
          setFacetRecords(data.items);
        }
      })
      .catch(() => {
        if (isActive) {
          setFacetRecords([]);
        }
      });

    return () => {
      isActive = false;
    };
  }, [type]);

  function updateCatalogParams(updates) {
    const nextType = normalizeType(updates.type ?? type);
    const nextField = normalizeField(updates.field ?? field, nextType);
    const nextSort = normalizeSort(updates.sort ?? sort, nextType);
    const isPageOnlyUpdate =
      Object.keys(updates).length === 1 &&
      Object.prototype.hasOwnProperty.call(updates, "page");
    const nextValues = {
      type: nextType,
      search,
      field: nextField,
      subject,
      publisher: nextType === "journal" ? publisher : "all",
      journal: nextType === "article" ? journal : "all",
      year: nextType === "article" ? year : "all",
      yearFrom: nextType === "article" ? yearFrom : "",
      yearTo: nextType === "article" ? yearTo : "",
      sort: nextSort,
      page: isPageOnlyUpdate ? normalizePage(updates.page) : 1,
      pageSize: normalizePageSize(updates.pageSize ?? pageSize),
      ...updates
    };

    if (updates.type) {
      nextValues.field = "all";
      nextValues.publisher = "all";
      nextValues.journal = "all";
      nextValues.year = "all";
      nextValues.yearFrom = "";
      nextValues.yearTo = "";
      nextValues.sort = getDefaultSort(nextType);
      nextValues.page = 1;
    }

    const params = new URLSearchParams();
    params.set("type", nextValues.type);

    if (nextValues.search?.trim()) {
      params.set("search", nextValues.search.trim());
    }

    if (nextValues.field && nextValues.field !== "all") {
      params.set("field", nextValues.field);
    }

    if (nextValues.subject && nextValues.subject !== "all") {
      params.set("subject", nextValues.subject);
    }

    if (nextValues.type === "journal" && nextValues.publisher !== "all") {
      params.set("publisher", nextValues.publisher);
    }

    if (nextValues.type === "article" && nextValues.journal !== "all") {
      params.set("journal", nextValues.journal);
    }

    if (nextValues.type === "article" && nextValues.year !== "all") {
      params.set("year", nextValues.year);
    }

    if (nextValues.type === "article" && nextValues.yearFrom) {
      params.set("yearFrom", normalizeYearInput(nextValues.yearFrom));
    }

    if (nextValues.type === "article" && nextValues.yearTo) {
      params.set("yearTo", normalizeYearInput(nextValues.yearTo));
    }

    if (nextValues.sort && nextValues.sort !== getDefaultSort(nextValues.type)) {
      params.set("sort", nextValues.sort);
    }

    if (nextValues.page && Number(nextValues.page) > 1) {
      params.set("page", String(normalizePage(nextValues.page)));
    }

    if (nextValues.pageSize !== DEFAULT_PAGE_SIZE) {
      params.set("pageSize", String(normalizePageSize(nextValues.pageSize)));
    } else {
      params.set("pageSize", String(DEFAULT_PAGE_SIZE));
    }

    setSearchParams(params);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    updateCatalogParams({
      search: draftSearch,
      field: normalizeField(draftField, type)
    });
  }

  function clearCatalogControls() {
    setDraftSearch("");
    setDraftField("all");
    setSearchParams({ type, pageSize: String(pageSize) });
  }

  return (
    <main className="page-main">
      <section className="content-section catalog-section">
        <div className="catalog-heading">
          <div>
            <p className="eyebrow">Catalog</p>
            <h1>{pageText.title}</h1>
            <p>{pageText.subtitle}</p>
          </div>
          <div className="catalog-tabs" aria-label="Catalog type">
            <button
              className={type === "journal" ? "catalog-tab catalog-tab--active" : "catalog-tab"}
              type="button"
              onClick={() => updateCatalogParams({ type: "journal" })}
            >
              Journals
            </button>
            <button
              className={type === "article" ? "catalog-tab catalog-tab--active" : "catalog-tab"}
              type="button"
              onClick={() => updateCatalogParams({ type: "article" })}
            >
              Articles
            </button>
          </div>
        </div>

        <form className="catalog-search" onSubmit={handleSearchSubmit}>
          <label className="catalog-search__query">
            <span>Search term</span>
            <input
              type="search"
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder={pageText.placeholder}
            />
          </label>
          <label>
            <span>Search in</span>
            <select
              value={draftField}
              onChange={(event) => setDraftField(normalizeField(event.target.value, type))}
            >
              {FIELD_OPTIONS[type]
                .filter((option) => !(option.value === "semantic" && semanticUnavailable))
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
          </label>
          <button type="submit">Search</button>
        </form>

        <div className="catalog-layout">
          <aside className="catalog-filters" aria-label={`${pageText.title} filters`}>
            <div className="catalog-panel-heading">
              <h2>Filters</h2>
              {hasActiveControls ? (
                <button type="button" onClick={clearCatalogControls}>
                  Clear
                </button>
              ) : null}
            </div>

            <label>
              <span>Subject area</span>
              <select
                value={subject}
                onChange={(event) =>
                  updateCatalogParams({ subject: event.target.value })
                }
              >
                <option value="all">All subjects</option>
                {subjectOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            {type === "journal" ? (
              <label>
                <span>Publisher</span>
                <select
                  value={publisher}
                  onChange={(event) =>
                    updateCatalogParams({ publisher: event.target.value })
                  }
                >
                  <option value="all">All publishers</option>
                  {publisherOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {type === "article" ? (
              <>
                <label>
                  <span>Journal</span>
                  <select
                    value={journal}
                    onChange={(event) =>
                      updateCatalogParams({ journal: event.target.value })
                    }
                  >
                    <option value="all">All journals</option>
                    {journalOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Year from</span>
                  <input
                    type="number"
                    min="1900"
                    max="2100"
                    value={yearFrom}
                    placeholder="Any year"
                    onChange={(event) =>
                      updateCatalogParams({ yearFrom: normalizeYearInput(event.target.value) })
                    }
                  />
                </label>
                <label>
                  <span>Year to</span>
                  <input
                    type="number"
                    min="1900"
                    max="2100"
                    value={yearTo}
                    placeholder="Any year"
                    onChange={(event) =>
                      updateCatalogParams({ yearTo: normalizeYearInput(event.target.value) })
                    }
                  />
                </label>
              </>
            ) : null}

            <label>
              <span>Sort</span>
              <select
                value={sort}
                onChange={(event) => updateCatalogParams({ sort: event.target.value })}
              >
                {SORT_OPTIONS[type].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </aside>

          <section className="catalog-results" aria-live="polite">
            {semanticUnavailable && (
              <div className="semantic-unavailable-banner" role="alert">
                <strong>Semantic search is currently unavailable.</strong>
                {" "}Showing keyword results instead. The option has been removed for this session.
              </div>
            )}
            {status === "loading" ? (
              <p className="status-text">Loading {pageText.plural.toLowerCase()}...</p>
            ) : null}
            {status === "error" ? (
              <p className="status-text status-text--error">
                The API is not available yet.
              </p>
            ) : null}
            {status === "ready" ? (
              <>
                <div className="catalog-result-summary">
                  <div>
                    <div className="result-count-row">
                      <p>{pagination.total} {resultLabel} found</p>
                      {semanticSearch && (
                        <span className="semantic-pill">
                          <span className="ai-badge">AI</span>
                          Semantic results
                        </span>
                      )}
                    </div>
                    {search ? <span>Search: {search}</span> : null}
                  </div>
                  <label className="results-page-size">
                    <span>Results per page</span>
                    <select
                      value={pagination.pageSize}
                      onChange={(event) =>
                        updateCatalogParams({ pageSize: event.target.value })
                      }
                    >
                      {PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {records.length === 0 ? (
                  <p className="status-text">No {pageText.plural.toLowerCase()} found.</p>
                ) : (
                  <>
                    <div className="record-list">
                      {records.map((record) => (
                        <RecordCard
                          key={`${record.recordType}-${record.id}`}
                          record={record}
                        />
                      ))}
                    </div>
                    <PaginationControls
                      page={pagination.page}
                      totalPages={pagination.totalPages}
                      onPageChange={(nextPage) => updateCatalogParams({ page: nextPage })}
                    />
                  </>
                )}
              </>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}

function normalizeType(value) {
  return value === "article" ? "article" : "journal";
}

function normalizeField(value, type) {
  return FIELD_OPTIONS[type].some((option) => option.value === value)
    ? value
    : "all";
}

function normalizeSort(value, type) {
  return SORT_OPTIONS[type].some((option) => option.value === value)
    ? value
    : getDefaultSort(type);
}

function normalizeYearInput(value) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 4);
}

function normalizePage(value) {
  const parsedPage = Number.parseInt(value, 10);

  return Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
}

function normalizePageSize(value) {
  const parsedPageSize = Number.parseInt(value, 10);

  return PAGE_SIZE_OPTIONS.includes(parsedPageSize) ? parsedPageSize : DEFAULT_PAGE_SIZE;
}

function getDefaultSort(type) {
  return type === "article" ? "newest_year" : "title_asc";
}

function getPageText(type) {
  if (type === "article") {
    return {
      title: "Article Catalog",
      subtitle: "Search article titles, authors, DOI records, keywords, and issue metadata.",
      placeholder: "Search by title, author, DOI, keyword, year, volume, or issue",
      singular: "article",
      plural: "articles"
    };
  }

  return {
    title: "Journal Catalog",
    subtitle: "Search journal titles, ISSNs, subject areas, and publishers.",
    placeholder: "Search by journal title, ISSN, subject, or publisher",
    singular: "journal",
    plural: "journals"
  };
}

function getUniqueOptions(records, key) {
  return [...new Set(records.map((record) => record[key]).filter(Boolean))].sort(
    (first, second) => String(first).localeCompare(String(second))
  );
}

function PaginationControls({ page, totalPages, onPageChange }) {
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav className="pagination-controls" aria-label="Catalog pagination">
      <button
        type="button"
        disabled={!hasPrevious}
        onClick={() => onPageChange(1)}
      >
        First
      </button>
      <button
        type="button"
        disabled={!hasPrevious}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        disabled={!hasNext}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
      <button
        type="button"
        disabled={!hasNext}
        onClick={() => onPageChange(totalPages)}
      >
        Last
      </button>
    </nav>
  );
}
