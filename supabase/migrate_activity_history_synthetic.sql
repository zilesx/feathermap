begin;

create table if not exists public.user_activity_log (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  outcome text not null default 'success' check (outcome in ('success','failure','denied','rate_limited')),
  before_state jsonb,
  after_state jsonb,
  request_context jsonb not null default '{}'::jsonb,
  session_id text,
  created_at timestamptz not null default now()
);
create index if not exists user_activity_user_time_idx on public.user_activity_log(user_id,created_at desc);
create index if not exists user_activity_action_time_idx on public.user_activity_log(action,created_at desc);
alter table public.user_activity_log enable row level security;
revoke all on public.user_activity_log from anon,authenticated;

alter table public.moderation_cases add column if not exists content_snapshot jsonb;
alter table public.moderation_cases add column if not exists reopened_at timestamptz;
alter table public.moderation_cases add column if not exists reopened_by uuid references public.profiles(id);
alter table public.moderation_cases add column if not exists reopen_reason text;

alter table public.sightings add column if not exists is_synthetic boolean not null default false;
alter table public.sightings add column if not exists seed_batch_id uuid;
create index if not exists sightings_seed_batch_idx on public.sightings(seed_batch_id) where seed_batch_id is not null;

commit;
