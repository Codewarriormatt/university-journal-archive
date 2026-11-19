const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export function getArticlePdfDownloadUrl(id) {
  return `${API_BASE_URL}/api/downloads/articles/${id}/pdf`;
}

export async function fetchRecords({
  search = "",
  type = "all",
  field = "all",
  subject = "all",
  publisher = "all",
  journal = "all",
  year = "all",
  yearFrom = "",
  yearTo = "",
  sort = "",
  page = null,
  pageSize = null,
  limit = 50
} = {}) {
  const params = new URLSearchParams();

  if (search.trim()) {
    params.set("search", search.trim());
  }

  if (type !== "all") {
    params.set("type", type);
  }

  if (field !== "all") {
    params.set("field", field);
  }

  if (subject !== "all") {
    params.set("subject", subject);
  }

  if (publisher !== "all") {
    params.set("publisher", publisher);
  }

  if (journal !== "all") {
    params.set("journal", journal);
  }

  if (year !== "all") {
    params.set("year", year);
  }

  if (yearFrom) {
    params.set("yearFrom", yearFrom);
  }

  if (yearTo) {
    params.set("yearTo", yearTo);
  }

  if (sort) {
    params.set("sort", sort);
  }

  if (pageSize) {
    params.set("page", String(page ?? 1));
    params.set("pageSize", String(pageSize));
  } else {
    params.set("limit", String(limit));
  }

  return request(`/api/records?${params.toString()}`);
}

export async function fetchArticle(id) {
  return request(`/api/articles/${id}`);
}

export async function fetchHomepageHighlights() {
  return request("/api/homepage");
}

export async function fetchIssue(id) {
  return request(`/api/issues/${id}`);
}

export async function fetchJournal(id) {
  return request(`/api/journals/${id}`);
}

export function recordArticleCitation(id) {
  fetch(`${API_BASE_URL}/api/articles/${id}/cite`, { method: "POST" }).catch(() => {});
}

async function request(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message ?? "Request failed.");
  }

  return response.json();
}
