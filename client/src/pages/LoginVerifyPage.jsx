import { useEffect, useState, useContext } from "react";
import { useSearchParams, useNavigate, Link, Navigate } from "react-router-dom";
import { verifyMagicLink } from "../api/readerApi.js";
import { ReaderAuthContext } from "../context/ReaderAuthContext.jsx";

function readAdminHint() {
  try {
    const raw = localStorage.getItem("admin_viewing");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function LoginVerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setReaderAfterLogin } = useContext(ReaderAuthContext);
  const adminHint = readAdminHint();

  if (adminHint) return <Navigate to="/admin" replace />;

  const token = searchParams.get("token") ?? "";
  const redirect = searchParams.get("redirect") ?? "/";

  const [status, setStatus] = useState("loading"); // loading | success | error
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("No sign-in token was provided.");
      return;
    }

    verifyMagicLink(token)
      .then((data) => {
        setReaderAfterLogin(data.reader);
        setStatus("success");
        setTimeout(() => {
          // Same-site paths only: "//host" or "/\host" would leave the site.
          const isLocalPath = redirect.startsWith("/") && !redirect.startsWith("//") && !redirect.startsWith("/\\");
          window.location.href = isLocalPath ? redirect : "/";
        }, 1200);
      })
      .catch((error) => {
        setStatus("error");
        setErrorMessage(
          error.message ?? "The sign-in link is invalid or has expired."
        );
      });
  }, [token]);

  return (
    <main className="page-main">
      <div className="reader-auth-card">
        {status === "loading" && (
          <>
            <p className="eyebrow">Sign in</p>
            <h1>Signing you in…</h1>
          </>
        )}
        {status === "success" && (
          <>
            <p className="eyebrow">Sign in</p>
            <h1>Signed in successfully</h1>
            <p>Redirecting you now…</p>
          </>
        )}
        {status === "error" && (
          <>
            <p className="eyebrow">Sign in failed</p>
            <h1>Link invalid or expired</h1>
            <p className="reader-auth-error">{errorMessage}</p>
            <Link to="/login" className="button-link reader-auth-submit">
              Request a new sign-in link
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
