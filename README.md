# University Journal Archive

A web app for publishing and searching a university's academic journals online.
Readers browse journals, volumes, issues and articles, search with filters, and open or cite articles.
Admins manage all records, uploads, reader access and other admin accounts from one dashboard.

> Student project, not affiliated with or endorsed by National University.
> All sample journals, articles, authors, ORCIDs and DOIs are fictional.

## Features

- **Catalog:** journal → volume → issue → article, with cover images and PDF files.
- **Search:** search journals or articles by field (title, author, DOI, subject area, keyword, year, volume, issue) with sorting. Optional semantic search with OpenAI embeddings.
- **Related articles** on each article page (scoring explained in [docs/Related Articles Algorithm.md](docs/Related%20Articles%20Algorithm.md)).
- **Metrics:** article views, downloads and citation copies.
- **Reader sign-in** by magic link (no password). Only email domains the admin trusts can sign in. Articles are Open Access or Restricted.
- **Admin dashboard** with 3 roles (Super Admin, Content Admin, Member), an audit log, image/PDF uploads and reader account management.
- **AI journal insight** (optional): a short overview of each journal written by Claude in a background worker ([docs/How Journal AI Insight Works.md](docs/How%20Journal%20AI%20Insight%20Works.md)).
- **Security:** bcrypt passwords, hashed session tokens, HttpOnly + SameSite cookies, CSRF tokens on admin routes, Helmet CSP, CORS allow-list, rate limits ([docs/RATE_LIMITING_GUIDE.txt](docs/RATE_LIMITING_GUIDE.txt)), upload checks (type, extension, file signature, size).

## Tech stack

| Part | Tools |
|---|---|
| Frontend | React 19, React Router 7, Vite 8, Font Awesome |
| Backend | Node.js 24, Express 5, pg, bcrypt, helmet, express-rate-limit, multer |
| Database | PostgreSQL 13+ (SQL migrations run on start) |
| Optional services | Brevo (email), Anthropic Claude (AI insight), OpenAI (embeddings for semantic search) |
| Deploy config | Railway / Nixpacks (`railway.json`, `nixpacks.toml`) |

## Run it on a fresh machine

### 1. Install

- [Node.js](https://nodejs.org/) **24 or newer**
- [PostgreSQL](https://www.postgresql.org/download/) **13 or newer**

### 2. Get the code and install packages

```bash
git clone https://github.com/Codewarriormatt/university-journal-archive.git
cd university-journal-archive
npm install
```

`npm install` in the root folder installs both `client/` and `server/` (npm workspaces).

### 3. Create the database

```bash
createdb journal_archive
```

Or in `psql`: `CREATE DATABASE journal_archive;`
The first migration runs `CREATE EXTENSION citext`, so use a database user that owns the database (the default `postgres` user is fine).

### 4. Create `server/.env`

Copy the example file:

```bash
# macOS / Linux / Git Bash
cp server/.env.example server/.env
```

```powershell
# Windows PowerShell
Copy-Item server\.env.example server\.env
```

Then open `server/.env` and set at least these two values:

```env
DATABASE_URL=postgresql://postgres:your-db-password@localhost:5432/journal_archive
ADMIN_PASSWORD=choose-a-strong-password
```

`ADMIN_PASSWORD` is **required**. There is no default password.

Optional keys (the app runs without them):

| Key | Without it |
|---|---|
| `BREVO_API_KEY` | In development, the reader sign-in link is printed in the server terminal instead of emailed. In production, reader sign-in returns "Email delivery is not set up". |
| `ANTHROPIC_API_KEY` | The AI journal insight worker is off. |
| `OPENAI_API_KEY` | Search uses keywords only (no semantic search). |

### 5. Start the app

```bash
npm run dev
```

On Windows you can also double-click `start-dev.bat`.

- Website: http://localhost:5173
- API: http://localhost:4000 (health check: http://localhost:4000/api/health)

On the first start the server runs all migrations, loads the fictional sample data and creates the first admin from `ADMIN_USERNAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

### 6. Sign in

- **Admin:** open http://localhost:5173/admin and sign in with `ADMIN_USERNAME` (default `admin`) and your `ADMIN_PASSWORD`. You must change the password at first login.
- **Reader (dev mode, no Brevo key):** open http://localhost:5173/login and enter an email at a trusted domain, for example `reader@students.example.edu`. The page says "check your email", but the link appears in the **server terminal**. Copy it into the browser to sign in.

## Demo flow

1. **Home** → open a journal → pick a volume and issue → open an article.
2. On the article page: read the abstract, see the related articles, copy a citation, and watch the view/download/citation counts.
3. **Catalog** (`/records`): search a keyword, pick a search field (for example Author or Subject area) and change the sort.
4. Open a **Restricted** article → sign in as a reader (step 6) → the PDF becomes available.
5. **Admin** (`/admin`): edit a journal, issue or article, upload a cover image or PDF, add a trusted email domain, manage reader accounts and admin users, and read the audit log.
6. With `ANTHROPIC_API_KEY` set: see the AI insight on the journal pages and regenerate it from the admin dashboard.

## Other commands

| Command | What it does |
|---|---|
| `npm run seed` | **Deletes all data** and reloads the sample data and admin (uses `ADMIN_*` from `server/.env`). |
| `npm test --workspace server` | Runs the server unit tests. |
| `npm run build` | Builds the React client into `client/dist`. |
| `npm start` | Starts the server only (loads `server/.env` if it exists). With `NODE_ENV=production` it also serves `client/dist`. |
| `node --env-file=server/.env server/scripts/backfill-embeddings.js` | Creates search embeddings for existing articles (needs `OPENAI_API_KEY`). |

**Production mode:** set `NODE_ENV=production` in `server/.env`, run `npm run build`, then `npm start`. Cookies are then `Secure`, so sign-in works only over HTTPS. Set `TRUST_PROXY=true` only behind a trusted reverse proxy (Railway, Nginx).

## Project structure

```text
client/                React app (Vite)
  src/api/             API request helpers
  src/components/      Layout and shared UI
  src/context/         Reader sign-in context
  src/pages/           Pages (home, catalog, journal, issue, article, login, account, admin)
server/
  src/auth/            Passwords and sessions
  src/config/          Environment config
  src/controllers/     Route handlers
  src/db/              PostgreSQL pool, migrations, sample data
  src/middleware/      Rate limiters
  src/repositories/    SQL queries
  src/routes/          Express routes
  src/services/        AI insight and embeddings
  src/utils/           Email, logger, validators
  scripts/             One-off scripts
docs/                  Design notes
```

## Screenshots

Coming soon. Screenshots will be added to [`docs/screenshots/`](docs/screenshots/).

## Post-submission fixes

This was a class project. After submission I made these small fixes before publishing it:

- Trust the reverse proxy only when `TRUST_PROXY=true` (before, it was always on, so the `X-Forwarded-For` header could be faked to get around the IP rate limits).
- Removed the default admin password. `ADMIN_PASSWORD` must now be set in `server/.env`.
- Stopped writing reader email addresses to the server log.
- Development mode prints the reader sign-in link in the server terminal when no Brevo key is set (before, sign-in just failed).
- `npm start` now loads `server/.env`.
- Removed the old `quality:admin` script (it still used the first SQLite version of the database).
- `start-dev.bat` shows the correct API port (4000).
- Removed the unused `nodemailer` package.
- Generic branding, a placeholder contact email, and no placeholder phone number.
- New `server/.env.example` for PostgreSQL, and this README.
- The reader sign-in redirect now accepts same-site paths only (a `//other-site` link is sent to `/`).
- Updated dependencies to fix known security advisories (`npm audit`: 0 vulnerabilities).

## Known limitations (class project)

- Uploaded PDFs under `/uploads/pdfs` are served as static files. The random file names hide them, but a direct link works even for Restricted articles.
- Each semantic search makes one OpenAI API call (limited by the public read rate limit).
- Rate limits are kept in memory, so they reset on restart and do not work across several server instances.
- Production mode uses `Secure` cookies, so sign-in does not work on plain `http://localhost` in production mode.
- On the very first start, two cleanup migrations run before the sample data is loaded, so some sample records still show placeholder `example.edu` links.
- Only server unit tests are automated. There are no end-to-end tests.
- A reader sign-in link is checked and then marked as used in two steps, so two requests at the same moment could both use it.
- When an article's PDF is replaced or deleted, the old file is removed without checking whether another article points to the same file.

## About this project

A solo university class project (App Development) by **Codewarriormatt**.
I designed and built it with AI-assisted coding (Claude Code). Parts of the code and documentation were written with AI help.

Student project, not affiliated with or endorsed by National University.

## License

[MIT](LICENSE) © 2026 Codewarriormatt
