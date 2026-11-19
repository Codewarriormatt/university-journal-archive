const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
let csrfToken = "";

export async function fetchAdminSession() {
  const data = await request("/api/admin/auth/me");
  storeCsrfToken(data);
  return data;
}

export async function loginAdmin(credentials) {
  const data = await request("/api/admin/auth/login", {
    method: "POST",
    body: credentials
  });
  storeCsrfToken(data);
  return data;
}

export async function logoutAdmin() {
  const data = await request("/api/admin/auth/logout", {
    method: "POST"
  });
  csrfToken = "";
  return data;
}

export async function changeAdminPassword(payload) {
  const data = await request("/api/admin/auth/change-password", {
    method: "POST",
    body: payload
  });
  storeCsrfToken(data);
  return data;
}

export async function fetchAdminDashboard() {
  return request("/api/admin/dashboard");
}

export async function fetchAdminOptions() {
  const data = await request("/api/admin/options");
  return data.data ?? data;
}

export async function fetchAdminList(resource, params = {}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }

  return request(`/api/admin/${resource}?${query.toString()}`);
}

export async function fetchAdminItem(resource, id) {
  return request(`/api/admin/${resource}/${id}`);
}

export async function createAdminItem(resource, payload) {
  return request(`/api/admin/${resource}`, {
    method: "POST",
    body: payload
  });
}

export async function updateAdminItem(resource, id, payload) {
  return request(`/api/admin/${resource}/${id}`, {
    method: "PUT",
    body: payload
  });
}

export async function deleteAdminItem(resource, id) {
  return request(`/api/admin/${resource}/${id}`, {
    method: "DELETE"
  });
}

export async function fetchAuditLogs(params = {}) {
  return fetchAdminList("audit-logs", params);
}

export async function regenerateJournalInsight(journalId) {
  return request(`/api/admin/journals/${journalId}/regenerate-insight`, { method: "POST" });
}

export async function bulkExpireReaderAccounts(expiresAt) {
  return request("/api/admin/reader-accounts/bulk-expiry", {
    method: "POST",
    body: { expiresAt }
  });
}

export async function uploadAdminFile(type, file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/admin/upload/${type}`, {
    method: "POST",
    credentials: "include",
    headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {},
    body: formData
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "Upload failed.");
  return data;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(shouldSendCsrf(options.method ?? "GET", path) && csrfToken
        ? { "X-CSRF-Token": csrfToken }
        : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message ?? "Request failed.");
    error.status = response.status;
    error.code = data.code;
    error.fieldErrors = data.fieldErrors ?? {};
    error.dependencies = data.dependencies ?? {};
    error.linkedRecords = data.linkedRecords ?? {};
    error.guidance = data.guidance ?? [];
    error.retryAfter = data.retryAfter ?? null;
    error.attemptsLeft = data.attemptsLeft ?? null;
    throw error;
  }

  return data;
}

function storeCsrfToken(data) {
  if (data?.csrfToken) {
    csrfToken = data.csrfToken;
  }
}

function shouldSendCsrf(method, path) {
  return (
    ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase()) &&
    !path.endsWith("/auth/login")
  );
}
