-- AxomPrep Practice Engine v1
create table if not exists public.practice_attempts_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid null references public.exams(id) on delete set null,
  subject_id uuid null references public.subjects(id) on delete set null,
  topic_id uuid null references public.topics(id) on delete set null,
  total_questions integer not null,
  score integer not null,
  percentage integer not null,
  time_taken_seconds integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.practice_answers_v1 (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.practice_attempts_v1(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_answer text,
  correct_answer text,
  is_correct boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.practice_attempts_v1 enable row level security;
alter table public.practice_answers_v1 enable row level security;
drop policy if exists practice_attempts_select_own on public.practice_attempts_v1;
create policy practice_attempts_select_own on public.practice_attempts_v1 for select using (auth.uid()=user_id or public.is_admin());
drop policy if exists practice_attempts_insert_own on public.practice_attempts_v1;
create policy practice_attempts_insert_own on public.practice_attempts_v1 for insert with check (auth.uid()=user_id);
drop policy if exists practice_answers_select_own on public.practice_answers_v1;
create policy practice_answers_select_own on public.practice_answers_v1 for select using (exists (select 1 from public.practice_attempts_v1 a where a.id=attempt_id and (a.user_id=auth.uid() or public.is_admin())));
drop policy if exists practice_answers_insert_own on public.practice_answers_v1;
create policy practice_answers_insert_own on public.practice_answers_v1 for insert with check (exists (select 1 from public.practice_attempts_v1 a where a.id=attempt_id and a.user_id=auth.uid()));
create index if not exists practice_attempts_user_created_idx on public.practice_attempts_v1(user_id,created_at desc);
create index if not exists practice_answers_attempt_idx on public.practice_answers_v1(attempt_id);
