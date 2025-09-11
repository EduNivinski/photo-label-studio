-- 2.1) Garantir schema/tabela destino
create table if not exists public.user_drive_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token_enc text not null,
  refresh_token_enc text default '' not null,
  scope text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.2) Trazer dados da tabela antiga (se existir) mantendo o mais recente
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'private' and table_name = 'user_drive_tokens'
  ) then
    with ranked as (
      select *
      , row_number() over (partition by user_id order by updated_at desc, created_at desc) as rn
      from private.user_drive_tokens
    )
    insert into public.user_drive_tokens (user_id, access_token_enc, refresh_token_enc, scope, expires_at, created_at, updated_at)
    select user_id, access_token_enc, refresh_token_enc, scope, expires_at, created_at, updated_at
    from ranked
    where rn = 1
    on conflict (user_id) do update
      set access_token_enc = excluded.access_token_enc,
          refresh_token_enc = excluded.refresh_token_enc,
          scope = excluded.scope,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at;
  end if;
end$$;

-- 2.3) RLS deny-all + grants
alter table public.user_drive_tokens enable row level security;

drop policy if exists "Deny all access to regular users" on public.user_drive_tokens;
create policy "Deny all access to regular users"
as restrictive for all
to authenticated
using (false);

revoke all on public.user_drive_tokens from anon, authenticated;
grant all on public.user_drive_tokens to service_role;

-- 2.4) Índices e unicidade
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_drive_tokens_user_id_unique') then
    alter table public.user_drive_tokens
      add constraint user_drive_tokens_user_id_unique unique (user_id);
  end if;
end$$;

create index if not exists idx_user_drive_tokens_user_id on public.user_drive_tokens(user_id);
create index if not exists idx_user_drive_tokens_expires_at on public.user_drive_tokens(expires_at);

-- 2.5) (Opcional) Dropar a antiga
-- drop table if exists private.user_drive_tokens;