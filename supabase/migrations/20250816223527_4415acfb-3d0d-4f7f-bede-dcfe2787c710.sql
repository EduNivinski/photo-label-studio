-- Find the user ID for eduardonivinski@gmail.com and update all orphaned records
DO $$
DECLARE
    admin_user_id UUID;
    photos_updated INTEGER;
    collections_updated INTEGER;
    labels_updated INTEGER;
BEGIN
    -- Get the user ID for the admin email
    SELECT id INTO admin_user_id 
    FROM auth.users 
    WHERE email = 'eduardonivinski@gmail.com' 
    LIMIT 1;
    
    -- Check if user exists
    IF admin_user_id IS NOT NULL THEN
        -- Update all photos without user_id to belong to admin
        UPDATE public.photos 
        SET user_id = admin_user_id 
        WHERE user_id IS NULL;
        GET DIAGNOSTICS photos_updated = ROW_COUNT;
        
        -- Update all collections without user_id to belong to admin
        UPDATE public.collections 
        SET user_id = admin_user_id 
        WHERE user_id IS NULL;
        GET DIAGNOSTICS collections_updated = ROW_COUNT;
        
        -- Update all labels without user_id to belong to admin
        UPDATE public.labels 
        SET user_id = admin_user_id 
        WHERE user_id IS NULL;
        GET DIAGNOSTICS labels_updated = ROW_COUNT;
        
        RAISE NOTICE 'Successfully assigned % photos, % collections, % labels to user: %', 
                     photos_updated, collections_updated, labels_updated, admin_user_id;
    ELSE
        RAISE NOTICE 'User with email eduardonivinski@gmail.com not found.';
    END IF;
END $$;