const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export async function fetchReaderSession() {
  return request("/api/auth/reader/me");
}

export async function requestMagicLink(email, redirect = "/") {
  return request("/api/auth/reader/request", {
    method: "POST",
    body: { email, redirect }
  });
}

export async function verifyMagicLink(token) {
  return request(`/api/auth/reader/verify/${encodeURIComponent(token)}`);
}

export async function logoutReader() {
  return request("/api/auth/reader/logout", { method: "POST" });
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message ?? "Request failed.");
    error.status = response.status;
    error.code = data.code;
    error.fieldErrors = data.fieldErrors ?? {};
    error.retryAfter = response.headers.get("Retry-After");
    throw error;
  }

  return data;
}
