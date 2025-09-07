-- (A) Garantir SECURITY DEFINER, owner e search_path seguros no RPC
ALTER FUNCTION public.get_google_drive_tokens_secure(uuid)
  SECURITY DEFINER;

ALTER FUNCTION public.get_google_drive_tokens_secure(uuid)
  OWNER TO postgres;

-- search_path explícito para resolver pgsodium/vault sem depender do ambiente
ALTER FUNCTION public.get_google_drive_tokens_secure(uuid)
  SET search_path = public, extensions, pgsodium, vault;

-- (B) Conceder EXECUTE no RPC aos papéis que o invocam
GRANT EXECUTE ON FUNCTION public.get_google_drive_tokens_secure(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_google_drive_tokens_secure(uuid) TO authenticated;

-- (C) Permissões nos schemas pgsodium e vault
GRANT USAGE   ON SCHEMA pgsodium TO postgres, service_role;
GRANT USAGE   ON SCHEMA vault    TO postgres, service_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pgsodium TO postgres, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA vault    TO postgres, service_role;

-- (opcional) Futuras funções nessas schemas já herdam EXECUTE para service_role
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA pgsodium
  GRANT EXECUTE ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA vault
  GRANT EXECUTE ON FUNCTIONS TO service_role;