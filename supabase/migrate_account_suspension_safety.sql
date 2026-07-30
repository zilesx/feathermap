begin;

alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references public.profiles(id) on delete set null,
  add column if not exists suspension_reason text;

insert into public.rbac_permissions(key,description,sensitive)
values
  ('users.unlock','Unlock suspended or authentication-locked accounts',true)
on conflict(key) do update
set description=excluded.description,
    sensitive=excluded.sensitive;

insert into public.rbac_role_permissions(role_key,permission_key)
values
  ('support_admin','users.suspend'),
  ('support_admin','users.unlock'),
  ('security_admin','users.unlock'),
  ('super_admin','users.unlock')
on conflict do nothing;

commit;

notify pgrst, 'reload schema';
