-- Fix definitivo de permissões do Vault/pgsodium + validação

-- 1. Colocar o RPC com owner que tenha privilégios e manter SECURITY DEFINER
ALTER FUNCTION public.get_google_drive_tokens_secure(uuid)
  OWNER TO postgres;

ALTER FUNCTION public.get_google_drive_tokens_secure(uuid)
  SECURITY DEFINER;

-- 2. search_path explícito: resolve pgsodium/vault dentro do corpo do RPC
ALTER FUNCTION public.get_google_drive_tokens_secure(uuid)
  SET search_path = public, extensions, pgsodium, vault;

-- 3. O RPC pode ser invocado pelos papéis que precisamos
GRANT EXECUTE ON FUNCTION public.get_google_drive_tokens_secure(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_google_drive_tokens_secure(uuid) TO authenticated;

-- 4. Permissões de schema/funções para descriptografar via pgsodium/vault
GRANT USAGE ON SCHEMA pgsodium TO postgres, service_role;
GRANT USAGE ON SCHEMA vault    TO postgres, service_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pgsodium TO postgres, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA vault    TO postgres, service_role;

-- Futuro-proof: funções novas nesses schemas já saem executáveis pelo service_role
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA pgsodium
  GRANT EXECUTE ON FUNCTIONS TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA vault
  GRANT EXECUTE ON FUNCTIONS TO service_role;