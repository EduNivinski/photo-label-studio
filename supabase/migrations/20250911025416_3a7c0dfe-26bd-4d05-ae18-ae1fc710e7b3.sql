-- Fix RLS policy for user_drive_tokens (corrected version)

-- Habilitar RLS
alter table public.user_drive_tokens enable row level security;

-- Remover política anterior (se existir)
drop policy if exists deny_all on public.user_drive_tokens;

-- Política "deny all" (permissiva, mas com USING/FALSE + WITH CHECK/FALSE)
create policy deny_all
on public.user_drive_tokens
for all
to authenticated
using (false)
with check (false);

-- Privilégios de tabela
revoke all on public.user_drive_tokens from anon, authenticated;
grant all on public.user_drive_tokens to service_role;