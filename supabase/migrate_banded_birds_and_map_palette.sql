begin;

update public.bird_categories set color = case slug
  when 'ducks' then '#0072B2'
  when 'geese' then '#E69F00'
  when 'cranes' then '#CC3311'
  when 'doves' then '#AA4499'
  when 'shorebirds' then '#009E73'
  when 'upland' then '#D55E00'
  else '#6F4EBD'
end;

create table if not exists public.banded_bird_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  sighting_id uuid references public.sightings(id) on delete set null,
  species_slug text not null references public.species_catalog(slug),
  subspecies_slug text references public.subspecies_catalog(slug),
  band_number text,
  band_type text not null default 'unknown' check (band_type in ('metal','color','neck_collar','wing_tag','unknown')),
  band_color text,
  encounter_type text not null check (encounter_type in ('observed','photographed','recovered','harvested')),
  occurred_at timestamptz not null,
  exact_latitude double precision not null check (exact_latitude between -90 and 90),
  exact_longitude double precision not null check (exact_longitude between -180 and 180),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists banded_bird_reporter_time_idx on public.banded_bird_reports(reporter_id,occurred_at desc);
alter table public.banded_bird_reports enable row level security;
revoke all on public.banded_bird_reports from anon,authenticated;

commit;
