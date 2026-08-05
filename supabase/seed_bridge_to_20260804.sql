-- Synthetic bridge data for non-production testing. Uses existing catalog species
-- and broad flyway corridors; exact locations remain protected by the public RPC.
begin;

do $$ begin
  if not exists(select 1 from public.profiles) then
    raise exception 'Create at least one profile before generating bridge data';
  end if;
end $$;

with bounds as (
  select greatest(coalesce(max(occurred_at), timestamptz '2026-01-01'), timestamptz '2025-08-04') as start_at
  from public.sightings
), reporter as (
  select id from public.profiles order by created_at limit 1
), days as (
  select day, row_number() over() n
  from bounds, lateral generate_series(date_trunc('day',start_at)+interval '1 day',timestamptz '2026-08-04',interval '6 hours') day
), candidates as (
  select d.day,d.n,r.id reporter_id,s.slug species_slug,
    case (d.n % 4)
      when 0 then 47.0 - (extract(month from d.day)-4)*1.6
      when 1 then 45.0 - (extract(month from d.day)-4)*1.3
      when 2 then 43.0 - (extract(month from d.day)-4)*1.1
      else 41.0 - (extract(month from d.day)-4)*.9
    end + (random()-.5)*4 exact_latitude,
    (array[-121.5,-101.0,-91.0,-77.0])[(d.n%4)+1] + (random()-.5)*5 exact_longitude
  from days d cross join reporter r
  cross join lateral (
    select slug from public.species_catalog
    where enabled=true
    order by md5(slug||d.n::text)
    limit 1
  ) s
)
insert into public.sightings(
  reporter_id,species_slug,flock_size,behavior,notes,exact_latitude,exact_longitude,
  accuracy_meters,confidence,occurred_at,expires_at,created_at,status,is_synthetic
)
select reporter_id,species_slug,
  case when n%12=0 then '50+'::public.flock_band when n%5=0 then '25-50'::public.flock_band when n%3=0 then '10-25'::public.flock_band else '1-10'::public.flock_band end,
  (array['feeding','circling','flying_over','resting','moving_in']::public.sighting_behavior[])[(n%5)+1],
  'Synthetic migration-pattern bridge report',exact_latitude,exact_longitude,5000,55+(n%35),day,day+interval '6 hours',day,
  'expired',true
from candidates
where day < timestamptz '2026-08-04 23:59:59'
on conflict do nothing;

commit;
