-- Tabela de estado de sincronização por usuário (idempotente)
create table if not exists public.drive_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  start_page_token text,
  last_full_scan_at timestamptz,
  last_changes_at timestamptz,
  running boolean not null default false,
  last_error text,
  updated_at timestamptz not null default now()
);

-- RLS: negar tudo para authenticated/anon; apenas service_role via Edge Functions
alter table public.drive_sync_state enable row level security;

drop policy if exists "deny all sync" on public.drive_sync_state;
create policy "deny all sync" as restrictive for all to authenticated using (false);

revoke all on public.drive_sync_state from anon, authenticated;
grant all on public.drive_sync_state to service_role;