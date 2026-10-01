begin;

alter table public.user_memberships
  add column if not exists billing_provider text not null default 'manual',
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false;

alter table public.user_memberships drop constraint if exists user_memberships_status_check;
alter table public.user_memberships add constraint user_memberships_status_check
  check (status in ('active','trialing','past_due','canceled','expired','incomplete','unpaid','paused'));
alter table public.user_memberships drop constraint if exists user_memberships_billing_provider_check;
alter table public.user_memberships add constraint user_memberships_billing_provider_check
  check (billing_provider in ('manual','stripe'));

create unique index if not exists user_memberships_external_customer_uidx
  on public.user_memberships(external_customer_id)
  where external_customer_id is not null;
create unique index if not exists user_memberships_external_subscription_uidx
  on public.user_memberships(external_subscription_id)
  where external_subscription_id is not null;

create table if not exists public.membership_prices (
  id uuid primary key default gen_random_uuid(),
  level_key text not null references public.membership_levels(key) on delete cascade,
  billing_provider text not null default 'stripe' check (billing_provider in ('stripe')),
  provider_product_id text not null,
  provider_price_id text not null unique,
  billing_interval text not null check (billing_interval in ('month','year')),
  interval_count integer not null default 1 check (interval_count between 1 and 12),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  unit_amount bigint not null check (unit_amount >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(level_key,billing_provider,billing_interval,interval_count,currency)
);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  livemode boolean not null,
  stripe_created_at timestamptz,
  processing_status text not null default 'processing' check (processing_status in ('processing','processed','failed')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.billing_sync_log (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  event_id text,
  operation text not null,
  outcome text not null check (outcome in ('success','failure','ignored')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.app_config(key,value,description)
values ('billing','{"enabled":false,"checkout_enabled":false,"monthly_enabled":true,"annual_enabled":true,"automatic_tax":true,"promotion_codes":false,"trial_days":0,"past_due_grace_days":3,"trialing_grants_access":true,"past_due_grants_access":true,"cancel_access_at_period_end":true,"default_free_tier":"free","billing_support_email":"","terms_url":"","refund_policy_url":""}'::jsonb,'Stripe billing and entitlement behavior.')
on conflict (key) do nothing;

do $$
begin
  if to_regclass('public.rbac_permissions') is not null then
    insert into public.rbac_permissions(key,description,sensitive) values
      ('billing.view','View billing configuration and subscription health',true),
      ('billing.manage','Change billing configuration and tier price mappings',true),
      ('billing.reconcile','Reconcile local subscription state with Stripe',true)
    on conflict (key) do nothing;
  end if;
  if to_regclass('public.rbac_role_permissions') is not null then
    insert into public.rbac_role_permissions(role_key,permission_key)
    select 'super_admin', key from public.rbac_permissions where key in ('billing.view','billing.manage','billing.reconcile')
    on conflict do nothing;
  end if;
end $$;

alter table public.membership_prices enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.billing_sync_log enable row level security;
revoke all on public.membership_prices,public.stripe_webhook_events,public.billing_sync_log from anon,authenticated;

notify pgrst, 'reload schema';
commit;
