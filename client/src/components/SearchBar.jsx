import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const RECORD_TYPES = [
  { value: "journal", label: "Journals" },
  { value: "article", label: "Articles" }
];

const JOURNAL_SEARCH_FIELDS = [
  { value: "all", label: "All fields" },
  { value: "title", label: "Title" },
  { value: "issn", label: "ISSN" },
  { value: "subject", label: "Subject area" },
  { value: "publisher", label: "Publisher" }
];

const ARTICLE_SEARCH_FIELDS = [
  { value: "all", label: "All fields" },
  { value: "title", label: "Title" },
  { value: "author", label: "Author" },
  { value: "doi", label: "DOI" },
  { value: "subject", label: "Subject area" },
  { value: "keyword", label: "Keyword" },
  { value: "publication_year", label: "Publication year" },
  { value: "volume", label: "Volume" },
  { value: "issue_number", label: "Issue number" }
];

export function SearchBar({
  initialValue = "",
  initialType = "journal",
  initialField = "all",
  compact = false
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialValue);
  const [type, setType] = useState(normalizeRecordType(initialType));
  const [field, setField] = useState(initialField);
  const searchFields = getSearchFields(type);
  const placeholder = getSearchPlaceholder(type);

  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  useEffect(() => {
    setType(normalizeRecordType(initialType));
  }, [initialType]);

  useEffect(() => {
    setField(isFieldAllowed(type, initialField) ? initialField : "all");
  }, [initialField, type]);

  function handleTypeChange(nextType) {
    setType(nextType);
    setField((currentField) =>
      isFieldAllowed(nextType, currentField) ? currentField : "all"
    );
  }

  function handleSubmit(event) {
    event.preventDefault();

    const params = new URLSearchParams();

    if (query.trim()) {
      params.set("search", query.trim());
    }

    if (type !== "all") {
      params.set("type", type);
    }

    if (field !== "all") {
      params.set("field", field);
    }

    navigate({
      pathname: "/records",
      search: params.toString()
    });
  }

  return (
    <form
      className={compact ? "search-form search-form--compact" : "search-form"}
      onSubmit={handleSubmit}
    >
      <fieldset className="search-form__types">
        <legend>Record type</legend>
        {RECORD_TYPES.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name="recordType"
              value={option.value}
              checked={type === option.value}
              onChange={(event) => handleTypeChange(event.target.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      <div className="search-form__row">
        <label className="search-form__query">
          <span>Search term</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
          />
        </label>
        <label className="search-form__field">
          <span>Search in</span>
          <select value={field} onChange={(event) => setField(event.target.value)}>
            {searchFields.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Search</button>
      </div>
    </form>
  );
}

function normalizeRecordType(value) {
  return value === "article" ? "article" : "journal";
}

function getSearchFields(recordType) {
  return recordType === "article" ? ARTICLE_SEARCH_FIELDS : JOURNAL_SEARCH_FIELDS;
}

function getSearchPlaceholder(recordType) {
  if (recordType === "article") {
    return "Search by article title, author, DOI, keyword, year, volume, or issue";
  }

  return "Search by journal title, ISSN, subject, or publisher";
}

function isFieldAllowed(recordType, field) {
  return getSearchFields(recordType).some((option) => option.value === field);
}
