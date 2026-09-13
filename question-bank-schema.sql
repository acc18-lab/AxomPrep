-- AxomPrep Advanced Question Bank v1
-- Uses the existing public.questions table. Safe to run after the original schema.
-- Adds indexes that make admin search/filtering faster.
create index if not exists idx_questions_status_created_at on public.questions(status, created_at desc);
create index if not exists idx_questions_exam_subject on public.questions(exam_id, subject_id);
create index if not exists idx_questions_difficulty on public.questions(difficulty);
create index if not exists idx_questions_year on public.questions(year);

-- Optional duplicate-review helper. This does NOT delete or alter any questions.
create or replace function public.normalized_question_text(input text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(trim(coalesce(input,''))), '\\s+', ' ', 'g');
$$;
