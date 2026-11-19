-- Fix subject areas on existing journals and add one journal per missing subject area.
-- Each new journal gets one volume, one issue, and two articles.

-- ── 1. Fix existing journals ──────────────────────────────────────────────────

UPDATE journals SET subject_area = 'Computing & Information Technology'
  WHERE print_issn = '3021-1148';

UPDATE journals SET subject_area = 'Interdisciplinary'
  WHERE print_issn = '3021-2047';

UPDATE journals SET subject_area = 'Psychology & Social Sciences'
  WHERE print_issn = '3021-3372';

UPDATE journals SET subject_area = 'Engineering'
  WHERE print_issn = '3021-4496';

-- ── 2. New journals ───────────────────────────────────────────────────────────

INSERT INTO journals (title, abbreviation, print_issn, online_issn, publisher_name, place_of_publication, subject_area, description)
VALUES (
  'Journal of Business Administration and Accountancy',
  'J. Bus. Admin. Account.',
  '3021-5100', '3021-5101',
  'Sample University Research and Publications',
  'Sample City, Philippines',
  'Business & Accountancy',
  'Research on financial management, accounting systems, marketing strategy, and business administration in local and regional contexts.'
) ON CONFLICT DO NOTHING;

INSERT INTO journals (title, abbreviation, print_issn, online_issn, publisher_name, place_of_publication, subject_area, description)
VALUES (
  'Journal of Multimedia Arts and Digital Innovation',
  'J. Multimed. Arts Digit. Innov.',
  '3021-5200', '3021-5201',
  'Sample University Research and Publications',
  'Sample City, Philippines',
  'Multimedia & Design',
  'Studies on digital media production, visual communication, interactive design, and multimedia applications in education and industry.'
) ON CONFLICT DO NOTHING;

INSERT INTO journals (title, abbreviation, print_issn, online_issn, publisher_name, place_of_publication, subject_area, description)
VALUES (
  'Journal of Communication and Media Studies',
  'J. Commun. Media Stud.',
  '3021-5300', '3021-5301',
  'Sample University Research and Publications',
  'Sample City, Philippines',
  'Communication & Media',
  'Research on journalism, broadcast media, social media, public relations, and communication practices in Philippine contexts.'
) ON CONFLICT DO NOTHING;

INSERT INTO journals (title, abbreviation, print_issn, online_issn, publisher_name, place_of_publication, subject_area, description)
VALUES (
  'Journal of Architecture and Built Environment Studies',
  'J. Archit. Built Environ.',
  '3021-5400', '3021-5401',
  'Sample University Research and Publications',
  'Sample City, Philippines',
  'Architecture & Built Environment',
  'Applied research on architectural design, sustainable construction, urban planning, and the built environment in tropical and Philippine settings.'
) ON CONFLICT DO NOTHING;

-- ── 3. Volumes for new journals ───────────────────────────────────────────────

INSERT INTO journal_volumes (journal_id, volume_number, publication_year)
SELECT id, '1', 2026 FROM journals WHERE print_issn = '3021-5100'
ON CONFLICT DO NOTHING;

INSERT INTO journal_volumes (journal_id, volume_number, publication_year)
SELECT id, '1', 2026 FROM journals WHERE print_issn = '3021-5200'
ON CONFLICT DO NOTHING;

INSERT INTO journal_volumes (journal_id, volume_number, publication_year)
SELECT id, '1', 2026 FROM journals WHERE print_issn = '3021-5300'
ON CONFLICT DO NOTHING;

INSERT INTO journal_volumes (journal_id, volume_number, publication_year)
SELECT id, '1', 2026 FROM journals WHERE print_issn = '3021-5400'
ON CONFLICT DO NOTHING;

-- ── 4. Issues ─────────────────────────────────────────────────────────────────

INSERT INTO journal_issues (journal_id, volume_id, issue_number, issue_title, publication_month, date_published)
SELECT j.id, jv.id, '1', 'Financial Systems and Business Practices', 3, '2026-03-01'
FROM journals j JOIN journal_volumes jv ON jv.journal_id = j.id
WHERE j.print_issn = '3021-5100' AND jv.volume_number = '1'
ON CONFLICT DO NOTHING;

INSERT INTO journal_issues (journal_id, volume_id, issue_number, issue_title, publication_month, date_published)
SELECT j.id, jv.id, '1', 'Digital Media and Creative Technologies', 3, '2026-03-01'
FROM journals j JOIN journal_volumes jv ON jv.journal_id = j.id
WHERE j.print_issn = '3021-5200' AND jv.volume_number = '1'
ON CONFLICT DO NOTHING;

INSERT INTO journal_issues (journal_id, volume_id, issue_number, issue_title, publication_month, date_published)
SELECT j.id, jv.id, '1', 'Media Literacy and Digital Communication', 3, '2026-03-01'
FROM journals j JOIN journal_volumes jv ON jv.journal_id = j.id
WHERE j.print_issn = '3021-5300' AND jv.volume_number = '1'
ON CONFLICT DO NOTHING;

INSERT INTO journal_issues (journal_id, volume_id, issue_number, issue_title, publication_month, date_published)
SELECT j.id, jv.id, '1', 'Sustainable Design and Urban Development', 3, '2026-03-01'
FROM journals j JOIN journal_volumes jv ON jv.journal_id = j.id
WHERE j.print_issn = '3021-5400' AND jv.volume_number = '1'
ON CONFLICT DO NOTHING;

-- ── 5. Articles ───────────────────────────────────────────────────────────────

-- Business & Accountancy — Article 1
INSERT INTO articles (journal_id, issue_id, title, doi, abstract, page_start, page_end, access_status, date_published)
SELECT j.id, ji.id,
  'Financial Reporting Practices Among Small Enterprises in the Philippines',
  '10.5555/jbaa.2026.001',
  'This study examines the financial reporting practices of small enterprises in the CALABARZON region and identifies common gaps in compliance with Philippine Accounting Standards.',
  '1', '18', 'Open Access', '2026-03-01'
FROM journals j
JOIN journal_volumes jv ON jv.journal_id = j.id AND jv.volume_number = '1'
JOIN journal_issues ji ON ji.volume_id = jv.id AND ji.issue_number = '1'
WHERE j.print_issn = '3021-5100'
ON CONFLICT DO NOTHING;

-- Business & Accountancy — Article 2
INSERT INTO articles (journal_id, issue_id, title, doi, abstract, page_start, page_end, access_status, date_published)
SELECT j.id, ji.id,
  'Digital Marketing Adoption Among Local Business Owners in Laguna',
  '10.5555/jbaa.2026.002',
  'A survey-based study on the adoption of digital marketing tools by small business owners in Laguna province, examining awareness levels, usage patterns, and perceived effectiveness.',
  '19', '34', 'Restricted', '2026-03-01'
FROM journals j
JOIN journal_volumes jv ON jv.journal_id = j.id AND jv.volume_number = '1'
JOIN journal_issues ji ON ji.volume_id = jv.id AND ji.issue_number = '1'
WHERE j.print_issn = '3021-5100'
ON CONFLICT DO NOTHING;

-- Multimedia & Design — Article 1
INSERT INTO articles (journal_id, issue_id, title, doi, abstract, page_start, page_end, access_status, date_published)
SELECT j.id, ji.id,
  'User Interface Design Principles for Academic Repository Systems',
  '10.5555/jmadi.2026.001',
  'This paper reviews user interface design decisions for academic repository systems and proposes a set of principles based on usability testing with undergraduate students.',
  '1', '15', 'Open Access', '2026-03-01'
FROM journals j
JOIN journal_volumes jv ON jv.journal_id = j.id AND jv.volume_number = '1'
JOIN journal_issues ji ON ji.volume_id = jv.id AND ji.issue_number = '1'
WHERE j.print_issn = '3021-5200'
ON CONFLICT DO NOTHING;

-- Multimedia & Design — Article 2
INSERT INTO articles (journal_id, issue_id, title, doi, abstract, page_start, page_end, access_status, date_published)
SELECT j.id, ji.id,
  'Digital Storytelling as a Tool for Student Engagement in Higher Education',
  '10.5555/jmadi.2026.002',
  'An exploratory study on the use of digital storytelling projects as a learning strategy in undergraduate multimedia courses, with findings on student engagement and creative output.',
  '16', '29', 'Restricted', '2026-03-01'
FROM journals j
JOIN journal_volumes jv ON jv.journal_id = j.id AND jv.volume_number = '1'
JOIN journal_issues ji ON ji.volume_id = jv.id AND ji.issue_number = '1'
WHERE j.print_issn = '3021-5200'
ON CONFLICT DO NOTHING;

-- Communication & Media — Article 1
INSERT INTO articles (journal_id, issue_id, title, doi, abstract, page_start, page_end, access_status, date_published)
SELECT j.id, ji.id,
  'Social Media News Consumption Among Filipino University Students',
  '10.5555/jcms.2026.001',
  'This study investigates social media news consumption habits among Filipino university students and examines how platform choice, frequency, and trust affect information quality perceptions.',
  '1', '17', 'Open Access', '2026-03-01'
FROM journals j
JOIN journal_volumes jv ON jv.journal_id = j.id AND jv.volume_number = '1'
JOIN journal_issues ji ON ji.volume_id = jv.id AND ji.issue_number = '1'
WHERE j.print_issn = '3021-5300'
ON CONFLICT DO NOTHING;

-- Communication & Media — Article 2
INSERT INTO articles (journal_id, issue_id, title, doi, abstract, page_start, page_end, access_status, date_published)
SELECT j.id, ji.id,
  'Framing of Environmental Issues in Philippine Broadsheet Coverage',
  '10.5555/jcms.2026.002',
  'A framing analysis of environmental news in three major Philippine broadsheets over a two-year period, identifying dominant frames, source reliance, and thematic patterns.',
  '18', '33', 'Restricted', '2026-03-01'
FROM journals j
JOIN journal_volumes jv ON jv.journal_id = j.id AND jv.volume_number = '1'
JOIN journal_issues ji ON ji.volume_id = jv.id AND ji.issue_number = '1'
WHERE j.print_issn = '3021-5300'
ON CONFLICT DO NOTHING;

-- Architecture & Built Environment — Article 1
INSERT INTO articles (journal_id, issue_id, title, doi, abstract, page_start, page_end, access_status, date_published)
SELECT j.id, ji.id,
  'Passive Cooling Strategies in Tropical Residential Architecture',
  '10.5555/jabes.2026.001',
  'This paper evaluates passive cooling strategies applied in residential buildings across CALABARZON and assesses their effectiveness in reducing indoor temperatures in a tropical climate.',
  '1', '19', 'Open Access', '2026-03-01'
FROM journals j
JOIN journal_volumes jv ON jv.journal_id = j.id AND jv.volume_number = '1'
JOIN journal_issues ji ON ji.volume_id = jv.id AND ji.issue_number = '1'
WHERE j.print_issn = '3021-5400'
ON CONFLICT DO NOTHING;

-- Architecture & Built Environment — Article 2
INSERT INTO articles (journal_id, issue_id, title, doi, abstract, page_start, page_end, access_status, date_published)
SELECT j.id, ji.id,
  'Urban Green Space Provision in Mid-Sized Philippine Cities',
  '10.5555/jabes.2026.002',
  'A comparative assessment of urban green space availability in five mid-sized Philippine cities, using land use data and resident surveys to evaluate accessibility and planning outcomes.',
  '20', '36', 'Restricted', '2026-03-01'
FROM journals j
JOIN journal_volumes jv ON jv.journal_id = j.id AND jv.volume_number = '1'
JOIN journal_issues ji ON ji.volume_id = jv.id AND ji.issue_number = '1'
WHERE j.print_issn = '3021-5400'
ON CONFLICT DO NOTHING;

-- ── 6. Authors and keywords ───────────────────────────────────────────────────

INSERT INTO authors (display_name, first_name, last_name, affiliation, orcid)
VALUES ('Ana Valdez', 'Ana', 'Valdez', 'Sample University', 'https://orcid.org/0000-0005-1001-0001')
ON CONFLICT DO NOTHING;
INSERT INTO authors (display_name, first_name, last_name, affiliation, orcid)
VALUES ('Carlo Santos', 'Carlo', 'Santos', 'Sample University', 'https://orcid.org/0000-0005-1001-0002')
ON CONFLICT DO NOTHING;
INSERT INTO authors (display_name, first_name, last_name, affiliation, orcid)
VALUES ('Bianca Lim', 'Bianca', 'Lim', 'Sample University', 'https://orcid.org/0000-0005-1001-0003')
ON CONFLICT DO NOTHING;
INSERT INTO authors (display_name, first_name, last_name, affiliation, orcid)
VALUES ('Rafael Torres', 'Rafael', 'Torres', 'Sample University', 'https://orcid.org/0000-0005-1001-0004')
ON CONFLICT DO NOTHING;
INSERT INTO authors (display_name, first_name, last_name, affiliation, orcid)
VALUES ('Diane Cruz', 'Diane', 'Cruz', 'Sample University', 'https://orcid.org/0000-0005-1001-0005')
ON CONFLICT DO NOTHING;
INSERT INTO authors (display_name, first_name, last_name, affiliation, orcid)
VALUES ('Miguel Bautista', 'Miguel', 'Bautista', 'Sample University', 'https://orcid.org/0000-0005-1001-0006')
ON CONFLICT DO NOTHING;
INSERT INTO authors (display_name, first_name, last_name, affiliation, orcid)
VALUES ('Patricia Ocampo', 'Patricia', 'Ocampo', 'Sample University', 'https://orcid.org/0000-0005-1001-0008')
ON CONFLICT DO NOTHING;
INSERT INTO authors (display_name, first_name, last_name, affiliation, orcid)
VALUES ('Kevin Dela Cruz', 'Kevin', 'Dela Cruz', 'Sample University', 'https://orcid.org/0000-0005-1001-0008')
ON CONFLICT DO NOTHING;

-- Link authors to articles
INSERT INTO article_authors (article_id, author_id, author_order, is_corresponding)
SELECT a.id, au.id, 1, true
FROM articles a, authors au
WHERE a.doi = '10.5555/jbaa.2026.001' AND au.orcid = 'https://orcid.org/0000-0005-1001-0001'
ON CONFLICT DO NOTHING;

INSERT INTO article_authors (article_id, author_id, author_order, is_corresponding)
SELECT a.id, au.id, 1, true
FROM articles a, authors au
WHERE a.doi = '10.5555/jbaa.2026.002' AND au.orcid = 'https://orcid.org/0000-0005-1001-0002'
ON CONFLICT DO NOTHING;

INSERT INTO article_authors (article_id, author_id, author_order, is_corresponding)
SELECT a.id, au.id, 1, true
FROM articles a, authors au
WHERE a.doi = '10.5555/jmadi.2026.001' AND au.orcid = 'https://orcid.org/0000-0005-1001-0003'
ON CONFLICT DO NOTHING;

INSERT INTO article_authors (article_id, author_id, author_order, is_corresponding)
SELECT a.id, au.id, 1, true
FROM articles a, authors au
WHERE a.doi = '10.5555/jmadi.2026.002' AND au.orcid = 'https://orcid.org/0000-0005-1001-0004'
ON CONFLICT DO NOTHING;

INSERT INTO article_authors (article_id, author_id, author_order, is_corresponding)
SELECT a.id, au.id, 1, true
FROM articles a, authors au
WHERE a.doi = '10.5555/jcms.2026.001' AND au.orcid = 'https://orcid.org/0000-0005-1001-0005'
ON CONFLICT DO NOTHING;

INSERT INTO article_authors (article_id, author_id, author_order, is_corresponding)
SELECT a.id, au.id, 1, true
FROM articles a, authors au
WHERE a.doi = '10.5555/jcms.2026.002' AND au.orcid = 'https://orcid.org/0000-0005-1001-0006'
ON CONFLICT DO NOTHING;

INSERT INTO article_authors (article_id, author_id, author_order, is_corresponding)
SELECT a.id, au.id, 1, true
FROM articles a, authors au
WHERE a.doi = '10.5555/jabes.2026.001' AND au.orcid = 'https://orcid.org/0000-0005-1001-0008'
ON CONFLICT DO NOTHING;

INSERT INTO article_authors (article_id, author_id, author_order, is_corresponding)
SELECT a.id, au.id, 1, true
FROM articles a, authors au
WHERE a.doi = '10.5555/jabes.2026.002' AND au.orcid = 'https://orcid.org/0000-0005-1001-0008'
ON CONFLICT DO NOTHING;

-- Keywords
INSERT INTO keywords (name) VALUES ('financial reporting') ON CONFLICT DO NOTHING;
INSERT INTO keywords (name) VALUES ('small enterprises') ON CONFLICT DO NOTHING;
INSERT INTO keywords (name) VALUES ('philippine accounting') ON CONFLICT DO NOTHING;
INSERT INTO keywords (name) VALUES ('digital marketing') ON CONFLICT DO NOTHING;
INSERT INTO keywords (name) VALUES ('consumer behavior') ON CONFLICT DO NOTHING;
INSERT INTO keywords (name) VALUES ('ui design') ON CONFLICT DO NOTHING;
INSERT INTO keywords (name) VALUES ('academic repositories') ON CONFLICT DO NOTHING;
INSERT INTO keywords (name) VALUES ('digital storytelling') ON CONFLICT DO NOTHING;
INSERT INTO keywords (name) VALUES ('student engagement') ON CONFLICT DO NOTHING;
INSERT INTO keywords (name) VALUES ('social media') ON CONFLICT DO NOTHING;
INSERT INTO keywords (name) VALUES ('news consumption') ON CONFLICT DO NOTHING;
INSERT INTO keywords (name) VALUES ('media literacy') ON CONFLICT DO NOTHING;
INSERT INTO keywords (name) VALUES ('framing analysis') ON CONFLICT DO NOTHING;
INSERT INTO keywords (name) VALUES ('environmental journalism') ON CONFLICT DO NOTHING;
INSERT INTO keywords (name) VALUES ('passive cooling') ON CONFLICT DO NOTHING;
INSERT INTO keywords (name) VALUES ('tropical architecture') ON CONFLICT DO NOTHING;
INSERT INTO keywords (name) VALUES ('urban green space') ON CONFLICT DO NOTHING;
INSERT INTO keywords (name) VALUES ('urban planning') ON CONFLICT DO NOTHING;

-- Link keywords to articles
INSERT INTO article_keywords (article_id, keyword_id)
SELECT a.id, k.id FROM articles a, keywords k
WHERE a.doi = '10.5555/jbaa.2026.001' AND k.name IN ('financial reporting','small enterprises','philippine accounting')
ON CONFLICT DO NOTHING;

INSERT INTO article_keywords (article_id, keyword_id)
SELECT a.id, k.id FROM articles a, keywords k
WHERE a.doi = '10.5555/jbaa.2026.002' AND k.name IN ('digital marketing','consumer behavior')
ON CONFLICT DO NOTHING;

INSERT INTO article_keywords (article_id, keyword_id)
SELECT a.id, k.id FROM articles a, keywords k
WHERE a.doi = '10.5555/jmadi.2026.001' AND k.name IN ('ui design','academic repositories')
ON CONFLICT DO NOTHING;

INSERT INTO article_keywords (article_id, keyword_id)
SELECT a.id, k.id FROM articles a, keywords k
WHERE a.doi = '10.5555/jmadi.2026.002' AND k.name IN ('digital storytelling','student engagement')
ON CONFLICT DO NOTHING;

INSERT INTO article_keywords (article_id, keyword_id)
SELECT a.id, k.id FROM articles a, keywords k
WHERE a.doi = '10.5555/jcms.2026.001' AND k.name IN ('social media','news consumption','media literacy')
ON CONFLICT DO NOTHING;

INSERT INTO article_keywords (article_id, keyword_id)
SELECT a.id, k.id FROM articles a, keywords k
WHERE a.doi = '10.5555/jcms.2026.002' AND k.name IN ('framing analysis','environmental journalism')
ON CONFLICT DO NOTHING;

INSERT INTO article_keywords (article_id, keyword_id)
SELECT a.id, k.id FROM articles a, keywords k
WHERE a.doi = '10.5555/jabes.2026.001' AND k.name IN ('passive cooling','tropical architecture')
ON CONFLICT DO NOTHING;

INSERT INTO article_keywords (article_id, keyword_id)
SELECT a.id, k.id FROM articles a, keywords k
WHERE a.doi = '10.5555/jabes.2026.002' AND k.name IN ('urban green space','urban planning')
ON CONFLICT DO NOTHING;
