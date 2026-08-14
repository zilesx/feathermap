\set ON_ERROR_STOP on

begin;

alter table public.hunting_outings
  add column if not exists observed_count_range_slug text references public.report_count_ranges(slug),
  add column if not exists observed_count_label text;

create index if not exists hunting_outings_observed_range_idx
  on public.hunting_outings(observed_count_range_slug)
  where observed_count_range_slug is not null;

create unique index if not exists hunting_outings_linked_sighting_unique
  on public.hunting_outings(linked_sighting_id)
  where linked_sighting_id is not null;

create temporary table feathermap_seed_accounts(
  id uuid primary key,
  region text not null,
  account_number integer not null,
  display_name text not null,
  email text not null unique
) on commit drop;

insert into feathermap_seed_accounts(id,region,account_number,display_name,email)
select
  (substr(md5('feathermap-seed:'||region||':'||account_number),1,8)||'-'||
   substr(md5('feathermap-seed:'||region||':'||account_number),9,4)||'-4'||
   substr(md5('feathermap-seed:'||region||':'||account_number),14,3)||'-a'||
   substr(md5('feathermap-seed:'||region||':'||account_number),18,3)||'-'||
   substr(md5('feathermap-seed:'||region||':'||account_number),21,12))::uuid,
  region,
  account_number,
  'Field Observer '||account_number,
  'observer-'||region||'-'||lpad(account_number::text,3,'0')||'@seed.feather-map.invalid'
from unnest(array['pacific','central','mississippi','atlantic']) region
cross join generate_series(1,80) account_number;

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,banned_until,created_at,updated_at,
  is_sso_user,is_anonymous
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  id,'authenticated','authenticated',email,'',now(),
  '{"provider":"none","providers":[]}'::jsonb,
  jsonb_build_object('display_name',display_name,'seed_account',true),
  'infinity'::timestamptz,now(),now(),false,false
from feathermap_seed_accounts
on conflict(id) do update set
  banned_until='infinity'::timestamptz,
  updated_at=now();

insert into public.profiles(id,display_name,preferences,role,created_at,updated_at)
select
  id,display_name,
  jsonb_build_object(
    'visible_groups',jsonb_build_array('ducks','geese','cranes'),
    'default_days',30,
    'auto_open_card',true,
    'anonymous_activity',account_number%5=0
  ),
  'user',
  now()-((account_number%700)+30)*interval '1 day',now()
from feathermap_seed_accounts
on conflict(id) do update set
  display_name=excluded.display_name,
  updated_at=now();

with candidates as (
  select
    s.id,
    case
      when s.exact_longitude < -112 then 'pacific'
      when s.exact_longitude < -95 then 'central'
      when s.exact_longitude < -82 then 'mississippi'
      else 'atlantic'
    end region,
    1+least(79,floor(power(
      (abs(hashtext(s.id::text)::bigint)%10000)::numeric/10000,
      2.25
    )*80)::integer) account_number
  from public.sightings s
  where s.is_synthetic is true
), assignments as (
  select c.id sighting_id,a.id reporter_id
  from candidates c
  join feathermap_seed_accounts a
    on a.region=c.region and a.account_number=c.account_number
)
update public.sightings s
set reporter_id=a.reporter_id,
    reporter_attribution=case
      when abs(hashtext(s.id::text)::bigint)%5=0 then 'Anonymous'
      else 'Field Observer'
    end
from assignments a
where s.id=a.sighting_id;

update public.banded_bird_reports b
set reporter_id=s.reporter_id
from public.sightings s
where b.sighting_id=s.id
  and s.is_synthetic is true;

update public.profiles p
set report_count=counts.report_count,
    updated_at=now()
from (
  select reporter_id,count(*)::integer report_count
  from public.sightings
  where is_synthetic is true
  group by reporter_id
) counts
where p.id=counts.reporter_id;

do $$
declare
  assigned_count bigint;
  distinct_owners integer;
begin
  select count(*),count(distinct reporter_id)
  into assigned_count,distinct_owners
  from public.sightings
  where is_synthetic is true;

  raise notice 'Reassigned % seeded reports across % non-interactive seed users',
    assigned_count,distinct_owners;
end
$$;

notify pgrst,'reload schema';
commit;
