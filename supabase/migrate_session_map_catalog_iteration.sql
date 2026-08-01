begin;

alter table public.species_catalog
  add column if not exists reference_url text,
  add column if not exists reference_source text;

insert into public.app_config(key,value,description)
values(
  'sessions',
  '{"warning_seconds":300,"idle_minutes":60,"absolute_hours":24,"allow_extension":true,"staff_idle_minutes":30}'::jsonb,
  'Application session warning and lifetime policy'
)
on conflict(key) do update
set value=public.app_config.value||excluded.value,updated_at=now();

drop function if exists public.activity_heatmap(timestamptz,double precision,integer);
create function public.activity_heatmap(
  p_since timestamptz default(now()-interval '7 days'),
  p_grid_degrees double precision default 4,
  p_minimum integer default 3
) returns table(
  cell_latitude double precision,
  cell_longitude double precision,
  report_count bigint,
  estimated_birds bigint,
  dominant_category text,
  intensity double precision,
  category_breakdown jsonb
)
language sql security definer set search_path=public as $$
  with safe as (
    select
      round((s.exact_latitude+(((('x'||substr(md5(s.id::text||':lat'),1,8))::bit(32)::bigint%1000)/1000.0)-.5)*.06)::numeric,3)::double precision zone_latitude,
      round((s.exact_longitude+(((('x'||substr(md5(s.id::text||':lng'),1,8))::bit(32)::bigint%1000)/1000.0)-.5)*.08)::numeric,3)::double precision zone_longitude,
      sc.category_slug,
      case s.flock_size when '1-10' then 6 when '10-25' then 18 when '25-50' then 38
        else greatest(50,least(coalesce(sc.occasional_flock_ceiling,250),coalesce(sc.typical_flock_max,50)*2)) end::bigint bird_estimate
    from public.sightings s
    join public.species_catalog sc on sc.slug=s.species_slug and sc.enabled
    where s.status in('active','expired') and s.occurred_at>=greatest(p_since,now()-interval '365 days')
  ), grouped as (
    select floor(zone_latitude/p_grid_degrees)*p_grid_degrees+p_grid_degrees/2 lat,
      floor(zone_longitude/p_grid_degrees)*p_grid_degrees+p_grid_degrees/2 lon,
      category_slug,count(*) count,sum(bird_estimate) birds
    from safe group by 1,2,3
  ), cells as (
    select lat,lon,sum(count)::bigint total,sum(birds)::bigint bird_total,
      (array_agg(category_slug order by birds desc,category_slug))[1] dominant,
      jsonb_object_agg(category_slug,jsonb_build_object('reports',count,'birds',birds)) breakdown
    from grouped group by lat,lon
  )
  select lat,lon,total,bird_total,dominant,
    least(1.0,ln(1+bird_total::double precision)/ln(1001.0)),breakdown
  from cells where total>=greatest(p_minimum,3);
$$;
revoke all on function public.activity_heatmap(timestamptz,double precision,integer) from public;
grant execute on function public.activity_heatmap(timestamptz,double precision,integer) to anon,authenticated;

notify pgrst,'reload schema';
commit;
