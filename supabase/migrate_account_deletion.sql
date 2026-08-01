begin;

create or replace function public.prepare_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  update public.admin_audit_log set actor_id = null where actor_id = p_user_id;
  update public.app_config set updated_by = null where updated_by = p_user_id;
  update public.flags set resolved_by = null where resolved_by = p_user_id;
  update public.duplicate_candidates set reviewed_by = null where reviewed_by = p_user_id;
  update public.moderation_cases set assigned_to = null where assigned_to = p_user_id;
  update public.moderation_cases set resolved_by = null where resolved_by = p_user_id;
  update public.moderation_cases set reopened_by = null where reopened_by = p_user_id;
  update public.profiles set suspended_by = null where suspended_by = p_user_id;
  update public.sightings set deleted_by = null where deleted_by = p_user_id and reporter_id <> p_user_id;
  update public.product_feedback set assigned_to = null where assigned_to = p_user_id;
  update public.feature_flags set created_by = null where created_by = p_user_id;
  update public.feature_flags set updated_by = null where updated_by = p_user_id;
  update public.feature_flag_rules set created_by = null where created_by = p_user_id;
  update public.user_roles set assigned_by = null where assigned_by = p_user_id;

  delete from public.feature_flag_user_overrides where assigned_by = p_user_id and user_id <> p_user_id;
end;
$$;

revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;

commit;
