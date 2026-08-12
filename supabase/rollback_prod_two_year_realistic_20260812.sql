-- Removes only the production synthetic batch created on 2026-08-12.
\set ON_ERROR_STOP on
begin;

delete from public.banded_bird_reports
where sighting_id in (
  select id from public.sightings
  where seed_batch_id='7c091b20-26f7-4f11-a202-608120150000'
);

-- sighting_bird_entries are removed by their ON DELETE CASCADE relationship.
delete from public.sightings
where seed_batch_id='7c091b20-26f7-4f11-a202-608120150000';

commit;

select count(*) as remaining_batch_reports
from public.sightings
where seed_batch_id='7c091b20-26f7-4f11-a202-608120150000';
