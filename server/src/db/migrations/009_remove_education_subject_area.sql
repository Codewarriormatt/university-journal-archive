-- Remove 'Education' from the subject area controlled list.
-- Any journals previously assigned this value are cleared so admins can reassign them.
UPDATE journals SET subject_area = NULL WHERE subject_area = 'Education';
