-- 3E.1) Adiciona a coluna do caminho salvo
alter table public.user_drive_settings
  add column if not exists drive_folder_path text not null default '';

-- 3E.2) (opcional) backfill simples: se estiver vazio, use o nome atual
update public.user_drive_settings
set drive_folder_path = drive_folder_name
where (drive_folder_path is null or drive_folder_path = '')
  and coalesce(drive_folder_name, '') <> '';