-- user_drive_settings: configurações por usuário para o Google Drive
create table if not exists public.user_drive_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  drive_folder_id text not null,
  drive_folder_name text not null,
  updated_at timestamptz not null default now()
);

-- RLS deny-all; apenas service_role pode ler/gravar
alter table public.user_drive_settings enable row level security;

drop policy if exists "deny all" on public.user_drive_settings;
create policy "deny all" on public.user_drive_settings
  for all to authenticated using (false) with check (false);

revoke all on public.user_drive_settings from anon, authenticated;
grant all on public.user_drive_settings to service_role;

create index if not exists idx_user_drive_settings_user on public.user_drive_settings(user_id);