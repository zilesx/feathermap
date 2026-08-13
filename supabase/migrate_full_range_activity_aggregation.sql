begin;

-- National and regional map aggregation must happen before any row limit is
-- applied. The partial index keeps the bounded one-year scan inexpensive while
-- excluding content that is not eligible for public map display.
create index if not exists sightings_public_activity_time_idx
  on public.sightings(occurred_at desc)
  where status in ('active','expired');

create or replace function public.activity_heatmap_range(
  p_since timestamptz default (now() - interval '30 days'),
  p_until timestamptz default now(),
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
language sql
security definer
set search_path=public
as $$
  with bounds as (
    select
      greatest(coalesce(p_since,now()-interval '30 days'),now()-interval '365 days') range_start,
      least(coalesce(p_until,now()),now()) range_end,
      greatest(.01,least(coalesce(p_grid_degrees,4),10)) grid_size,
      greatest(coalesce(p_minimum,3),3) minimum_reports
  ), protected_activity as (
    select
      round((s.exact_latitude+(((('x'||substr(md5(s.id::text||':lat'),1,8))::bit(32)::bigint%1000)/1000.0)-.5)*.06)::numeric,3)::double precision zone_latitude,
      round((s.exact_longitude+(((('x'||substr(md5(s.id::text||':lng'),1,8))::bit(32)::bigint%1000)/1000.0)-.5)*.08)::numeric,3)::double precision zone_longitude,
      sc.category_slug,
      coalesce(
        s.estimated_birds_snapshot,
        case s.flock_size
          when '1-10' then 6
          when '10-25' then 18
          when '25-50' then 38
          else greatest(50,least(coalesce(sc.occasional_flock_ceiling,250),coalesce(sc.typical_flock_max,50)*2))
        end
      )::bigint bird_estimate,
      b.grid_size,
      b.minimum_reports
    from public.sightings s
    join public.species_catalog sc on sc.slug=s.species_slug and sc.enabled
    cross join bounds b
    where s.status in ('active','expired')
      and s.occurred_at>=b.range_start
      and s.occurred_at<=b.range_end
  ), category_cells as (
    select
      floor(zone_latitude/grid_size)*grid_size+grid_size/2 latitude,
      floor(zone_longitude/grid_size)*grid_size+grid_size/2 longitude,
      category_slug,
      count(*) report_total,
      sum(bird_estimate) bird_total,
      max(minimum_reports) minimum_reports
    from protected_activity
    group by 1,2,3
  ), cells as (
    select
      latitude,
      longitude,
      sum(report_total)::bigint report_total,
      sum(bird_total)::bigint bird_total,
      (array_agg(category_slug order by bird_total desc,category_slug))[1] dominant_category,
      jsonb_object_agg(
        category_slug,
        jsonb_build_object('reports',report_total,'birds',bird_total)
      ) category_breakdown,
      max(minimum_reports) minimum_reports
    from category_cells
    group by latitude,longitude
  )
  select
    latitude,
    longitude,
    report_total,
    bird_total,
    dominant_category,
    least(1.0,ln(1+bird_total::double precision)/ln(100001.0)),
    category_breakdown
  from cells
  where report_total>=minimum_reports;
$$;

revoke all on function public.activity_heatmap_range(timestamptz,timestamptz,double precision,integer) from public;
grant execute on function public.activity_heatmap_range(timestamptz,timestamptz,double precision,integer) to anon,authenticated;

notify pgrst,'reload schema';
commit;
