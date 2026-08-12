begin;

create table if not exists public.sighting_bird_entries (
  id uuid primary key default gen_random_uuid(),
  sighting_id uuid not null references public.sightings(id) on delete cascade,
  entry_order integer not null default 0 check (entry_order between 0 and 49),
  species_slug text not null references public.species_catalog(slug),
  subspecies_slug text references public.subspecies_catalog(slug),
  count_range_slug text references public.report_count_ranges(slug),
  flock_label_snapshot text not null,
  flock_min_snapshot integer,
  flock_max_snapshot integer,
  estimated_birds_snapshot integer,
  banded_count integer not null default 0 check (banded_count >= 0),
  created_at timestamptz not null default now(),
  unique (sighting_id, entry_order)
);

create index if not exists sighting_bird_entries_sighting_idx
  on public.sighting_bird_entries(sighting_id, entry_order);
create index if not exists sighting_bird_entries_species_idx
  on public.sighting_bird_entries(species_slug, subspecies_slug);

insert into public.sighting_bird_entries (
  sighting_id, entry_order, species_slug, subspecies_slug, count_range_slug,
  flock_label_snapshot, flock_min_snapshot, flock_max_snapshot,
  estimated_birds_snapshot, banded_count
)
select
  s.id, 0, s.species_slug, s.subspecies_slug, s.count_range_slug,
  coalesce(s.flock_label_snapshot, s.flock_size::text), s.flock_min_snapshot,
  s.flock_max_snapshot, s.estimated_birds_snapshot,
  case when exists (
    select 1 from public.banded_bird_reports b where b.sighting_id = s.id
  ) then 1 else 0 end
from public.sightings s
where not exists (
  select 1 from public.sighting_bird_entries e where e.sighting_id = s.id
)
on conflict (sighting_id, entry_order) do nothing;

alter table public.banded_bird_reports
  add column if not exists sighting_entry_id uuid
  references public.sighting_bird_entries(id) on delete set null;
create index if not exists banded_bird_reports_entry_idx
  on public.banded_bird_reports(sighting_entry_id);

update public.banded_bird_reports b
set sighting_entry_id = e.id
from public.sighting_bird_entries e
where b.sighting_entry_id is null
  and e.sighting_id = b.sighting_id
  and e.entry_order = 0;

alter table public.sighting_bird_entries enable row level security;
revoke all on public.sighting_bird_entries from anon, authenticated;
grant all on public.sighting_bird_entries to service_role;

notify pgrst, 'reload schema';
commit;
