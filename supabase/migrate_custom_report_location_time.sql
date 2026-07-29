begin;

alter table public.sightings
  add column if not exists submitted_at timestamptz,
  add column if not exists location_source text not null default 'current'
    check (location_source in ('current','map','saved','popular','search'));

update public.sightings set submitted_at=created_at where submitted_at is null;
alter table public.sightings
  alter column submitted_at set default now(),
  alter column submitted_at set not null;
create index if not exists sightings_observed_submitted_idx
  on public.sightings(occurred_at desc,submitted_at desc);

insert into public.app_config(key,value,description)
values('reporting','{"enabled":true,"max_note_length":1000,"photo_limit":1,"max_report_age_days":7}'::jsonb,'Reporting controls')
on conflict(key) do update set value=public.app_config.value||'{"max_report_age_days":7}'::jsonb,updated_at=now();

commit;
