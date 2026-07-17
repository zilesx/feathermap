begin;

alter table public.sightings add column if not exists notes text check (char_length(notes) <= 1000);

create table if not exists public.sighting_media (
  id uuid primary key default gen_random_uuid(),
  sighting_id uuid not null references public.sightings(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  object_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  byte_size integer not null check (byte_size between 1 and 5242880),
  created_at timestamptz not null default now()
);

create table if not exists public.sighting_comments (
  id uuid primary key default gen_random_uuid(),
  sighting_id uuid not null references public.sightings(id) on delete cascade,
  commenter_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists sighting_media_sighting_idx on public.sighting_media(sighting_id, created_at);
create index if not exists sighting_comments_sighting_idx on public.sighting_comments(sighting_id, created_at);
alter table public.sighting_media enable row level security;
alter table public.sighting_comments enable row level security;
revoke all on public.sighting_media from anon, authenticated;
revoke all on public.sighting_comments from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sighting-photos','sighting-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=5242880, allowed_mime_types=excluded.allowed_mime_types;

commit;

-- Rebuild the safe RPC so public results can include report notes.
drop function if exists public.nearby_sightings(integer, timestamptz);
create function public.nearby_sightings(p_limit integer default 100, p_since timestamptz default (now() - interval '7 days'))
returns table (id uuid, species public.bird_species, flock_size public.flock_band, behavior public.sighting_behavior, zone_latitude double precision, zone_longitude double precision, confidence smallint, occurred_at timestamptz, expires_at timestamptz, confirmations bigint, notes text)
language sql security definer set search_path=public as $$
  select s.id,s.species,s.flock_size,s.behavior,
    round((s.exact_latitude+(((('x'||substr(md5(s.id::text||':lat'),1,8))::bit(32)::bigint%1000)/1000.0)-.5)*.06)::numeric,3)::double precision,
    round((s.exact_longitude+(((('x'||substr(md5(s.id::text||':lng'),1,8))::bit(32)::bigint%1000)/1000.0)-.5)*.08)::numeric,3)::double precision,
    s.confidence,s.occurred_at,s.expires_at,count(c.hunter_id),s.notes
  from public.sightings s left join public.confirmations c on c.sighting_id=s.id
  where s.status='active' and s.occurred_at>=greatest(p_since,now()-interval '90 days')
  group by s.id order by s.occurred_at desc limit least(greatest(p_limit,1),250);
$$;
revoke all on function public.nearby_sightings(integer,timestamptz) from public;
grant execute on function public.nearby_sightings(integer,timestamptz) to anon,authenticated;
