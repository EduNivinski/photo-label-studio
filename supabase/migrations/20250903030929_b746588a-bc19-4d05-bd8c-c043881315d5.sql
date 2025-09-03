-- Update existing video files that are incorrectly marked as photos
UPDATE public.photos 
SET media_type = 'video' 
WHERE url LIKE '%.mp4' 
   OR url LIKE '%.mov' 
   OR url LIKE '%.avi' 
   OR url LIKE '%.webm' 
   OR url LIKE '%.mkv'
   OR url LIKE '%.flv';