begin;
create table if not exists public.saved_locations(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 label text not null check(char_length(label) between 1 and 80),
 latitude double precision not null check(latitude between -85 and 85),
 longitude double precision not null check(longitude between -180 and 180),
 zoom double precision not null default 7 check(zoom between 2 and 15),
 sort_order integer not null default 100,
 is_default boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists saved_locations_user_order_idx on public.saved_locations(user_id,sort_order,label);
alter table public.saved_locations enable row level security;
revoke all on public.saved_locations from anon,authenticated;
commit;

drop function if exists public.activity_heatmap(timestamptz,double precision,integer);
drop function if exists public.nearby_sightings(integer,timestamptz);
create function public.nearby_sightings(p_limit integer default 100,p_since timestamptz default(now()-interval '7 days'))
returns table(id uuid,species text,flock_size public.flock_band,behavior public.sighting_behavior,zone_latitude double precision,zone_longitude double precision,confidence smallint,occurred_at timestamptz,expires_at timestamptz,confirmations bigint,notes text,weather jsonb,observed_weather jsonb,reporter_name text)
language sql security definer set search_path=public as $$
 select s.id,s.species_slug,s.flock_size,s.behavior,round((s.exact_latitude+(((('x'||substr(md5(s.id::text||':lat'),1,8))::bit(32)::bigint%1000)/1000.0)-.5)*.06)::numeric,3)::double precision,round((s.exact_longitude+(((('x'||substr(md5(s.id::text||':lng'),1,8))::bit(32)::bigint%1000)/1000.0)-.5)*.08)::numeric,3)::double precision,s.confidence,s.occurred_at,s.expires_at,count(c.hunter_id),s.notes,s.weather,s.observed_weather,case when p.show_attribution then coalesce(nullif(trim(p.first_name),'')||case when nullif(trim(p.last_name),'') is not null then ' '||upper(left(trim(p.last_name),1))||'.' else '' end,'Flyway member') else 'Flyway member' end
 from public.sightings s left join public.confirmations c on c.sighting_id=s.id join public.species_catalog sc on sc.slug=s.species_slug and sc.enabled left join public.profiles p on p.id=s.reporter_id
 where s.status in('active','expired') and s.occurred_at>=greatest(p_since,now()-interval '365 days') group by s.id,p.id order by s.occurred_at desc limit least(greatest(p_limit,1),1000);
$$;
revoke all on function public.nearby_sightings(integer,timestamptz) from public;grant execute on function public.nearby_sightings(integer,timestamptz) to anon,authenticated;

create function public.activity_heatmap(p_since timestamptz default(now()-interval '7 days'),p_grid_degrees double precision default 4,p_minimum integer default 3)
returns table(cell_latitude double precision,cell_longitude double precision,report_count bigint,dominant_category text,intensity double precision)
language sql security definer set search_path=public as $$ with safe as(select n.*,sc.category_slug from public.nearby_sightings(1000,p_since)n join public.species_catalog sc on sc.slug=n.species),grouped as(select floor(zone_latitude/p_grid_degrees)*p_grid_degrees+p_grid_degrees/2 lat,floor(zone_longitude/p_grid_degrees)*p_grid_degrees+p_grid_degrees/2 lon,category_slug,count(*) count from safe group by 1,2,3),ranked as(select *,row_number()over(partition by lat,lon order by count desc,category_slug)rn,sum(count)over(partition by lat,lon)total from grouped)select lat,lon,total,category_slug,least(1.0,total::double precision/25.0)from ranked where rn=1 and total>=greatest(p_minimum,3);$$;
revoke all on function public.activity_heatmap(timestamptz,double precision,integer) from public;grant execute on function public.activity_heatmap(timestamptz,double precision,integer) to anon,authenticated;
