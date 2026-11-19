import { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ReaderAuthContext } from "../context/ReaderAuthContext.jsx";

export function AccountPage() {
  const { reader, signOut } = useContext(ReaderAuthContext);
  const navigate = useNavigate();

  if (reader === undefined) {
    return (
      <main className="page-main page-main--centered">
        <p className="status-text">Loading…</p>
      </main>
    );
  }

  if (!reader) {
    return (
      <main className="page-main page-main--centered">
        <div className="reader-auth-card">
          <p className="eyebrow">My Account</p>
          <h1>Not signed in</h1>
          <p>Sign in with your student email to access your account.</p>
          <Link to="/login" className="button-link reader-auth-submit">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  function formatDate(dateString) {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  return (
    <main className="page-main page-main--centered">
      <div className="reader-auth-card reader-account-card">
        <p className="eyebrow">My Account</p>
        <h1>Reader profile</h1>

        <dl className="reader-account-info">
          <div>
            <dt>Email</dt>
            <dd>{reader.email}</dd>
          </div>
          <div>
            <dt>Member since</dt>
            <dd>{formatDate(reader.createdAt)}</dd>
          </div>
          <div>
            <dt>Last active</dt>
            <dd>{formatDate(reader.lastSeenAt)}</dd>
          </div>
          {reader.expiresAt && (
            <div>
              <dt>Access expires</dt>
              <dd>{formatDate(reader.expiresAt)}</dd>
            </div>
          )}
        </dl>

        <button
          className="button-link button-link--secondary reader-auth-submit"
          type="button"
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
