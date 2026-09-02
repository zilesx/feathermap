\set ON_ERROR_STOP on

begin;

do $$
declare
  replacement_owner uuid;
begin
  select p.id into replacement_owner
  from public.profiles p
  where not exists (
    select 1 from auth.users u
    where u.id=p.id and u.email like '%@seed.feather-map.invalid'
  )
  order by p.created_at,p.id
  limit 1;

  if replacement_owner is null then
    raise exception 'No ordinary profile is available for rollback ownership';
  end if;

  update public.sightings
  set reporter_id=replacement_owner
  where is_synthetic is true;

  update public.banded_bird_reports b
  set reporter_id=s.reporter_id
  from public.sightings s
  where b.sighting_id=s.id
    and s.is_synthetic is true;
end
$$;

delete from auth.users
where email like '%@seed.feather-map.invalid';

alter table public.hunting_outings
  drop column if exists observed_count_range_slug,
  drop column if exists observed_count_label;

drop index if exists public.hunting_outings_linked_sighting_unique;

notify pgrst,'reload schema';
commit;
