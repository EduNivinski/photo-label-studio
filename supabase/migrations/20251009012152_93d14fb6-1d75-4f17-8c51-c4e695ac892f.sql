-- ============================================
-- CRITICAL SECURITY FIX: RLS + Grants (v2)
-- ============================================

-- 1) Fix drive_items RLS (owner-only policies)
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE public.drive_items ENABLE ROW LEVEL SECURITY;

-- Remove blocking "deny all" policy if exists
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

-- Drop existing policies to ensure clean state
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

-- 2) Restrict security.* function grants (service_role only)
-- ============================================
-- Only revoke/grant functions that actually exist

DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- Loop through all functions in security schema
  FOR func_record IN 
    SELECT 
      p.proname,
      pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'security'
  LOOP
    -- Revoke from PUBLIC and authenticated
    EXECUTE format('REVOKE EXECUTE ON FUNCTION security.%I(%s) FROM PUBLIC, authenticated', 
                   func_record.proname, func_record.args);
    
    -- Grant to service_role
    EXECUTE format('GRANT EXECUTE ON FUNCTION security.%I(%s) TO service_role', 
                   func_record.proname, func_record.args);
                   
    RAISE NOTICE 'Secured function: security.%(%)', func_record.proname, func_record.args;
  END LOOP;
END$$;