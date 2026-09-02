begin;

-- Proximity and repeated-band matches remain available in
-- duplicate_candidates. They are signals, not user-reported abuse cases.
update public.moderation_cases
set
  status = 'duplicate',
  resolution_reason = coalesce(
    nullif(resolution_reason, ''),
    'Moved to the duplicate-candidate workflow'
  ),
  moderator_note = concat_ws(
    E'\n',
    nullif(moderator_note, ''),
    'Automatically closed during actionable moderation queue migration.'
  ),
  resolved_at = coalesce(resolved_at, now()),
  updated_at = now(),
  version = coalesce(version, 1) + 1
where status in ('open', 'assigned', 'escalated', 'needs_info')
  and reason like 'possible_duplicate%';

notify pgrst, 'reload schema';

commit;
