do $$
begin
  if to_regprocedure('public.activity_heatmap_range(timestamp with time zone,timestamp with time zone,double precision,integer,uuid)') is null then
    raise exception 'Required migration missing: activity_heatmap_range with owner exclusion';
  end if;
  if to_regprocedure('public.public_banded_activity(timestamp with time zone,timestamp with time zone)') is null then
    raise exception 'Required migration missing: public_banded_activity';
  end if;
end $$;

select migration_key,applied_at
from public.feathermap_schema_migrations
where migration_key in (
  '20260812_full_range_activity_aggregation',
  '20260812_persistent_banded_map'
)
order by migration_key;
