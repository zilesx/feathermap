begin;

alter table public.sightings
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id);

create index if not exists sightings_deleted_at_idx
  on public.sightings (deleted_at desc)
  where deleted_at is not null;

comment on column public.sightings.deleted_at is
  'Owner-requested soft deletion timestamp. Deleted reports are excluded from public active-report RPCs.';

comment on column public.sightings.deleted_by is
  'User who requested deletion. Owners may delete only their own reports through the API.';

commit;
