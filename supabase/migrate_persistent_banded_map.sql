begin;

create or replace function public.public_banded_activity(p_since timestamptz default(now()-interval '30 days'),p_until timestamptz default now())
returns table(id uuid,sighting_id uuid,species text,subspecies text,zone_latitude double precision,zone_longitude double precision,occurred_at timestamptz)
language sql stable security definer set search_path=public as $$
 select b.id,b.sighting_id,b.species_slug,b.subspecies_slug,
 round((b.exact_latitude+((((('x'||substr(md5(b.id::text||':lat'),1,8))::bit(32)::bigint)::double precision/4294967295)-.5)*.16))::numeric,3)::double precision,
 round((b.exact_longitude+((((('x'||substr(md5(b.id::text||':lon'),1,8))::bit(32)::bigint)::double precision/4294967295)-.5)*.20))::numeric,3)::double precision,b.occurred_at
 from public.banded_bird_reports b join public.sightings s on s.id=b.sighting_id
 where b.sighting_id is not null and b.occurred_at>=greatest(p_since,now()-interval '1 year') and b.occurred_at<=least(p_until,now()) and s.status in('active','expired')
 order by b.occurred_at desc limit 5000;
$$;
revoke all on function public.public_banded_activity(timestamptz,timestamptz) from public;
grant execute on function public.public_banded_activity(timestamptz,timestamptz) to anon,authenticated;
commit;
