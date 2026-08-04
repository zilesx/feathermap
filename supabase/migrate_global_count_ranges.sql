begin;

create table if not exists public.report_count_ranges(
  slug text primary key check(slug~'^[a-z0-9_]+$'),
  display_label text not null check(char_length(display_label) between 1 and 40),
  minimum_count bigint not null check(minimum_count>=1),
  maximum_count bigint check(maximum_count is null or maximum_count>=minimum_count),
  description text check(description is null or char_length(description)<=240),
  sort_order integer not null default 100,
  enabled boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists report_count_range_order_idx on public.report_count_ranges(sort_order) where archived_at is null;

create or replace function public.prevent_overlapping_report_count_ranges()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.enabled and new.archived_at is null and exists(
    select 1 from public.report_count_ranges r
    where r.slug<>new.slug and r.enabled and r.archived_at is null
      and int8range(r.minimum_count,coalesce(r.maximum_count+1,9223372036854775807),'[)') &&
          int8range(new.minimum_count,coalesce(new.maximum_count+1,9223372036854775807),'[)')
  ) then raise exception 'Active report count ranges cannot overlap'; end if;
  new.updated_at=now();
  return new;
end $$;
drop trigger if exists validate_report_count_range on public.report_count_ranges;
create trigger validate_report_count_range before insert or update on public.report_count_ranges
for each row execute function public.prevent_overlapping_report_count_ranges();

insert into public.report_count_ranges(slug,display_label,minimum_count,maximum_count,description,sort_order)
values
 ('1_10','1–10',1,10,'Small group',10),
 ('11_25','11–25',11,25,'Small flock',20),
 ('26_50','26–50',26,50,'Medium flock',30),
 ('51_100','51–100',51,100,'Large flock',40),
 ('101_500','101–500',101,500,'Large concentration',50),
 ('501_1000','501–1,000',501,1000,'Very large concentration',60),
 ('1001_10000','1,001–10,000',1001,10000,'Major migration concentration',70),
 ('10001_50000','10,001–50,000',10001,50000,'Major migration event',80),
 ('50001_100000','50,001–100,000',50001,100000,'Exceptional migration event',90),
 ('100000_plus','100,000+',100001,null,'Exceptional mass concentration',100)
on conflict(slug) do nothing;

alter table public.sightings
  add column if not exists count_range_slug text references public.report_count_ranges(slug),
  add column if not exists flock_label_snapshot text,
  add column if not exists flock_min_snapshot bigint,
  add column if not exists flock_max_snapshot bigint,
  add column if not exists estimated_birds_snapshot bigint;

update public.sightings set
  count_range_slug=case flock_size::text when '1-10' then '1_10' when '10-25' then '11_25' when '25-50' then '26_50' else '51_100' end,
  flock_label_snapshot=case flock_size::text when '1-10' then '1–10' when '10-25' then '11–25' when '25-50' then '26–50' else '51–100' end,
  flock_min_snapshot=case flock_size::text when '1-10' then 1 when '10-25' then 11 when '25-50' then 26 else 51 end,
  flock_max_snapshot=case flock_size::text when '1-10' then 10 when '10-25' then 25 when '25-50' then 50 else 100 end,
  estimated_birds_snapshot=case flock_size::text when '1-10' then 6 when '10-25' then 18 when '25-50' then 38 else 75 end
where count_range_slug is null;

alter table public.report_count_ranges enable row level security;
revoke all on public.report_count_ranges from anon,authenticated;

drop function if exists public.activity_heatmap(timestamptz,double precision,integer);
create function public.activity_heatmap(p_since timestamptz default(now()-interval '7 days'),p_grid_degrees double precision default 4,p_minimum integer default 3)
returns table(cell_latitude double precision,cell_longitude double precision,report_count bigint,estimated_birds bigint,dominant_category text,intensity double precision,category_breakdown jsonb)
language sql security definer set search_path=public as $$
with safe as (
 select round((s.exact_latitude+(((('x'||substr(md5(s.id::text||':lat'),1,8))::bit(32)::bigint%1000)/1000.0)-.5)*.06)::numeric,3)::double precision zone_latitude,
 round((s.exact_longitude+(((('x'||substr(md5(s.id::text||':lng'),1,8))::bit(32)::bigint%1000)/1000.0)-.5)*.08)::numeric,3)::double precision zone_longitude,
 sc.category_slug,coalesce(s.estimated_birds_snapshot,case s.flock_size when '1-10' then 6 when '10-25' then 18 when '25-50' then 38 else greatest(50,least(coalesce(sc.occasional_flock_ceiling,250),coalesce(sc.typical_flock_max,50)*2)) end)::bigint bird_estimate
 from public.sightings s join public.species_catalog sc on sc.slug=s.species_slug and sc.enabled
 where s.status in('active','expired') and s.occurred_at>=greatest(p_since,now()-interval '365 days')
), grouped as (select floor(zone_latitude/p_grid_degrees)*p_grid_degrees+p_grid_degrees/2 lat,floor(zone_longitude/p_grid_degrees)*p_grid_degrees+p_grid_degrees/2 lon,category_slug,count(*) count,sum(bird_estimate) birds from safe group by 1,2,3),
cells as (select lat,lon,sum(count)::bigint total,sum(birds)::bigint bird_total,(array_agg(category_slug order by birds desc,category_slug))[1] dominant,jsonb_object_agg(category_slug,jsonb_build_object('reports',count,'birds',birds)) breakdown from grouped group by lat,lon)
select lat,lon,total,bird_total,dominant,least(1.0,ln(1+bird_total::double precision)/ln(100001.0)),breakdown from cells where total>=greatest(p_minimum,3);
$$;
revoke all on function public.activity_heatmap(timestamptz,double precision,integer) from public;
grant execute on function public.activity_heatmap(timestamptz,double precision,integer) to anon,authenticated;

notify pgrst,'reload schema';
commit;
