import { useContext, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBookOpen,
  faChevronDown,
  faCircleCheck,
  faCircleInfo,
  faEnvelope,
  faHouse,
  faMagnifyingGlass,
  faPenToSquare,
  faRightFromBracket,
  faShield,
  faUser,
  faUserShield,
  faXmark
} from "@fortawesome/free-solid-svg-icons";
import {
  faFacebook,
  faInstagram,
  faLinkedin,
  faTiktok
} from "@fortawesome/free-brands-svg-icons";
import { NavLink, Outlet, Link, Navigate, useLocation } from "react-router-dom";
import { ReaderAuthContext } from "../context/ReaderAuthContext.jsx";

const ADMIN_BAR_HEIGHT = 36;

function readAdminHint() {
  try {
    const raw = localStorage.getItem("admin_viewing");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getAdminSectionLink(pathname) {
  if (/^\/journals\//.test(pathname)) return { href: "/admin/journals", label: "Manage Journals" };
  if (/^\/issues\//.test(pathname)) return { href: "/admin/issues", label: "Manage Issues" };
  if (/^\/articles\//.test(pathname)) return { href: "/admin/articles", label: "Manage Articles" };
  return null;
}

function AdminPreviewBar({ admin }) {
  const location = useLocation();
  const isMember = admin.role === "Member";
  const editLink = isMember ? null : getAdminSectionLink(location.pathname);

  async function handleMemberSignOut() {
    await fetch("/api/admin/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    localStorage.removeItem("admin_viewing");
    window.location.replace("/admin");
  }

  return (
    <div className="admin-preview-bar" role="complementary" aria-label={isMember ? "Member access" : "Admin preview mode"}>
      <div className="admin-preview-bar__left">
        <FontAwesomeIcon icon={isMember ? faUser : faShield} className="admin-preview-bar__icon" aria-hidden="true" />
        <span className="admin-preview-bar__label">{isMember ? "Member" : "Admin Preview"}</span>
        <span className="admin-preview-bar__sep" aria-hidden="true">·</span>
        <span className="admin-preview-bar__name">{admin.displayName}</span>
        {!isMember && <span className="admin-preview-bar__role">{admin.role}</span>}
      </div>
      <div className="admin-preview-bar__right">
        {editLink && (
          <a className="admin-preview-bar__action" href={editLink.href}>
            <FontAwesomeIcon icon={faPenToSquare} aria-hidden="true" />
            {editLink.label}
          </a>
        )}
        {isMember ? (
          <button className="admin-preview-bar__btn" type="button" onClick={handleMemberSignOut}>
            Sign out
            <FontAwesomeIcon icon={faRightFromBracket} aria-hidden="true" />
          </button>
        ) : (
          <a className="admin-preview-bar__btn" href="/admin">
            Admin Panel
            <FontAwesomeIcon icon={faUserShield} aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}

function LoginToast({ reader, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function handleDismiss() {
    setVisible(false);
    setTimeout(onDismiss, 300);
  }

  return (
    <div className={`reader-toast ${visible ? "reader-toast--visible" : ""}`} role="status" aria-live="polite">
      <FontAwesomeIcon icon={faCircleCheck} className="reader-toast__icon" aria-hidden="true" />
      <div className="reader-toast__body">
        <strong>You are now signed in</strong>
        <span>Signed in as <em>{reader.email}</em> — you can now download restricted articles.</span>
      </div>
      <button
        className="reader-toast__close"
        type="button"
        aria-label="Dismiss"
        onClick={handleDismiss}
      >
        <FontAwesomeIcon icon={faXmark} />
      </button>
    </div>
  );
}

function ReaderAccountButton({ reader, signOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="reader-account-menu" ref={ref}>
      <button
        className="profile-button profile-button--email"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <FontAwesomeIcon icon={faUser} aria-hidden="true" />
        <span className="profile-button__email">{reader.email}</span>
        <FontAwesomeIcon icon={faChevronDown} className="profile-button__chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="reader-account-dropdown" role="menu">
          <div className="reader-account-dropdown__info">
            <span className="reader-account-dropdown__label">Signed in as</span>
            <span className="reader-account-dropdown__email">{reader.email}</span>
            <span className="reader-account-dropdown__cap">Full download access enabled</span>
          </div>
          <hr className="reader-account-dropdown__divider" />
          <Link
            className="reader-account-dropdown__item"
            to="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <FontAwesomeIcon icon={faUser} aria-hidden="true" />
            My Account
          </Link>
          <button
            className="reader-account-dropdown__item reader-account-dropdown__item--signout"
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); signOut(); }}
          >
            <FontAwesomeIcon icon={faRightFromBracket} aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Layout() {
  const { reader, signOut, loginNotice, clearLoginNotice } = useContext(ReaderAuthContext);
  const [adminHint] = useState(readAdminHint);

  if (adminHint?.mustChangePassword) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="app-shell" style={adminHint ? { paddingTop: ADMIN_BAR_HEIGHT } : undefined}>
      {adminHint && <AdminPreviewBar admin={adminHint} />}
      <header className="site-header" style={adminHint ? { top: ADMIN_BAR_HEIGHT } : undefined}>
        <NavLink className="brand" to="/" aria-label="University Journal Archive">
          <span className="brand-mark" aria-hidden="true">
            <FontAwesomeIcon icon={faBookOpen} />
          </span>
          <span className="brand-copy">
            <strong>University</strong>
            <span>Journal Archive</span>
          </span>
        </NavLink>
        <nav className="site-nav" aria-label="Main navigation">
          <NavLink to="/" end>
            <FontAwesomeIcon className="nav-icon" icon={faHouse} />
            Home
          </NavLink>
          <NavLink to="/records">
            <FontAwesomeIcon className="nav-icon" icon={faMagnifyingGlass} />
            Catalog
          </NavLink>
          <NavLink to="/about">
            <FontAwesomeIcon className="nav-icon" icon={faCircleInfo} />
            About
          </NavLink>
        </nav>
        <div className="site-actions" aria-label="Account actions">
          {reader ? (
            <ReaderAccountButton reader={reader} signOut={signOut} />
          ) : !adminHint ? (
            <>
              <Link className="profile-button" to="/login" title="Sign in">
                <FontAwesomeIcon icon={faUser} />
                Sign in
              </Link>
              <NavLink className="profile-button" to="/admin" title="Admin sign in">
                <FontAwesomeIcon icon={faUserShield} />
                Admin
              </NavLink>
            </>
          ) : null}
        </div>
      </header>

      {loginNotice && (
        <LoginToast reader={loginNotice} onDismiss={clearLoginNotice} />
      )}

      <Outlet />
      <footer className="site-footer">
        <div className="site-footer__body">
          <div className="site-footer__brand">
            <div className="site-footer__brand-name">
              <strong>University</strong>
              <span>Journal Archive</span>
            </div>
            <p className="site-footer__desc">
              An online repository of academic journals and articles.
            </p>
            <nav className="site-footer__social" aria-label="Social media links">
              <a href="https://www.facebook.com/" target="_blank" rel="noreferrer">
                <FontAwesomeIcon icon={faFacebook} />
                Facebook
              </a>
              <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">
                <FontAwesomeIcon icon={faInstagram} />
                Instagram
              </a>
              <a href="https://www.tiktok.com/" target="_blank" rel="noreferrer">
                <FontAwesomeIcon icon={faTiktok} />
                TikTok
              </a>
              <a href="https://www.linkedin.com/" target="_blank" rel="noreferrer">
                <FontAwesomeIcon icon={faLinkedin} />
                LinkedIn
              </a>
            </nav>
          </div>
          <div className="site-footer__contact">
            <h4 className="site-footer__contact-heading">Contact Us</h4>
            <ul className="site-footer__contact-list">
              <li>
                <FontAwesomeIcon icon={faEnvelope} />
                <a href="mailto:library@example.edu">library@example.edu</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="site-footer__bar">
          <div className="site-footer__bar-inner">
            <p>© 2026 University Journal Archive. Student project, not affiliated with or endorsed by National University.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
