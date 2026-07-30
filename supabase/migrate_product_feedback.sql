begin;

create table if not exists public.product_feedback (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('bug','feature','usability','data','safety_privacy','other')),
  title text not null check (char_length(title) between 4 and 120),
  description text not null check (char_length(description) between 10 and 4000),
  status text not null default 'new' check (status in ('new','reviewing','planned','in_progress','resolved','declined','needs_information','duplicate')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  contact_allowed boolean not null default true,
  page_path text,
  app_version text,
  platform text,
  diagnostics jsonb not null default '{}'::jsonb,
  assigned_to uuid references public.profiles(id) on delete set null,
  duplicate_of uuid references public.product_feedback(id) on delete set null,
  github_issue_url text,
  resolution_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.product_feedback_messages (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.product_feedback(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  internal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.product_feedback_attachments (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.product_feedback(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  object_path text not null unique,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0 and byte_size <= 5242880),
  created_at timestamptz not null default now()
);

create index if not exists product_feedback_submitter_idx on public.product_feedback(submitted_by,created_at desc);
create index if not exists product_feedback_queue_idx on public.product_feedback(status,priority,created_at desc);
create index if not exists product_feedback_messages_idx on public.product_feedback_messages(feedback_id,created_at);
create index if not exists product_feedback_attachments_idx on public.product_feedback_attachments(feedback_id,created_at);

alter table public.product_feedback enable row level security;
alter table public.product_feedback_messages enable row level security;
alter table public.product_feedback_attachments enable row level security;
revoke all on public.product_feedback,public.product_feedback_messages,public.product_feedback_attachments from anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('feedback-attachments','feedback-attachments',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into public.rbac_permissions(key,description,sensitive) values
 ('feedback.view','View the private product feedback queue',false),
 ('feedback.manage','Assign, respond to, and resolve product feedback',false)
on conflict (key) do update set description=excluded.description,sensitive=excluded.sensitive;

insert into public.rbac_role_permissions(role_key,permission_key) values
 ('super_admin','feedback.view'),('super_admin','feedback.manage'),
 ('support_admin','feedback.view'),('support_admin','feedback.manage'),
 ('operations_admin','feedback.view'),('operations_admin','feedback.manage')
on conflict do nothing;

commit;

notify pgrst, 'reload schema';
