-- Development/demo data only. Fills sparse months without replacing real reports.
-- The deterministic batch can be removed with the rollback statement below.
\set ON_ERROR_STOP on
begin;
select setseed(0.8042026);

do $$
declare
  batch constant uuid := '7c091b20-26f7-4f11-a202-607170080004';
  reporter uuid;
begin
  select id into reporter from public.profiles order by created_at limit 1;
  if reporter is null then
    raise exception 'Create at least one FeatherMap profile before loading synthetic data';
  end if;

  delete from public.sightings where seed_batch_id = batch;

  insert into public.sightings(
    reporter_id,species_slug,flock_size,behavior,notes,observed_weather,
    exact_latitude,exact_longitude,accuracy_meters,confidence,
    occurred_at,expires_at,created_at,status,is_synthetic,seed_batch_id
  )
  with months as (
    select month_start,
      extract(month from month_start)::integer month_no,
      case extract(month from month_start)::integer
        when 3 then 3200 when 4 then 4200 when 5 then 3000
        when 9 then 3000 when 10 then 4500 when 11 then 3600
        when 12 then 1800 when 1 then 1700 when 2 then 1900
        else 1100
      end target_count
    from generate_series(
      date_trunc('month',current_date)-interval '23 months',
      date_trunc('month',current_date),interval '1 month'
    ) month_start
  ), existing as (
    select date_trunc('month',occurred_at) month_start,count(*) report_count
    from public.sightings
    where occurred_at >= date_trunc('month',current_date)-interval '23 months'
    group by 1
  ), gaps as (
    select m.*,greatest(0,m.target_count-coalesce(e.report_count,0)) missing
    from months m left join existing e using(month_start)
  ), generated as (
    select g.month_start,g.month_no,n,
      g.month_start
        + random() * (least(g.month_start+interval '1 month',now())-g.month_start) observed
    from gaps g cross join lateral generate_series(1,g.missing) n
    where g.month_start < now()
  ), species_choice as (
    select generated.*,chosen.slug species_slug,chosen.flyways
    from generated
    cross join lateral (
      select sc.slug,
        coalesce(array(select jsonb_array_elements_text(sc.migration_profile->'flyways')),array['central']) flyways
      from public.species_catalog sc
      where sc.enabled
        and jsonb_array_length(coalesce(sc.migration_profile->'flyways','[]')) > 0
      order by random() / greatest(.15,
        case
          when generated.month_no between coalesce((sc.migration_profile#>>'{spring,start_month}')::integer,3)
                                      and coalesce((sc.migration_profile#>>'{spring,end_month}')::integer,5) then 3.4
          when generated.month_no between coalesce((sc.migration_profile#>>'{fall,start_month}')::integer,9)
                                      and coalesce((sc.migration_profile#>>'{fall,end_month}')::integer,11) then 3.8
          when generated.month_no in(12,1,2) then 1.7
          else .55
        end)
      limit 1
    ) chosen
  ), routed as (
    select s.*,s.flyways[1+floor(random()*array_length(s.flyways,1))::integer] flyway,
      case
        when month_no between 3 and 5 then least(5,1+floor(((month_no-3)+random())/3*5)::integer)
        when month_no between 9 and 11 then greatest(1,5-floor(((month_no-9)+random())/3*5)::integer)
        when month_no in(12,1,2) then 1+floor(random()*2)::integer
        else 4+floor(random()*2)::integer
      end node_seq
    from species_choice s
  ), flyway_nodes(flyway,seq,lat,lon) as (values
    ('pacific',1,32.7,-115.5),('pacific',2,38.4,-121.5),('pacific',3,42.0,-121.6),('pacific',4,46.2,-119.2),('pacific',5,48.0,-122.0),
    ('central',1,28.8,-96.5),('central',2,34.2,-102.2),('central',3,38.5,-98.7),('central',4,41.0,-98.5),('central',5,47.0,-100.2),
    ('mississippi',1,29.6,-91.2),('mississippi',2,34.8,-91.2),('mississippi',3,38.8,-90.5),('mississippi',4,43.4,-90.6),('mississippi',5,47.0,-96.0),
    ('atlantic',1,27.8,-80.7),('atlantic',2,32.5,-80.5),('atlantic',3,38.5,-76.2),('atlantic',4,41.0,-74.0),('atlantic',5,44.5,-72.8)
  ), positioned as (
    select r.*,
      n.lat+(random()-.5)*1.7 latitude,
      n.lon+(random()-.5)*2.0 longitude
    from routed r join flyway_nodes n on n.flyway=r.flyway and n.seq=r.node_seq
  )
  select reporter,p.species_slug,
    case when random()<.50 then '1-10' when random()<.76 then '10-25'
         when random()<.92 then '25-50' else '50+' end::public.flock_band,
    (array['feeding','resting','flying_over','circling','moving_in']::public.sighting_behavior[])[1+floor(random()*5)::integer],
    'Synthetic migration-pattern gap-fill report',
    jsonb_build_object(
      'sky',(array['clear','partly_cloudy','overcast','fog'])[1+floor(random()*4)::integer],
      'precipitation',case when random()<.80 then 'none' when p.month_no in(12,1,2) and p.latitude>36 then 'snow' else 'rain' end,
      'wind',(array['calm','light','moderate','strong'])[1+floor(random()*4)::integer]
    ),
    p.latitude,p.longitude,250+floor(random()*750)::integer,58+floor(random()*36)::integer,
    p.observed,p.observed+interval '6 hours',p.observed+interval '5 minutes',
    case when p.observed>now()-interval '6 hours' then 'active' else 'expired' end,
    true,batch
  from positioned p;

  raise notice 'Filled sparse months with synthetic batch %',batch;
end $$;

commit;

-- Distribution review:
-- select date_trunc('month',occurred_at)::date month,count(*) total,
--   count(*) filter(where is_synthetic) synthetic
-- from public.sightings group by 1 order by 1;
-- Rollback:
-- delete from public.sightings where seed_batch_id='7c091b20-26f7-4f11-a202-607170080004';
