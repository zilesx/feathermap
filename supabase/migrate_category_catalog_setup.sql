begin;

alter table public.bird_categories
  add column if not exists color text not null default '#7fa84a',
  add column if not exists icon text not null default 'bird';

alter table public.bird_categories
  drop constraint if exists bird_categories_color_format;
alter table public.bird_categories
  add constraint bird_categories_color_format check (color ~ '^#[0-9A-Fa-f]{6}$');

commit;
