-- Permitir settings sem pasta selecionada ainda
alter table public.user_drive_settings
  alter column drive_folder_id drop not null,
  alter column drive_folder_name drop not null;

-- Caso exista essa coluna e esteja NOT NULL, relaxar também
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='user_drive_settings' and column_name='drive_folder_path'
  ) then
    execute 'alter table public.user_drive_settings alter column drive_folder_path drop not null';
  end if;
end$$;

-- Garantir defaults neutros (opcional)
update public.user_drive_settings
set drive_folder_path = coalesce(drive_folder_path, '')
where drive_folder_path is null;