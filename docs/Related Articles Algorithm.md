# Related Articles Algorithm

This document explains how the "Related Articles" section on each article detail page works — how candidates are found, how they are scored, and how the final list is ranked.

---

## Overview

When a reader views an article, the system automatically finds up to **6 other articles** that are most likely to be relevant to them. It does this by scoring every possible candidate article and showing the top scorers.

---

## Step 1 — Finding Candidates

The system does **not** score every single article in the database. Instead, it pre-filters to only pull articles that share at least one of these connections with the source article:

| Connection | Description |
|---|---|
| Same journal | The candidate was published in the same journal |
| Same subject area | The candidate belongs to the same subject area (e.g., "Engineering") |
| Shared keyword | At least one keyword from the source article also appears on the candidate |
| Shared author | At least one author name from the source article also appears on the candidate |

This pre-filtering step is done in a single SQL query using `EXISTS` subqueries. Only articles that pass **at least one** of these four checks become candidates.

> **Why this matters:** The old version fetched the first 100 articles by insertion order, which meant recently added articles were never included as candidates. The new SQL filter ensures the full database is considered, no matter how large it grows.

---

## Step 2 — Scoring Each Candidate

Each candidate receives a **relevance score** based on how strongly it overlaps with the source article:

| Signal | Points |
|---|---|
| Each shared keyword | +4 per keyword |
| Each shared author | +3 per author |
| Same subject area | +2 |
| Same journal | +1 |

### Example

Source article: *"Deep Learning for Medical Image Analysis"*
- Keywords: `deep learning`, `neural networks`, `medical imaging`
- Authors: `Santos, Maria`
- Subject area: `Health Sciences`
- Journal: *Philippine Health Sciences Journal*

Candidate: *"Convolutional Neural Networks in Clinical Diagnostics"*
- Shared keywords: `deep learning`, `neural networks` → **+8**
- Shared author: `Santos, Maria` → **+3**
- Same subject area → **+2**
- Different journal → +0
- **Total score: 13**

---

## Step 3 — Filtering and Ranking

1. Any candidate with a score of **0 is excluded** — if nothing overlaps, the article is not shown.
2. Remaining candidates are **sorted** by:
   1. Score (highest first)
   2. Publication year (most recent first, as tiebreaker)
   3. Title alphabetically (final tiebreaker)
3. The top **6** results are returned.

---

## Step 4 — Displaying Reasons

Each related article card shows **why** it was matched. The reasons are derived from the same signals used for scoring:

- `Shared keywords: deep learning, neural networks` — lists the actual keyword names
- `Shared authors: Santos, Maria` — lists the matching author names
- `Same subject area` — shown if subject areas match
- `Same journal` — shown if both articles are in the same journal

---

## Scoring Weights — Design Rationale

| Signal | Weight | Why |
|---|---|---|
| Keyword match | 4 | Keywords are the strongest content signal — editors explicitly tag articles |
| Author match | 3 | A reader interested in one paper by an author often wants more from the same author |
| Subject area | 2 | Broad topical similarity — useful when few keywords overlap |
| Same journal | 1 | Weak signal on its own, but adds a small boost for same-journal depth |

Keywords are weighted highest because they represent deliberate editorial choices. Author matching rewards researchers looking for more work by the same people. Subject area and journal act as fallback signals when content overlap is minimal.

---

## Implementation Location

The algorithm lives in:

```
server/src/repositories/repositoryRepository.js
```

Function: `getRelatedArticles(database, article, sourceKeywords, sourceAuthors)`

It is called inside `getArticle()`, which assembles the full article detail response sent to the client.

---

## Limitations and Future Improvements

- **Author names are matched by display name (string match)** — two different people with the same display name would falsely match. A proper fix would require matching by author ID, but this is rare in practice for academic journals.
- **No abstract/full-text similarity** — the algorithm is entirely keyword- and metadata-driven. Full-text semantic similarity (e.g., via embeddings) would be much more powerful but requires external infrastructure.
- **Keyword quality depends on tagging** — articles with no keywords assigned will only match on subject area and journal, producing weaker related results.
