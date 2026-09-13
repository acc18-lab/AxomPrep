-- AxomPrep Premium secure payment layer v2
-- Run this in Supabase SQL Editor.
create table if not exists public.premium_orders_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  razorpay_order_id text not null unique,
  amount integer not null,
  currency text not null default 'INR',
  plan_code text not null default 'premium_monthly',
  status text not null default 'created',
  razorpay_payment_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.premium_subscriptions_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null default 'premium_monthly',
  amount numeric(10,2) not null default 249.00,
  currency text not null default 'INR',
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  provider text not null default 'razorpay',
  provider_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.premium_payments_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id text not null,
  payment_id text not null unique,
  amount integer not null,
  currency text not null default 'INR',
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists premium_orders_user_idx on public.premium_orders_v1(user_id, created_at desc);
create index if not exists premium_subscriptions_user_idx on public.premium_subscriptions_v1(user_id, status, expires_at desc);
create index if not exists premium_payments_user_idx on public.premium_payments_v1(user_id, created_at desc);

alter table public.premium_orders_v1 enable row level security;
alter table public.premium_subscriptions_v1 enable row level security;
alter table public.premium_payments_v1 enable row level security;

drop policy if exists "users_read_own_premium_orders_v1" on public.premium_orders_v1;
create policy "users_read_own_premium_orders_v1"
on public.premium_orders_v1 for select to authenticated
using (user_id = auth.uid());

drop policy if exists "users_read_own_premium_subscriptions_v1" on public.premium_subscriptions_v1;
create policy "users_read_own_premium_subscriptions_v1"
on public.premium_subscriptions_v1 for select to authenticated
using (user_id = auth.uid());

drop policy if exists "users_read_own_premium_payments_v1" on public.premium_payments_v1;
create policy "users_read_own_premium_payments_v1"
on public.premium_payments_v1 for select to authenticated
using (user_id = auth.uid());

drop policy if exists "admin_manage_premium_orders_v1" on public.premium_orders_v1;
create policy "admin_manage_premium_orders_v1"
on public.premium_orders_v1 for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_manage_premium_subscriptions_v1" on public.premium_subscriptions_v1;
create policy "admin_manage_premium_subscriptions_v1"
on public.premium_subscriptions_v1 for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_manage_premium_payments_v1" on public.premium_payments_v1;
create policy "admin_manage_premium_payments_v1"
on public.premium_payments_v1 for all to authenticated
using (public.is_admin()) with check (public.is_admin());
