-- =============================================
-- SECURITY FIX: RLS + Grants
-- =============================================

-- 1) Fix drive_items RLS policies (CRITICAL)
-- =============================================

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.drive_items ENABLE ROW LEVEL SECURITY;

-- Remove deny-all policy if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'drive_items'
      AND policyname = 'deny all items'
  ) THEN
    EXECUTE 'DROP POLICY "deny all items" ON public.drive_items';
  END IF;
END$$;

-- Drop existing policies if they exist (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='drive_items' AND policyname='Users can view their own drive items') THEN
    EXECUTE 'DROP POLICY "Users can view their own drive items" ON public.drive_items';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='drive_items' AND policyname='Users can insert their own drive items') THEN
    EXECUTE 'DROP POLICY "Users can insert their own drive items" ON public.drive_items';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='drive_items' AND policyname='Users can update their own drive items') THEN
    EXECUTE 'DROP POLICY "Users can update their own drive items" ON public.drive_items';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='drive_items' AND policyname='Users can delete their own drive items') THEN
    EXECUTE 'DROP POLICY "Users can delete their own drive items" ON public.drive_items';
  END IF;
END$$;

-- Create owner-only policies
CREATE POLICY "Users can view their own drive items"
ON public.drive_items
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own drive items"
ON public.drive_items
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drive items"
ON public.drive_items
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drive items"
ON public.drive_items
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 2) Restrict security.* function grants (CRITICAL)
-- =============================================

-- Revoke broad permissions
REVOKE EXECUTE ON FUNCTION security.can_call(uuid, text, text, integer, integer) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION security.consume_nonce_once(text) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION security.cleanup_expired_nonces() FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION security.legacy_sig_first_seen(text) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION security.assert_caller_is(uuid) FROM PUBLIC, authenticated;

-- Conditionally revoke cleanup_legacy_signatures if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='security' AND p.proname='cleanup_legacy_signatures'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION security.cleanup_legacy_signatures(integer) FROM PUBLIC, authenticated';
  END IF;
END$$;

-- Grant only to service_role
GRANT EXECUTE ON FUNCTION security.can_call(uuid, text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION security.consume_nonce_once(text) TO service_role;
GRANT EXECUTE ON FUNCTION security.cleanup_expired_nonces() TO service_role;
GRANT EXECUTE ON FUNCTION security.legacy_sig_first_seen(text) TO service_role;
GRANT EXECUTE ON FUNCTION security.assert_caller_is(uuid) TO service_role;

-- Conditionally grant cleanup_legacy_signatures if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='security' AND p.proname='cleanup_legacy_signatures'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION security.cleanup_legacy_signatures(integer) TO service_role';
  END IF;
END$$;

-- Add security documentation
COMMENT ON SCHEMA security IS 
  'SECURITY CRITICAL: All functions in this schema should only be accessible via service_role. Never grant to PUBLIC or authenticated roles.';

COMMENT ON TABLE public.drive_items IS 
  'Google Drive items synced per user. RLS enforces owner-only access.';