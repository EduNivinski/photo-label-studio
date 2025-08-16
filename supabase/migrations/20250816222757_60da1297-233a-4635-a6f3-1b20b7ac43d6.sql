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