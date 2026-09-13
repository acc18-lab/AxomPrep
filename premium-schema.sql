-- AxomPrep Premium v1
-- Run after the existing profiles/subscriptions/payments tables are present.
alter table public.subscriptions add column if not exists plan_code text;
alter table public.subscriptions add column if not exists amount numeric(10,2);
alter table public.subscriptions add column if not exists currency text default 'INR';
alter table public.subscriptions add column if not exists provider text;
alter table public.subscriptions add column if not exists provider_subscription_id text;
alter table public.subscriptions add column if not exists starts_at timestamptz;
alter table public.subscriptions add column if not exists expires_at timestamptz;

alter table public.payments add column if not exists provider text;
alter table public.payments add column if not exists provider_payment_id text;
alter table public.payments add column if not exists currency text default 'INR';

create index if not exists subscriptions_user_status_idx on public.subscriptions(user_id,status);
create index if not exists payments_provider_payment_idx on public.payments(provider_payment_id);

-- Recommended subscription plan value:
-- plan_code = 'premium_monthly'
-- amount = 249.00
-- currency = 'INR'

-- IMPORTANT:
-- Do not activate subscriptions from browser-side payment callbacks.
-- Production activation should be performed by a server-side Razorpay
-- webhook after signature/payment verification.
