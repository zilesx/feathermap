alter type public.sighting_behavior add value if not exists 'banded_encounter';

begin;

alter table public.banded_bird_reports
  add column if not exists client_report_id uuid;

update public.banded_bird_reports
set client_report_id = gen_random_uuid()
where client_report_id is null;

alter table public.banded_bird_reports
  alter column client_report_id set not null;

create unique index if not exists banded_bird_report_idempotency_idx
  on public.banded_bird_reports(reporter_id, client_report_id);

create index if not exists banded_bird_number_lookup_idx
  on public.banded_bird_reports(lower(band_number), occurred_at desc)
  where band_number is not null;

update public.app_config
set value = coalesce(value, '{}'::jsonb) || jsonb_build_object(
  'warning_seconds', 300,
  'idle_minutes', 4320,
  'absolute_hours', 72,
  'allow_extension', true
)
where key = 'sessions';

commit;

notify pgrst, 'reload schema';
