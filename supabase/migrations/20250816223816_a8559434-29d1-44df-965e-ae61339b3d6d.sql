-- Critical Security Fixes
-- Phase 1: Make user_id columns NOT NULL to prevent data isolation issues

-- First, ensure all existing records have user_id set (already done in previous migration)
-- Now make the columns NOT NULL to prevent future orphaned records

ALTER TABLE public.photos 
ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.labels 
ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.collections 
ALTER COLUMN user_id SET NOT NULL;

-- Phase 2: Add missing DELETE policy for profiles table
CREATE POLICY "Users can delete their own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = id);

-- Phase 3: Fix database function security vulnerabilities
-- Update the handle_new_user function to be more secure
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public';

-- Update the update_updated_at_column function to be more secure
DROP FUNCTION IF EXISTS public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public';