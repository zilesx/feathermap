begin;

create table if not exists public.subspecies_catalog(
  slug text primary key check(slug~'^[a-z0-9_]+$'),
  species_slug text not null references public.species_catalog(slug) on delete cascade,
  display_name text not null check(char_length(display_name) between 2 and 100),
  scientific_name text,
  taxonomy_type text not null default 'subspecies' check(taxonomy_type in('subspecies','regional_population','hybrid','variant')),
  aliases text[] not null default '{}',
  regions text[] not null default '{}',
  reference_url text check(reference_url is null or reference_url~'^https://'),
  enabled boolean not null default true,
  sort_order integer not null default 100,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subspecies_parent_order_idx on public.subspecies_catalog(species_slug,sort_order,display_name);

alter table public.sightings add column if not exists subspecies_slug text references public.subspecies_catalog(slug);

create table if not exists public.hunting_outings(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  linked_sighting_id uuid references public.sightings(id) on delete set null,
  occurred_at timestamptz not null,
  ended_at timestamptz,
  hunter_count integer not null default 1 check(hunter_count between 1 and 100),
  exact_latitude double precision check(exact_latitude between -90 and 90),
  exact_longitude double precision check(exact_longitude between -180 and 180),
  location_source text not null default 'current',
  observed_count integer check(observed_count>=0),
  shots_fired integer check(shots_fired>=0),
  unrecovered_count integer check(unrecovered_count>=0),
  notes text check(char_length(notes)<=2000),
  weather jsonb,
  private boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ended_at is null or ended_at>=occurred_at)
);
create index if not exists hunting_outings_user_time_idx on public.hunting_outings(user_id,occurred_at desc);

create table if not exists public.harvest_items(
  id uuid primary key default gen_random_uuid(),
  outing_id uuid not null references public.hunting_outings(id) on delete cascade,
  species_slug text not null references public.species_catalog(slug),
  subspecies_slug text references public.subspecies_catalog(slug),
  recovered_count integer not null check(recovered_count between 0 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists harvest_items_outing_idx on public.harvest_items(outing_id);

alter table public.subspecies_catalog enable row level security;
alter table public.hunting_outings enable row level security;
alter table public.harvest_items enable row level security;
revoke all on public.subspecies_catalog,public.hunting_outings,public.harvest_items from anon,authenticated;

insert into public.subspecies_catalog(slug,species_slug,display_name,scientific_name,taxonomy_type,regions,sort_order)
values
 ('canada_goose_atlantic','canada_goose','Atlantic Canada Goose','Branta canadensis canadensis','subspecies',array['Atlantic Flyway'],10),
 ('canada_goose_interior','canada_goose','Interior Canada Goose','Branta canadensis interior','subspecies',array['Mississippi Flyway','Atlantic Flyway'],20),
 ('canada_goose_giant','canada_goose','Giant Canada Goose','Branta canadensis maxima','subspecies',array['Central Flyway','Mississippi Flyway'],30),
 ('canada_goose_lesser','canada_goose','Lesser Canada Goose','Branta canadensis parvipes','subspecies',array['Pacific Flyway','Central Flyway'],40),
 ('canada_goose_dusky','canada_goose','Dusky Canada Goose','Branta canadensis occidentalis','subspecies',array['Pacific Flyway'],50),
 ('snow_goose_greater','snow_goose','Greater Snow Goose','Anser caerulescens atlanticus','subspecies',array['Atlantic Flyway'],10),
 ('snow_goose_lesser','snow_goose','Lesser Snow Goose','Anser caerulescens caerulescens','subspecies',array['Pacific Flyway','Central Flyway','Mississippi Flyway'],20)
on conflict(slug) do nothing;

notify pgrst,'reload schema';
commit;
