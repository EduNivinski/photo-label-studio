-- Create audit table for Google Drive OAuth callbacks
create table if not exists public.drive_oauth_audit (
  id bigserial primary key,
  user_id uuid not null,
  phase text not null,        -- "exchange_start" | "exchange_ok" | "exchange_fail" | "upsert_ok" | "upsert_fail"
  has_access_token boolean,
  has_refresh_token boolean,
  details jsonb,
  created_at timestamptz not null default now()
);

-- Enable RLS and restrict access to service role only
alter table public.drive_oauth_audit enable row level security;

drop policy if exists deny_all_drive_oauth_audit on public.drive_oauth_audit;
create policy deny_all_drive_oauth_audit
on public.drive_oauth_audit
for all
to authenticated
using (false)
with check (false);

-- Revoke access from regular users, grant to service role
revoke all on public.drive_oauth_audit from anon, authenticated;
grant all on public.drive_oauth_audit to service_role;