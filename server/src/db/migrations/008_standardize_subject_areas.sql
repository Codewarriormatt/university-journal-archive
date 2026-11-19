-- Standardize existing free-text subject_area values to the controlled list.
-- Values that cannot be mapped are set to NULL so admins can reassign them.

UPDATE journals SET subject_area = 'Business & Accountancy'
  WHERE subject_area ILIKE '%business%'
     OR subject_area ILIKE '%accountan%'
     OR subject_area ILIKE '%accounting%'
     OR subject_area ILIKE '%management%'
     OR subject_area ILIKE '%marketing%'
     OR subject_area ILIKE '%finance%';

UPDATE journals SET subject_area = 'Computing & Information Technology'
  WHERE (subject_area ILIKE '%comput%'
     OR subject_area ILIKE '%information tech%'
     OR subject_area ILIKE '%software%'
     OR subject_area ILIKE '%information system%'
     OR subject_area ILIKE '%data%'
     OR subject_area ILIKE '%network%'
     OR subject_area ILIKE '%cyber%')
  AND subject_area NOT IN (
    'Business & Accountancy','Computing & Information Technology',
    'Multimedia & Design','Education','Communication & Media',
    'Psychology & Social Sciences','Engineering',
    'Architecture & Built Environment','Interdisciplinary'
  );

UPDATE journals SET subject_area = 'Multimedia & Design'
  WHERE (subject_area ILIKE '%multimedia%'
     OR subject_area ILIKE '%design%'
     OR subject_area ILIKE '%arts%'
     OR subject_area ILIKE '%media%')
  AND subject_area NOT IN (
    'Business & Accountancy','Computing & Information Technology',
    'Multimedia & Design','Education','Communication & Media',
    'Psychology & Social Sciences','Engineering',
    'Architecture & Built Environment','Interdisciplinary'
  );

UPDATE journals SET subject_area = 'Education'
  WHERE (subject_area ILIKE '%educat%'
     OR subject_area ILIKE '%pedagog%'
     OR subject_area ILIKE '%teaching%'
     OR subject_area ILIKE '%learning%'
     OR subject_area ILIKE '%curriculum%')
  AND subject_area NOT IN (
    'Business & Accountancy','Computing & Information Technology',
    'Multimedia & Design','Education','Communication & Media',
    'Psychology & Social Sciences','Engineering',
    'Architecture & Built Environment','Interdisciplinary'
  );

UPDATE journals SET subject_area = 'Communication & Media'
  WHERE (subject_area ILIKE '%communicat%'
     OR subject_area ILIKE '%journalism%'
     OR subject_area ILIKE '%broadcast%')
  AND subject_area NOT IN (
    'Business & Accountancy','Computing & Information Technology',
    'Multimedia & Design','Education','Communication & Media',
    'Psychology & Social Sciences','Engineering',
    'Architecture & Built Environment','Interdisciplinary'
  );

UPDATE journals SET subject_area = 'Psychology & Social Sciences'
  WHERE (subject_area ILIKE '%psycholog%'
     OR subject_area ILIKE '%social%'
     OR subject_area ILIKE '%humanit%'
     OR subject_area ILIKE '%behavior%'
     OR subject_area ILIKE '%behaviour%')
  AND subject_area NOT IN (
    'Business & Accountancy','Computing & Information Technology',
    'Multimedia & Design','Education','Communication & Media',
    'Psychology & Social Sciences','Engineering',
    'Architecture & Built Environment','Interdisciplinary'
  );

UPDATE journals SET subject_area = 'Engineering'
  WHERE (subject_area ILIKE '%engineer%'
     OR subject_area ILIKE '%civil%'
     OR subject_area ILIKE '%mechanical%'
     OR subject_area ILIKE '%electrical%'
     OR subject_area ILIKE '%environmental%')
  AND subject_area NOT IN (
    'Business & Accountancy','Computing & Information Technology',
    'Multimedia & Design','Education','Communication & Media',
    'Psychology & Social Sciences','Engineering',
    'Architecture & Built Environment','Interdisciplinary'
  );

UPDATE journals SET subject_area = 'Architecture & Built Environment'
  WHERE (subject_area ILIKE '%architect%'
     OR subject_area ILIKE '%built environment%'
     OR subject_area ILIKE '%urban%'
     OR subject_area ILIKE '%construction%')
  AND subject_area NOT IN (
    'Business & Accountancy','Computing & Information Technology',
    'Multimedia & Design','Education','Communication & Media',
    'Psychology & Social Sciences','Engineering',
    'Architecture & Built Environment','Interdisciplinary'
  );

-- Any remaining non-null value that did not match above is unrecognized — clear it.
UPDATE journals SET subject_area = NULL
  WHERE subject_area IS NOT NULL
  AND subject_area NOT IN (
    'Business & Accountancy','Computing & Information Technology',
    'Multimedia & Design','Education','Communication & Media',
    'Psychology & Social Sciences','Engineering',
    'Architecture & Built Environment','Interdisciplinary'
  );
