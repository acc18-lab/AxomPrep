-- AxomPrep Admin Mock Test Builder v1
create table if not exists public.mock_tests_v1 (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  exam_id uuid references public.exams(id) on delete set null,
  duration_minutes integer not null default 60,
  total_questions integer not null default 50,
  marks_per_question numeric(6,2) not null default 1,
  negative_mark numeric(6,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','review','approved','published')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mock_test_questions_v1 (
  id uuid primary key default gen_random_uuid(),
  mock_test_id uuid not null references public.mock_tests_v1(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  question_order integer not null,
  unique(mock_test_id, question_id),
  unique(mock_test_id, question_order)
);

create index if not exists mock_tests_v1_status_idx on public.mock_tests_v1(status);
create index if not exists mock_tests_v1_exam_idx on public.mock_tests_v1(exam_id);
create index if not exists mock_test_questions_v1_test_order_idx on public.mock_test_questions_v1(mock_test_id, question_order);

alter table public.mock_tests_v1 enable row level security;
alter table public.mock_test_questions_v1 enable row level security;

drop policy if exists "public_read_published_mock_tests_v1" on public.mock_tests_v1;
create policy "public_read_published_mock_tests_v1" on public.mock_tests_v1 for select to anon, authenticated using (status='published');

drop policy if exists "public_read_published_mock_test_questions_v1" on public.mock_test_questions_v1;
create policy "public_read_published_mock_test_questions_v1" on public.mock_test_questions_v1 for select to anon, authenticated using (exists (select 1 from public.mock_tests_v1 t where t.id=mock_test_id and t.status='published'));

drop policy if exists "admin_manage_mock_tests_v1" on public.mock_tests_v1;
create policy "admin_manage_mock_tests_v1" on public.mock_tests_v1 for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_manage_mock_test_questions_v1" on public.mock_test_questions_v1;
create policy "admin_manage_mock_test_questions_v1" on public.mock_test_questions_v1 for all to authenticated using (public.is_admin()) with check (public.is_admin());
