begin;

create table if not exists public.rbac_roles(
  key text primary key check(key~'^[a-z][a-z0-9_]{1,50}$'),
  display_name text not null,
  description text,
  system_role boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.rbac_roles add column if not exists active boolean not null default true;
create table if not exists public.rbac_permissions(
  key text primary key check(key~'^[a-z][a-z0-9_.]{2,80}$'),
  description text not null,
  sensitive boolean not null default false
);
create table if not exists public.rbac_role_permissions(
  role_key text not null references public.rbac_roles(key) on delete cascade,
  permission_key text not null references public.rbac_permissions(key) on delete cascade,
  primary key(role_key,permission_key)
);
create table if not exists public.user_roles(
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_key text not null references public.rbac_roles(key) on delete cascade,
  assigned_by uuid references public.profiles(id),
  reason text not null default 'Legacy role migration',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  primary key(user_id,role_key)
);

insert into public.rbac_roles(key,display_name,description) values
 ('user','User','Standard community access'),
 ('moderator','Moderator','Content moderation'),
 ('support_admin','Support administrator','Account support and recovery'),
 ('catalog_admin','Catalog administrator','Species and category management'),
 ('operations_admin','Operations administrator','Configuration, features, and operational health'),
 ('security_admin','Security administrator','Security, sessions, MFA, and role review'),
 ('super_admin','Super administrator','Complete administrative authority')
on conflict(key) do update set display_name=excluded.display_name,description=excluded.description;

insert into public.rbac_permissions(key,description,sensitive) values
 ('moderation.view','View moderation cases',false),('moderation.resolve','Resolve moderation cases',false),
 ('users.view','View user directory and detail',false),('users.edit_profile','Edit user profiles',false),
 ('users.suspend','Suspend or reinstate users',true),('users.request_recovery','Request account recovery',true),
 ('users.reset_mfa','Reset user MFA',true),('catalog.view','View catalog administration',false),
 ('catalog.manage','Manage species and categories',false),('config.view','View application configuration',false),
 ('config.manage','Manage application configuration',true),('features.view','View feature flags',false),
 ('features.assign','Assign user feature overrides',false),('features.manage','Create and manage feature flags',true),
 ('features.emergency_disable','Disable features immediately',true),('operations.view','View synchronization health',false),
 ('audit.view','View audit records',true),('security.view','View security operations',true),
 ('roles.assign','Assign predefined roles',true),('roles.manage','Manage role permission mappings',true)
on conflict(key) do update set description=excluded.description,sensitive=excluded.sensitive;

insert into public.rbac_role_permissions(role_key,permission_key)
select role_key,permission_key from (values
 ('moderator','moderation.view'),('moderator','moderation.resolve'),
 ('support_admin','users.view'),('support_admin','users.edit_profile'),('support_admin','users.request_recovery'),
 ('catalog_admin','catalog.view'),('catalog_admin','catalog.manage'),
 ('operations_admin','config.view'),('operations_admin','config.manage'),('operations_admin','features.view'),('operations_admin','features.assign'),('operations_admin','features.manage'),('operations_admin','features.emergency_disable'),('operations_admin','operations.view'),
 ('security_admin','users.view'),('security_admin','users.suspend'),('security_admin','users.reset_mfa'),('security_admin','security.view'),('security_admin','audit.view'),('security_admin','roles.assign'),
 ('super_admin','moderation.view'),('super_admin','moderation.resolve'),('super_admin','users.view'),('super_admin','users.edit_profile'),('super_admin','users.suspend'),('super_admin','users.request_recovery'),('super_admin','users.reset_mfa'),('super_admin','catalog.view'),('super_admin','catalog.manage'),('super_admin','config.view'),('super_admin','config.manage'),('super_admin','features.view'),('super_admin','features.assign'),('super_admin','features.manage'),('super_admin','features.emergency_disable'),('super_admin','operations.view'),('super_admin','audit.view'),('super_admin','security.view'),('super_admin','roles.assign'),('super_admin','roles.manage')
)v(role_key,permission_key) on conflict do nothing;

insert into public.user_roles(user_id,role_key,reason)
select id,case role when 'admin' then 'super_admin' when 'moderator' then 'moderator' else 'user' end,'Migrated from legacy profile role'
from public.profiles on conflict do nothing;

create table if not exists public.feature_flags(
  id uuid primary key default gen_random_uuid(),
  key text not null unique check(key~'^[a-z][a-z0-9_]{2,80}$'),
  display_name text not null,
  description text,
  environment text not null default 'production' check(environment in('development','staging','production')),
  enabled boolean not null default false,
  default_value boolean not null default false,
  emergency_disabled boolean not null default false,
  minimum_client_version text,
  rollout_percentage smallint not null default 100 check(rollout_percentage between 0 and 100),
  archived_at timestamptz,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.feature_flag_rules(
  id uuid primary key default gen_random_uuid(),
  feature_flag_id uuid not null references public.feature_flags(id) on delete cascade,
  priority integer not null default 100,
  target_type text not null check(target_type in('role','platform','client_version','cohort')),
  target_value text not null,
  result boolean not null,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.feature_flag_user_overrides(
  feature_flag_id uuid not null references public.feature_flags(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  value boolean not null,
  reason text not null check(char_length(reason) between 4 and 500),
  expires_at timestamptz,
  assigned_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key(feature_flag_id,user_id)
);

insert into public.feature_flags(key,display_name,description,enabled,default_value) values
 ('map_location_picker','Interactive report map selection','Select protected report coordinates directly on the map',true,true),
 ('local_report_drafts','Local report drafts','Persist unfinished reports in browser storage',false,false),
 ('automatic_synchronization','Automatic draft synchronization','Submit queued drafts when connectivity returns',false,false),
 ('native_camera','Native camera integration','Use native capture in packaged applications',false,false),
 ('push_notifications','Push notifications','Receive native push notifications',false,false),
 ('ai_species_identification','AI species identification','Suggest species from an attached image',false,false)
on conflict(key) do nothing;

alter table public.sightings add column if not exists client_report_id uuid;
create unique index if not exists sightings_client_report_unique on public.sightings(reporter_id,client_report_id) where client_report_id is not null;
alter table public.sighting_media add column if not exists client_media_id uuid;
create unique index if not exists sighting_media_client_unique on public.sighting_media(uploader_id,client_media_id) where client_media_id is not null;

create table if not exists public.client_sync_events(
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  client_report_id uuid,
  client_version text,
  platform text,
  event_type text not null check(event_type in('queued','uploading','submitted','failed','rejected','duplicate','photo_failed')),
  error_code text,
  retry_count integer not null default 0,
  age_seconds integer,
  created_at timestamptz not null default now()
);
create index if not exists client_sync_events_ops_idx on public.client_sync_events(created_at desc,event_type);

alter table public.rbac_roles enable row level security;
alter table public.rbac_permissions enable row level security;
alter table public.rbac_role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.feature_flags enable row level security;
alter table public.feature_flag_rules enable row level security;
alter table public.feature_flag_user_overrides enable row level security;
alter table public.client_sync_events enable row level security;
revoke all on public.rbac_roles,public.rbac_permissions,public.rbac_role_permissions,public.user_roles,public.feature_flags,public.feature_flag_rules,public.feature_flag_user_overrides,public.client_sync_events from anon,authenticated;

commit;
