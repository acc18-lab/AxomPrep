-- AxomPrep Books CMS setup
-- Run once in Supabase Dashboard > SQL Editor as project owner.
-- This allows the existing admin UI to manage books and upload public cover images.

alter table public.books_v1 add column if not exists author text;
alter table public.books_v1 add column if not exists description text;
alter table public.books_v1 add column if not exists exam_name text;
alter table public.books_v1 add column if not exists category text;
alter table public.books_v1 add column if not exists cover_url text;
alter table public.books_v1 add column if not exists amazon_url text;
alter table public.books_v1 add column if not exists flipkart_url text;
alter table public.books_v1 add column if not exists price numeric(10,2);
alter table public.books_v1 add column if not exists featured boolean not null default false;
alter table public.books_v1 add column if not exists status text not null default 'draft';
alter table public.books_v1 add column if not exists created_at timestamptz not null default now();

alter table public.books_v1 enable row level security;
drop policy if exists "public_read_published_books_v1" on public.books_v1;
create policy "public_read_published_books_v1" on public.books_v1
for select to anon, authenticated using (status = 'published');
drop policy if exists "admin_manage_books_v1" on public.books_v1;
create policy "admin_manage_books_v1" on public.books_v1
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "public_read_book_covers" on storage.objects;
create policy "public_read_book_covers" on storage.objects
for select to anon, authenticated using (bucket_id = 'book-covers');
drop policy if exists "admin_upload_book_covers" on storage.objects;
create policy "admin_upload_book_covers" on storage.objects
for insert to authenticated
with check (bucket_id = 'book-covers' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "admin_update_book_covers" on storage.objects;
create policy "admin_update_book_covers" on storage.objects
for update to authenticated
using (bucket_id = 'book-covers' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (bucket_id = 'book-covers' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "admin_delete_book_covers" on storage.objects;
create policy "admin_delete_book_covers" on storage.objects
for delete to authenticated
using (bucket_id = 'book-covers' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
