import { Route, Routes } from "react-router-dom";
import { ReaderAuthProvider } from "./context/ReaderAuthContext.jsx";
import { AboutPage } from "./pages/AboutPage.jsx";
import { AccountPage } from "./pages/AccountPage.jsx";
import { AdminPage } from "./pages/AdminPage.jsx";
import { ArticleDetailPage } from "./pages/ArticleDetailPage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { IssueDetailPage } from "./pages/IssueDetailPage.jsx";
import { JournalDetailPage } from "./pages/JournalDetailPage.jsx";
import { Layout } from "./components/Layout.jsx";
import { ListingPage } from "./pages/ListingPage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { LoginVerifyPage } from "./pages/LoginVerifyPage.jsx";

export function App() {
  return (
    <ReaderAuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/records" element={<ListingPage />} />
          <Route path="/articles/:id" element={<ArticleDetailPage />} />
          <Route path="/issues/:id" element={<IssueDetailPage />} />
          <Route path="/journals/:id" element={<JournalDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/verify" element={<LoginVerifyPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>
        <Route path="/admin/:section?" element={<AdminPage />} />
      </Routes>
    </ReaderAuthProvider>
  );
}
