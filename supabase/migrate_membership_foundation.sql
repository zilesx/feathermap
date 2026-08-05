begin;

create table if not exists public.membership_levels (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  display_name text not null,
  description text not null default '',
  badge_color text not null default '#9bdc28',
  sort_order integer not null default 100,
  active boolean not null default true,
  capabilities jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  external_product_id text,
  external_price_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_memberships (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  level_key text not null references public.membership_levels(key),
  status text not null default 'active' check (status in ('active','trialing','past_due','canceled','expired')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  assigned_by uuid references public.profiles(id) on delete set null,
  reason text,
  external_customer_id text,
  external_subscription_id text,
  updated_at timestamptz not null default now()
);

insert into public.membership_levels(key,display_name,description,badge_color,sort_order,capabilities,limits)
values
  ('free','Free','Core FeatherMap community access','#7f8c82',10,'{}','{}'),
  ('supporter','Supporter','Support FeatherMap and receive enhanced community features','#3aaed8',20,'{}','{}'),
  ('pro','Pro','Advanced tools for frequent birders and hunters','#b6f238',30,'{}','{}'),
  ('organization','Organization','Shared capabilities for clubs and conservation organizations','#f0a51b',40,'{}','{}')
on conflict (key) do nothing;

insert into public.user_memberships(user_id,level_key)
select id,'free' from public.profiles
on conflict (user_id) do nothing;

alter table public.membership_levels enable row level security;
alter table public.user_memberships enable row level security;
revoke all on public.membership_levels,public.user_memberships from anon,authenticated;
notify pgrst, 'reload schema';
commit;
