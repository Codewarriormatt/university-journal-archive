import { createContext, useContext, useEffect, useState } from "react";
import { fetchReaderSession, logoutReader } from "../api/readerApi.js";

export const ReaderAuthContext = createContext(null);

export function ReaderAuthProvider({ children }) {
  const [reader, setReader] = useState(undefined); // undefined = loading, null = not authenticated
  const [canDownload, setCanDownload] = useState(() => {
    try { return !!localStorage.getItem("admin_viewing"); } catch { return null; }
  });
  const [loginNotice, setLoginNotice] = useState(null); // set after magic link login

  useEffect(() => {
    let alive = true;

    fetchReaderSession()
      .then((data) => {
        if (!alive) return;
        if (data.authenticated) {
          setReader(data.reader);
          setCanDownload(true);
        } else {
          setReader(null);
          // Use the admin preview hint already in localStorage — avoids a second
          // network call to /api/admin/auth/me which would rotate the CSRF token
          // and break subsequent admin write operations.
          try {
            setCanDownload(!!localStorage.getItem("admin_viewing"));
          } catch {
            setCanDownload(false);
          }
        }
      })
      .catch(() => {
        if (alive) {
          setReader(null);
          setCanDownload(false);
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  function setReaderAfterLogin(readerData) {
    setReader(readerData);
    setCanDownload(true);
    setLoginNotice(readerData);
  }

  function clearLoginNotice() {
    setLoginNotice(null);
  }

  async function signOut() {
    await logoutReader().catch(() => {});
    setReader(null);
    setCanDownload(false);
    setLoginNotice(null);
  }

  return (
    <ReaderAuthContext.Provider
      value={{ reader, canDownload, setReaderAfterLogin, signOut, loginNotice, clearLoginNotice }}
    >
      {children}
    </ReaderAuthContext.Provider>
  );
}

export function useReaderAuth() {
  return useContext(ReaderAuthContext);
}
