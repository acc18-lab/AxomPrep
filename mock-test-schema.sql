-- AxomPrep Mock Tests v1
-- Safe standalone tables for timed mock-test attempts.

create table if not exists public.mock_attempts_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  test_code text not null,
  test_title text not null,
  exam_name text,
  total_questions integer not null,
  score integer not null default 0,
  time_limit_seconds integer not null,
  time_taken_seconds integer,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.mock_answers_v1 (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.mock_attempts_v1(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_answer text,
  correct_answer text not null,
  is_correct boolean not null default false,
  time_spent_seconds integer not null default 0
);

create index if not exists mock_attempts_v1_user_created_idx
  on public.mock_attempts_v1(user_id, created_at desc);
create index if not exists mock_answers_v1_attempt_idx
  on public.mock_answers_v1(attempt_id);

alter table public.mock_attempts_v1 enable row level security;
alter table public.mock_answers_v1 enable row level security;

drop policy if exists "users_insert_own_mock_attempts_v1" on public.mock_attempts_v1;
create policy "users_insert_own_mock_attempts_v1"
on public.mock_attempts_v1 for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "users_read_own_mock_attempts_v1" on public.mock_attempts_v1;
create policy "users_read_own_mock_attempts_v1"
on public.mock_attempts_v1 for select to authenticated
using (user_id = auth.uid());

drop policy if exists "users_update_own_mock_attempts_v1" on public.mock_attempts_v1;
create policy "users_update_own_mock_attempts_v1"
on public.mock_attempts_v1 for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users_insert_own_mock_answers_v1" on public.mock_answers_v1;
create policy "users_insert_own_mock_answers_v1"
on public.mock_answers_v1 for insert to authenticated
with check (exists (
  select 1 from public.mock_attempts_v1 a
  where a.id = attempt_id and a.user_id = auth.uid()
));

drop policy if exists "users_read_own_mock_answers_v1" on public.mock_answers_v1;
create policy "users_read_own_mock_answers_v1"
on public.mock_answers_v1 for select to authenticated
using (exists (
  select 1 from public.mock_attempts_v1 a
  where a.id = attempt_id and a.user_id = auth.uid()
));
