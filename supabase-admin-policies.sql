-- AxomPrep admin hardening
-- Run this in Supabase SQL Editor AFTER creating/logging into your admin account.
-- First, make your own profile an admin by replacing the email below.

alter table public.profiles add column if not exists role text not null default 'user';

-- Replace this email with the email you use to log in to AxomPrep.
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR-ADMIN-EMAIL-HERE');

-- Admin-only write access. Public users should only read published content.
drop policy if exists "admin_manage_questions" on public.questions;
create policy "admin_manage_questions" on public.questions
for all to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

drop policy if exists "admin_manage_current_affairs" on public.current_affairs;
create policy "admin_manage_current_affairs" on public.current_affairs
for all to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

-- Keep profile roles protected: users can read their own profile, but only an admin
-- should be able to change roles.
drop policy if exists "users_read_own_profile" on public.profiles;
create policy "users_read_own_profile" on public.profiles
for select to authenticated using (id=auth.uid() or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

drop policy if exists "admin_manage_profiles" on public.profiles;
create policy "admin_manage_profiles" on public.profiles
for update to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
