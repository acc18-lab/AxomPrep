create table if not exists public.current_affairs_v1 (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  title_assamese text,
  summary text,
  summary_assamese text,
  content text not null,
  content_assamese text,
  category text not null default 'India',
  published_date date not null default current_date,
  source_name text,
  source_url text,
  image_url text,
  status text not null default 'draft' check (status in ('draft','review','approved','published')),
  featured boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists ca_v1_date_idx on public.current_affairs_v1(published_date desc);
create index if not exists ca_v1_status_idx on public.current_affairs_v1(status);
create index if not exists ca_v1_category_idx on public.current_affairs_v1(category);

alter table public.current_affairs_v1 enable row level security;

drop policy if exists "ca_v1_public_read" on public.current_affairs_v1;
drop policy if exists "ca_v1_admin_all" on public.current_affairs_v1;

create policy "ca_v1_public_read" on public.current_affairs_v1
for select to anon, authenticated
using (status = 'published');

create policy "ca_v1_admin_all" on public.current_affairs_v1
for all to authenticated
using (public.is_admin())
with check (public.is_admin());
