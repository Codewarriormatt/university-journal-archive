# Why Articles Do Not Have an Image Field

## Decision

The `articles` table intentionally has no image column. This was a deliberate design choice, not an oversight.

---

## Background

Journals and issues in this system have cover images (`default_cover_image`, `issue_cover_image`) because cover art is a standard, well-established part of academic journal publishing. It is produced by the publisher, attached to the publication as a whole, and has a clear visual identity purpose.

Articles are different. An article is a piece of scholarly work — its value is entirely in its text, data, and findings. Visual elements attached to an article in academic publishing have a specific, defined meaning.

---

## The Only Legitimate Article Image: The Graphical Abstract

The only image that professionally belongs on an academic article page is a **graphical abstract** — a single illustration that visually summarizes the study's methodology, workflow, or key finding. It is used by publishers such as Elsevier, American Chemical Society (ACS), and Royal Society of Chemistry (RSC).

A graphical abstract is:
- Produced by the **author**, not the journal administrator
- A scholarly artifact, not a decorative element
- Typically submitted alongside the manuscript during the editorial process

This system's article records are entered manually by an administrator who is cataloguing existing published works. In that workflow, the graphical abstract is rarely available — it is not something an admin would have on hand when entering bibliographic metadata.

---

## Why It Was Skipped

1. **No real content to fill it.** Adding a field that will be empty for every article in the database provides no user value and creates a misleading UI element.

2. **Wrong workflow.** This is a repository, not a publishing platform. The admin enters metadata (title, authors, abstract, keywords, DOI). Graphical abstracts belong to the manuscript submission workflow, which is out of scope here.

3. **Risk of misuse.** A generic `image` field with no defined purpose tends to get filled with decorative thumbnails that have no academic meaning, which lowers the credibility of the repository.

4. **Not a discovery tool.** The repository's core purpose is helping readers find and access articles through search and filtering. An image does not contribute to that goal.

---

## When to Add It

If the system ever needs to display graphical abstracts, the right approach is:

- Add a `graphical_abstract` column (not a generic `image` column) to make the intent explicit
- Add it as an optional upload in the article edit form in the admin panel
- Display it on the article detail page only when present, with appropriate alt text

The field name `graphical_abstract` matters — it signals to anyone working on the codebase that this is a scholarly artifact with a specific academic purpose, not a generic decorative image.
