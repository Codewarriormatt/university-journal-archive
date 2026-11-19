import { useContext, useState } from "react";
import { useSearchParams, Link, Navigate } from "react-router-dom";
import { requestMagicLink } from "../api/readerApi.js";
import { ReaderAuthContext } from "../context/ReaderAuthContext.jsx";

function readAdminHint() {
  try {
    const raw = localStorage.getItem("admin_viewing");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";
  const { reader } = useContext(ReaderAuthContext);
  const adminHint = readAdminHint();

  if (adminHint) return <Navigate to="/admin" replace />;
  if (reader) return <Navigate to={redirect} replace />;

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | sent | error
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      await requestMagicLink(email.trim(), redirect);
      setStatus("sent");
    } catch (error) {
      setStatus("error");
      setErrorMessage(formatErrorMessage(error));
    }
  }

  function formatErrorMessage(error) {
    if (error.status === 429 && error.retryAfter) {
      const seconds = parseInt(error.retryAfter, 10);
      if (!isNaN(seconds)) {
        const retryAt = new Date(Date.now() + seconds * 1000);
        const timeStr = retryAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        if (seconds < 120) return `Too many attempts. Please wait ${seconds} seconds and try again.`;
        const minutes = Math.ceil(seconds / 60);
        if (minutes < 60) return `Too many attempts. Try again in ${minutes} minutes (at ${timeStr}).`;
        return `Too many attempts. Try again at ${timeStr}.`;
      }
    }
    return error.message ?? "Could not send sign-in link. Try again.";
  }

  if (status === "sent") {
    return (
      <main className="page-main page-main--centered">
        <div className="reader-auth-card">
          <p className="eyebrow">Sign in</p>
          <h1>Check your email</h1>
          <p>
            We sent a sign-in link to <strong>{email}</strong>. Click the link in
            the email to continue. The link expires in 15 minutes.
          </p>
          <p>
            Wrong email?{" "}
            <button
              className="inline-text-button"
              type="button"
              onClick={() => {
                setStatus("idle");
                setEmail("");
              }}
            >
              Try again
            </button>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-main page-main--centered">
      <div className="reader-auth-card">
        <p className="eyebrow">Sign in</p>
        <h1>Access the archive</h1>
        <p>
          Enter your <strong>@students.example.edu</strong> email address.
          We will send you a one-time sign-in link.
        </p>

        <form className="reader-auth-form" onSubmit={handleSubmit}>
          <div className="reader-auth-field">
            <label htmlFor="reader-email">Email address</label>
            <input
              id="reader-email"
              type="email"
              autoComplete="email"
              placeholder="you@students.example.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={status === "loading"}
            />
          </div>

          {status === "error" && (
            <p className="reader-auth-error" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            className="button-link reader-auth-submit"
            type="submit"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Sending…" : "Send sign-in link"}
          </button>
        </form>

        <p className="reader-auth-help">
          Not a student?{" "}
          <Link to="/admin" className="text-link">
            Admin sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
