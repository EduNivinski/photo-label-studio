-- Fix RLS policy syntax for user_drive_tokens
drop policy if exists "Deny all access to regular users" on public.user_drive_tokens;

-- Corrected syntax: AS RESTRICTIVE comes BEFORE ON
-- For FOR ALL, define both USING (SELECT/UPDATE/DELETE) and WITH CHECK (INSERT/UPDATE)
create policy "Deny all access to regular users"
as restrictive
on public.user_drive_tokens
for all
to authenticated
using (false)
with check (false);