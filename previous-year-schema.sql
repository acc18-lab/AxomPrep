-- AxomPrep Previous Year Questions v1
-- Uses the existing public.questions.tags text[] and year fields.
-- Classify a published question as a PYQ by adding the exact tag: PYQ.
create index if not exists idx_questions_pyq_year on public.questions(year) where status='published';
create index if not exists idx_questions_tags_gin on public.questions using gin(tags);

-- Example classification:
-- update public.questions
-- set tags=array_append(coalesce(tags,'{}'::text[]),'PYQ'), year=2025
-- where id='<QUESTION_UUID>';
