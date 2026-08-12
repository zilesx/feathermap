-- FeatherMap production synthetic activity dataset.
--
-- Purpose: populate the preceding two years with realistic-looking demonstration
-- activity using the enabled catalog's migration windows, flyways, and flock
-- characteristics. This data is synthetic and must not be used for biological,
-- regulatory, or scientific analysis.
--
-- Batch ID: 7c091b20-26f7-4f11-a202-608120150000
-- Expected volume: 150,000 sightings and approximately 60 band encounters.
-- Safe to rerun: the prior copy of this batch is removed inside the transaction.
\set ON_ERROR_STOP on

begin;
select setseed(0.8122026);

do $$
declare
  batch constant uuid := '7c091b20-26f7-4f11-a202-608120150000';
  profile_count integer;
  species_count integer;
  range_count integer;
begin
  select count(*) into profile_count from public.profiles;
  select count(*) into species_count
  from public.species_catalog
  where enabled
    and jsonb_array_length(coalesce(migration_profile->'flyways','[]'::jsonb)) > 0;
  select count(*) into range_count
  from public.report_count_ranges
  where enabled and archived_at is null;

  if profile_count = 0 then
    raise exception 'At least one FeatherMap profile is required before loading synthetic data';
  end if;
  if species_count = 0 then
    raise exception 'No enabled species have configured migration flyways';
  end if;
  if range_count = 0 then
    raise exception 'No active report-count ranges are configured';
  end if;

  -- Banded reports use ON DELETE SET NULL, so remove them before their sightings.
  delete from public.banded_bird_reports
  where sighting_id in (
    select id from public.sightings where seed_batch_id = batch
  );
  delete from public.sightings where seed_batch_id = batch;

  insert into public.sightings (
    reporter_id, species_slug, flock_size, behavior, notes, observed_weather,
    exact_latitude, exact_longitude, accuracy_meters, confidence,
    occurred_at, expires_at, created_at, status, is_synthetic, seed_batch_id,
    count_range_slug, flock_label_snapshot, flock_min_snapshot,
    flock_max_snapshot, estimated_birds_snapshot, reporter_attribution
  )
  with recursive
  flyway_nodes(flyway, seq, lat, lon) as (values
    ('pacific',1,32.65,-115.55),('pacific',2,35.60,-119.25),
    ('pacific',3,38.30,-121.45),('pacific',4,41.25,-121.25),
    ('pacific',5,44.35,-120.40),('pacific',6,46.35,-119.15),
    ('pacific',7,48.15,-122.05),
    ('central',1,27.75,-97.25),('central',2,31.70,-101.80),
    ('central',3,35.15,-101.10),('central',4,38.55,-98.65),
    ('central',5,41.05,-98.45),('central',6,44.45,-100.10),
    ('central',7,47.45,-100.30),
    ('mississippi',1,29.45,-91.15),('mississippi',2,32.90,-91.15),
    ('mississippi',3,35.55,-90.60),('mississippi',4,38.75,-90.35),
    ('mississippi',5,42.15,-90.25),('mississippi',6,45.10,-92.60),
    ('mississippi',7,47.25,-96.00),
    ('atlantic',1,27.65,-80.65),('atlantic',2,31.75,-81.05),
    ('atlantic',3,35.35,-76.25),('atlantic',4,38.55,-76.20),
    ('atlantic',5,40.55,-74.20),('atlantic',6,42.75,-73.20),
    ('atlantic',7,45.15,-70.75)
  ),
  generated as (
    select n,
      now() - random() * interval '730 days' as observed_at
    from generate_series(1,150000) n
  ),
  calendar as (
    select g.*,
      extract(month from observed_at)::integer as month_no,
      extract(doy from observed_at)::integer as day_no
    from generated g
  ),
  species_choice as (
    select c.*, chosen.slug as species_slug, chosen.flyways,
      chosen.typical_flock_min, chosen.typical_flock_median,
      chosen.typical_flock_max, chosen.occasional_flock_ceiling,
      chosen.large_aggregation,
      chosen.spring_start, chosen.spring_end, chosen.fall_start, chosen.fall_end
    from calendar c
    cross join lateral (
      select sc.slug,
        array(select jsonb_array_elements_text(sc.migration_profile->'flyways')) as flyways,
        sc.typical_flock_min, sc.typical_flock_median,
        sc.typical_flock_max, sc.occasional_flock_ceiling,
        sc.large_aggregation,
        coalesce((sc.migration_profile#>>'{spring,start_month}')::integer,3) as spring_start,
        coalesce((sc.migration_profile#>>'{spring,end_month}')::integer,5) as spring_end,
        coalesce((sc.migration_profile#>>'{fall,start_month}')::integer,8) as fall_start,
        coalesce((sc.migration_profile#>>'{fall,end_month}')::integer,11) as fall_end
      from public.species_catalog sc
      where sc.enabled
        and jsonb_array_length(coalesce(sc.migration_profile->'flyways','[]'::jsonb)) > 0
      order by random() / greatest(0.15,
        case
          when c.month_no between
            coalesce((sc.migration_profile#>>'{spring,start_month}')::integer,3)
            and coalesce((sc.migration_profile#>>'{spring,end_month}')::integer,5)
            then 4.8
          when c.month_no between
            coalesce((sc.migration_profile#>>'{fall,start_month}')::integer,8)
            and coalesce((sc.migration_profile#>>'{fall,end_month}')::integer,11)
            then 5.4
          when c.month_no in (12,1,2) then 1.6
          else 0.42
        end
      )
      limit 1
    ) chosen
  ),
  routed as (
    select s.*,
      s.flyways[1 + floor(random()*array_length(s.flyways,1))::integer] as flyway,
      case
        when month_no between spring_start and spring_end then
          greatest(1,least(7,1 + floor(
            ((month_no-spring_start+random()) /
              greatest(1,(spring_end-spring_start+1))::double precision) * 7
          )::integer))
        when month_no between fall_start and fall_end then
          greatest(1,least(7,7 - floor(
            ((month_no-fall_start+random()) /
              greatest(1,(fall_end-fall_start+1))::double precision) * 7
          )::integer))
        when month_no in (12,1,2) then 1 + floor(random()*2)::integer
        else 6 + floor(random()*2)::integer
      end as node_seq
    from species_choice s
  ),
  positioned as (
    select r.*,
      n.lat + (random()-.5)*1.35 as latitude,
      n.lon + (random()-.5)*1.75 as longitude
    from routed r
    join flyway_nodes n on n.flyway=r.flyway and n.seq=r.node_seq
  ),
  estimated as (
    select p.*,
      greatest(1,round(
        case
          when random() < 0.58 then
            typical_flock_min + random()*greatest(1,typical_flock_median-typical_flock_min)
          when random() < 0.92 then
            typical_flock_median + random()*greatest(1,typical_flock_max-typical_flock_median)
          when large_aggregation then
            typical_flock_max + power(random(),2.4)*greatest(1,occasional_flock_ceiling-typical_flock_max)
          else typical_flock_max
        end
      ))::bigint as bird_estimate
    from positioned p
  ),
  ranged as (
    select e.*, rr.slug as range_slug, rr.display_label,
      rr.minimum_count, rr.maximum_count
    from estimated e
    cross join lateral (
      select r.slug,r.display_label,r.minimum_count,r.maximum_count
      from public.report_count_ranges r
      where r.enabled and r.archived_at is null
        and e.bird_estimate >= r.minimum_count
        and (r.maximum_count is null or e.bird_estimate <= r.maximum_count)
      order by r.sort_order
      limit 1
    ) rr
  ),
  synthetic_owner as (
    -- Keep synthetic records off ordinary member accounts. The oldest profile
    -- is the installation owner in existing deployments and is used only to
    -- satisfy report ownership/FK requirements.
    select id from public.profiles order by created_at,id limit 1
  )
  select
    synthetic_owner.id,
    r.species_slug,
    case when r.bird_estimate<=10 then '1-10'
         when r.bird_estimate<=25 then '10-25'
         when r.bird_estimate<=50 then '25-50'
         else '50+' end::public.flock_band,
    (array['feeding','resting','flying_over','circling','moving_in']::public.sighting_behavior[])
      [1+floor(random()*5)::integer],
    'Synthetic migration-pattern demonstration record · batch 2026-08-12',
    jsonb_build_object(
      'sky',(array['clear','partly_cloudy','overcast','fog'])[1+floor(random()*4)::integer],
      'precipitation',case when random()<.80 then 'none'
        when r.month_no in(12,1,2) and r.latitude>36 then 'snow'
        when random()<.45 then 'drizzle' else 'rain' end,
      'wind',(array['calm','light','moderate','strong'])[1+floor(random()*4)::integer]
    ),
    r.latitude,r.longitude,150+floor(random()*850)::integer,
    58+floor(random()*38)::integer,
    r.observed_at,r.observed_at+interval '6 hours',
    r.observed_at+random()*interval '2 hours',
    case when r.observed_at>now()-interval '6 hours' then 'active' else 'expired' end,
    true,batch,r.range_slug,r.display_label,r.minimum_count,r.maximum_count,
    r.bird_estimate,'FeatherMap synthetic migration model'
  from ranged r cross join synthetic_owner;

  raise notice 'Inserted % synthetic sightings in batch %',
    (select count(*) from public.sightings where seed_batch_id=batch),batch;
end $$;

-- Keep the multi-bird detail table consistent with every generated sighting.
insert into public.sighting_bird_entries (
  sighting_id,entry_order,species_slug,subspecies_slug,count_range_slug,
  flock_label_snapshot,flock_min_snapshot,flock_max_snapshot,
  estimated_birds_snapshot,banded_count
)
select s.id,0,s.species_slug,s.subspecies_slug,s.count_range_slug,
  coalesce(s.flock_label_snapshot,s.flock_size::text),
  s.flock_min_snapshot,s.flock_max_snapshot,s.estimated_birds_snapshot,0
from public.sightings s
where s.seed_batch_id='7c091b20-26f7-4f11-a202-608120150000'
on conflict(sighting_id,entry_order) do nothing;

-- About 0.04% of the batch receives a clearly synthetic band encounter.
create temporary table synthetic_band_entries on commit drop as
select s.id sighting_id,e.id entry_id,s.reporter_id,s.species_slug,
  s.subspecies_slug,s.occurred_at,s.exact_latitude,s.exact_longitude,
  row_number() over(order by s.occurred_at,s.id) band_sequence
from public.sightings s
join public.sighting_bird_entries e on e.sighting_id=s.id and e.entry_order=0
where s.seed_batch_id='7c091b20-26f7-4f11-a202-608120150000'
  and mod(hashtextextended(s.id::text,0),2500)=0;

insert into public.banded_bird_reports (
  reporter_id,sighting_id,sighting_entry_id,species_slug,subspecies_slug,
  band_number,band_type,band_color,encounter_type,occurred_at,
  exact_latitude,exact_longitude,notes
)
select reporter_id,sighting_id,entry_id,species_slug,subspecies_slug,
  'SYN-'||lpad(band_sequence::text,6,'0'),
  case when mod(band_sequence,5)=0 then 'color' else 'metal' end,
  case when mod(band_sequence,5)=0 then
    (array['red','blue','green','orange'])[1+mod(band_sequence,4)::integer] else null end,
  case when mod(band_sequence,10)=0 then 'photographed' else 'observed' end,
  occurred_at,exact_latitude,exact_longitude,
  'Synthetic band encounter for map and workflow testing'
from synthetic_band_entries;

update public.sighting_bird_entries e set banded_count=1
from synthetic_band_entries b where e.id=b.entry_id;

commit;

-- Verification summary -------------------------------------------------------
select count(*) as synthetic_reports,
  min(occurred_at) as earliest_report,
  max(occurred_at) as latest_report,
  count(*) filter(where occurred_at>=now()-interval '30 days') as past_30_days,
  count(*) filter(where occurred_at>=now()-interval '365 days') as past_year
from public.sightings
where seed_batch_id='7c091b20-26f7-4f11-a202-608120150000';

select date_trunc('month',occurred_at)::date month,count(*) reports,
  sum(estimated_birds_snapshot) estimated_birds
from public.sightings
where seed_batch_id='7c091b20-26f7-4f11-a202-608120150000'
group by 1 order by 1;

select sc.category_slug,s.species_slug,count(*) reports,
  sum(s.estimated_birds_snapshot) estimated_birds
from public.sightings s
join public.species_catalog sc on sc.slug=s.species_slug
where s.seed_batch_id='7c091b20-26f7-4f11-a202-608120150000'
group by sc.category_slug,s.species_slug
order by reports desc;

select count(*) as synthetic_band_encounters
from public.banded_bird_reports b
join public.sightings s on s.id=b.sighting_id
where s.seed_batch_id='7c091b20-26f7-4f11-a202-608120150000';
