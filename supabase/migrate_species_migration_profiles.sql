begin;

alter table public.species_catalog
  add column if not exists typical_flock_min integer not null default 1 check (typical_flock_min > 0),
  add column if not exists typical_flock_median integer not null default 12 check (typical_flock_median > 0),
  add column if not exists typical_flock_max integer not null default 50 check (typical_flock_max > 0),
  add column if not exists occasional_flock_ceiling integer not null default 250 check (occasional_flock_ceiling > 0),
  add column if not exists large_aggregation boolean not null default false,
  add column if not exists habitats text[] not null default '{}',
  add column if not exists migration_profile jsonb not null default
    '{"flyways":[],"spring":{"start_month":3,"end_month":5,"direction":"north"},"fall":{"start_month":8,"end_month":11,"direction":"south"},"confidence":"generalized"}'::jsonb
    check (jsonb_typeof(migration_profile)='object');

alter table public.species_catalog
  drop constraint if exists species_catalog_flock_order;
alter table public.species_catalog
  add constraint species_catalog_flock_order check (
    typical_flock_min <= typical_flock_median and
    typical_flock_median <= typical_flock_max and
    typical_flock_max <= occasional_flock_ceiling
  );

update public.species_catalog set
  typical_flock_min=2,typical_flock_median=18,typical_flock_max=80,occasional_flock_ceiling=1000,large_aggregation=true,
  habitats=array['wetlands','lakes','agricultural fields'],
  migration_profile='{"flyways":["pacific","central","mississippi","atlantic"],"spring":{"start_month":2,"end_month":5,"direction":"north"},"fall":{"start_month":8,"end_month":12,"direction":"south"},"confidence":"generalized"}'
where slug in ('mallard','pintail','teal','gadwall','american_coot','diver','mixed');

update public.species_catalog set
  typical_flock_min=5,typical_flock_median=45,typical_flock_max=300,occasional_flock_ceiling=5000,large_aggregation=true,
  habitats=array['wetlands','lakes','agricultural fields','coasts'],
  migration_profile='{"flyways":["pacific","central","mississippi","atlantic"],"spring":{"start_month":2,"end_month":5,"direction":"north"},"fall":{"start_month":9,"end_month":12,"direction":"south"},"confidence":"generalized"}'
where slug in ('canada_goose','snow_goose','white_fronted_goose','tundra_swan');

update public.species_catalog set
  typical_flock_min=2,typical_flock_median=35,typical_flock_max=250,occasional_flock_ceiling=5000,large_aggregation=true,
  habitats=array['shallow wetlands','sandbars','agricultural fields','grasslands'],
  migration_profile='{"flyways":["pacific","central","mississippi"],"spring":{"start_month":2,"end_month":4,"direction":"north"},"fall":{"start_month":8,"end_month":11,"direction":"south"},"confidence":"population-dependent"}'
where slug='sandhill_crane';

update public.species_catalog set
  typical_flock_min=1,typical_flock_median=8,typical_flock_max=30,occasional_flock_ceiling=150,
  habitats=array['woodlands','wetlands','fields'],
  migration_profile='{"flyways":["mississippi","atlantic"],"spring":{"start_month":2,"end_month":5,"direction":"north"},"fall":{"start_month":9,"end_month":12,"direction":"south"},"confidence":"generalized"}'
where slug in ('american_woodcock','wood_duck');

update public.species_catalog set
  typical_flock_min=1,typical_flock_median=12,typical_flock_max=40,occasional_flock_ceiling=300,
  habitats=array['grasslands','agricultural fields','open woodland'],
  migration_profile='{"flyways":["pacific","central","mississippi","atlantic"],"spring":{"start_month":2,"end_month":5,"direction":"north"},"fall":{"start_month":8,"end_month":11,"direction":"south"},"confidence":"generalized"}'
where slug in ('mourning_dove','white_winged_dove','eurasian_collared_dove');

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
  intensity double precision
)
language sql security definer set search_path=public as $$
  with safe as (
    select
      round((s.exact_latitude+(((('x'||substr(md5(s.id::text||':lat'),1,8))::bit(32)::bigint%1000)/1000.0)-.5)*.06)::numeric,3)::double precision zone_latitude,
      round((s.exact_longitude+(((('x'||substr(md5(s.id::text||':lng'),1,8))::bit(32)::bigint%1000)/1000.0)-.5)*.08)::numeric,3)::double precision zone_longitude,
      sc.category_slug,
      case s.flock_size
        when '1-10' then greatest(sc.typical_flock_min,least(sc.typical_flock_median,6))
        when '10-25' then greatest(10,least(sc.typical_flock_max,18))
        when '25-50' then greatest(25,least(sc.typical_flock_max,38))
        else greatest(50,least(sc.occasional_flock_ceiling,sc.typical_flock_max*2))
      end::bigint bird_estimate
    from public.sightings s
    join public.species_catalog sc on sc.slug=s.species_slug and sc.enabled
    where s.status in('active','expired')
      and s.occurred_at>=greatest(p_since,now()-interval '365 days')
  ), grouped as (
    select floor(zone_latitude/p_grid_degrees)*p_grid_degrees+p_grid_degrees/2 lat,
      floor(zone_longitude/p_grid_degrees)*p_grid_degrees+p_grid_degrees/2 lon,
      category_slug,count(*) count,sum(bird_estimate) birds
    from safe group by 1,2,3
  ), ranked as (
    select *,row_number()over(partition by lat,lon order by birds desc,category_slug)rn,
      sum(count)over(partition by lat,lon) total,
      sum(birds)over(partition by lat,lon) bird_total
    from grouped
  )
  select lat,lon,total,bird_total,category_slug,
    least(1.0,ln(1+bird_total::double precision)/ln(1001.0))
  from ranked where rn=1 and total>=greatest(p_minimum,3);
$$;
revoke all on function public.activity_heatmap(timestamptz,double precision,integer) from public;
grant execute on function public.activity_heatmap(timestamptz,double precision,integer) to anon,authenticated;

insert into public.app_config(key,value,description)
values('map_layers','{"heatmap_max_zoom":12,"cluster_max_zoom":12,"minimum_heat_reports":3,"grid_degrees":4}'::jsonb,'Privacy-safe map visualization thresholds')
on conflict(key) do update set value=public.app_config.value||excluded.value,updated_at=now();

commit;
