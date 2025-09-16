-- ============== FOLDERS ==============
create table if not exists public.drive_folders (
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id text not null,
  name text not null,
  parent_id text,
  drive_id text,
  path_cached text,
  trashed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, folder_id)
);

alter table public.drive_folders enable row level security;
drop policy if exists "deny all folders" on public.drive_folders;
create policy "deny all folders" on public.drive_folders as restrictive for all
  to authenticated
  using (false);

revoke all on public.drive_folders from anon, authenticated;
grant all on public.drive_folders to service_role;

create index if not exists idx_drive_folders_user_parent on public.drive_folders(user_id, parent_id);
create index if not exists idx_drive_folders_user_path   on public.drive_folders(user_id, path_cached);

-- ============== ITEMS (FILES) ==============
create table if not exists public.drive_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  file_id text not null,
  name text not null,
  mime_type text not null,
  size bigint,
  md5_checksum text,
  created_time timestamptz,
  modified_time timestamptz,
  drive_id text,
  parents text[],
  trashed boolean not null default false,
  web_view_link text,
  web_content_link text,
  thumbnail_link text,
  image_meta jsonb,
  video_meta jsonb,
  path_cached text,
  last_seen_at timestamptz not null default now(),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, file_id)
);

alter table public.drive_items enable row level security;
drop policy if exists "deny all items" on public.drive_items;
create policy "deny all items" on public.drive_items as restrictive for all
  to authenticated
  using (false);

revoke all on public.drive_items from anon, authenticated;
grant all on public.drive_items to service_role;

create index if not exists idx_drive_items_user_mime     on public.drive_items(user_id, mime_type);
create index if not exists idx_drive_items_user_modified on public.drive_items(user_id, modified_time desc);
create index if not exists idx_drive_items_user_path     on public.drive_items(user_id, path_cached);