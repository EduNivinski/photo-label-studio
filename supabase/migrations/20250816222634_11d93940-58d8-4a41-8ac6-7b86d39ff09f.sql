-- First, create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can create their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

-- Create function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  RETURN NEW;
END;
$$;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add trigger for updating timestamps
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add user_id column to photos table to associate photos with users (nullable first)
ALTER TABLE public.photos ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop the existing public policies for photos
DROP POLICY IF EXISTS "Photos are publicly deletable" ON public.photos;
DROP POLICY IF EXISTS "Photos are publicly insertable" ON public.photos;
DROP POLICY IF EXISTS "Photos are publicly readable" ON public.photos;
DROP POLICY IF EXISTS "Photos are publicly updatable" ON public.photos;

-- Create secure user-based policies for photos
CREATE POLICY "Users can view their own photos" 
ON public.photos 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can upload their own photos" 
ON public.photos 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own photos" 
ON public.photos 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own photos" 
ON public.photos 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Add user_id column to collections table (nullable first)
ALTER TABLE public.collections ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update collections policies
DROP POLICY IF EXISTS "Albums are publicly deletable" ON public.collections;
DROP POLICY IF EXISTS "Albums are publicly insertable" ON public.collections;
DROP POLICY IF EXISTS "Albums are publicly readable" ON public.collections;
DROP POLICY IF EXISTS "Albums are publicly updatable" ON public.collections;

CREATE POLICY "Users can view their own albums" 
ON public.collections 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own albums" 
ON public.collections 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own albums" 
ON public.collections 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own albums" 
ON public.collections 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Add user_id column to labels table (nullable first)
ALTER TABLE public.labels ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update labels policies
DROP POLICY IF EXISTS "Labels are publicly deletable" ON public.labels;
DROP POLICY IF EXISTS "Labels are publicly insertable" ON public.labels;
DROP POLICY IF EXISTS "Labels are publicly readable" ON public.labels;
DROP POLICY IF EXISTS "Labels are publicly updatable" ON public.labels;

CREATE POLICY "Users can view their own labels" 
ON public.labels 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own labels" 
ON public.labels 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own labels" 
ON public.labels 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own labels" 
ON public.labels 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);