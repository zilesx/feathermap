-- Deterministic synthetic demonstration data. Broad flyway/season patterns are
-- intentionally generalized and are not suitable for biological analysis.
\set ON_ERROR_STOP on
begin;
select setseed(0.7282026);

do $$
declare
  batch uuid := '7c091b20-26f7-4f11-a202-607170100000';
  reporter uuid;
begin
  select id into reporter from public.profiles order by created_at limit 1;
  if reporter is null then raise exception 'Create at least one FeatherMap account before loading seed data'; end if;
  delete from public.sightings where seed_batch_id=batch;

  insert into public.sightings(
    reporter_id,species_slug,flock_size,behavior,notes,observed_weather,
    exact_latitude,exact_longitude,accuracy_meters,confidence,
    occurred_at,expires_at,created_at,status,is_synthetic,seed_batch_id
  )
  with flyway_nodes(flyway,seq,lat,lon) as (values
    ('pacific',1,32.7,-115.5),('pacific',2,38.4,-121.5),('pacific',3,42.0,-121.6),('pacific',4,46.2,-119.2),('pacific',5,48.0,-122.0),
    ('central',1,28.8,-96.5),('central',2,34.2,-102.2),('central',3,38.5,-98.7),('central',4,41.0,-98.5),('central',5,47.0,-100.2),
    ('mississippi',1,29.6,-91.2),('mississippi',2,34.8,-91.2),('mississippi',3,38.8,-90.5),('mississippi',4,43.4,-90.6),('mississippi',5,47.0,-96.0),
    ('atlantic',1,27.8,-80.7),('atlantic',2,32.5,-80.5),('atlantic',3,38.5,-76.2),('atlantic',4,41.0,-74.0),('atlantic',5,44.5,-72.8)
  ), eligible as (
    select sc.*,coalesce(array(select jsonb_array_elements_text(sc.migration_profile->'flyways')),array['central']) flyways
    from public.species_catalog sc
    where sc.enabled and jsonb_array_length(coalesce(sc.migration_profile->'flyways','[]'))>0
  ), generated as (
    select g,now()-(random()*interval '730 days') observed,
      (select e.slug from eligible e order by random()+g*0 limit 1) species_slug
    from generate_series(1,100000) g
  ), chosen as (
    select x.*,e.typical_flock_median,e.typical_flock_max,e.occasional_flock_ceiling,e.large_aggregation,e.flyways,
      extract(month from x.observed)::integer month_no
    from generated x join eligible e using(species_slug)
  ), routed as (
    select c.*,c.flyways[1+floor(random()*array_length(c.flyways,1))::integer] flyway,
      case when c.month_no between 3 and 5 then 1+floor(((c.month_no-3)+random())/3*5)::integer
           when c.month_no between 9 and 11 then 5-floor(((c.month_no-9)+random())/3*5)::integer
           when c.month_no in(12,1,2) then 1+floor(random()*2)::integer
           else 4+floor(random()*2)::integer end node_seq
    from chosen c
  ), positioned as (
    select r.*,n.lat+(random()-.5)*2.2 latitude,n.lon+(random()-.5)*2.6 longitude,
      case when random()<.52 then '1-10'
           when random()<.78 then '10-25'
           when random()<.93 then '25-50'
           else '50+' end::public.flock_band flock
    from routed r join flyway_nodes n on n.flyway=r.flyway and n.seq=greatest(1,least(5,r.node_seq))
  )
  select reporter,p.species_slug,p.flock,
    (array['feeding','resting','flying_over','circling','moving_in'])[1+floor(random()*5)::integer]::public.sighting_behavior,
    'Synthetic migration-pattern demonstration record',
    jsonb_build_object('sky',(array['clear','partly_cloudy','overcast','fog'])[1+floor(random()*4)::integer],
      'precipitation',case when random()<.78 then 'none' when p.month_no in(12,1,2) and p.latitude>36 then 'snow' else 'rain' end,
      'wind',(array['calm','light','moderate','strong'])[1+floor(random()*4)::integer]),
    p.latitude,p.longitude,100+floor(random()*900)::integer,55+floor(random()*41)::integer,
    p.observed,p.observed+interval '6 hours',p.observed+interval '5 minutes',
    case when p.observed>now()-interval '6 hours' then 'active' else 'expired' end,true,batch
  from positioned p;

  raise notice 'Loaded 100,000 synthetic reports in batch %',batch;
end $$;
commit;

-- Safe removal:
-- delete from public.sightings where seed_batch_id='7c091b20-26f7-4f11-a202-607170100000';
