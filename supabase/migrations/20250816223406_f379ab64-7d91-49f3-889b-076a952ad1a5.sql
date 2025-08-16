-- Find the user ID for eduardonivinski@gmail.com and update all orphaned records
DO $$
DECLARE
    admin_user_id UUID;
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
        
        -- Update all collections without user_id to belong to admin
        UPDATE public.collections 
        SET user_id = admin_user_id 
        WHERE user_id IS NULL;
        
        -- Update all labels without user_id to belong to admin
        UPDATE public.labels 
        SET user_id = admin_user_id 
        WHERE user_id IS NULL;
        
        RAISE NOTICE 'Successfully assigned orphaned records to user: %', admin_user_id;
    ELSE
        RAISE NOTICE 'User with email eduardonivinski@gmail.com not found. Please create the account first.';
    END IF;
END $$;