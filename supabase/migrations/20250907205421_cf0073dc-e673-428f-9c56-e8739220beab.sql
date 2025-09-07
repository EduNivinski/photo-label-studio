-- Verificar e ajustar permissões sem pgsodium (que pode não existir no Supabase)

-- (A) Garantir SECURITY DEFINER, owner e search_path seguros no RPC
ALTER FUNCTION public.get_google_drive_tokens_secure(uuid)
  SECURITY DEFINER;

ALTER FUNCTION public.get_google_drive_tokens_secure(uuid)
  OWNER TO postgres;

-- search_path explícito para resolver vault (principal schema necessário)
ALTER FUNCTION public.get_google_drive_tokens_secure(uuid)
  SET search_path = public, extensions, vault;

-- (B) Conceder EXECUTE no RPC aos papéis que o invocam
GRANT EXECUTE ON FUNCTION public.get_google_drive_tokens_secure(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_google_drive_tokens_secure(uuid) TO authenticated;

-- (C) Permissões no schema vault
GRANT USAGE   ON SCHEMA vault TO postgres, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA vault TO postgres, service_role;

-- (D) Futuras funções no schema vault já herdam EXECUTE para service_role
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA vault
  GRANT EXECUTE ON FUNCTIONS TO service_role;