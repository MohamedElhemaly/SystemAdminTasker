-- 1. Create a debug table to catch exact errors
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id SERIAL PRIMARY KEY,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Make sure the table columns definitely exist and are correct types
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
        CREATE TYPE user_role_enum AS ENUM ('manager', 'sub_manager', 'deputy_manager', 'member');
    END IF;
END $$;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS avatar_id TEXT DEFAULT 'avatar-1',
  ADD COLUMN IF NOT EXISTS role user_role_enum DEFAULT 'member';

-- 3. Replace the trigger with a bulletproof version that logs errors
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_role user_role_enum;
    v_avatar TEXT;
    v_name TEXT;
BEGIN
    -- Safely extract values with fallbacks
    BEGIN
        v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1), 'Unknown');
        v_avatar := COALESCE(NEW.raw_user_meta_data->>'avatar_id', 'avatar-1');
        
        IF NEW.raw_user_meta_data->>'role' IS NOT NULL AND NEW.raw_user_meta_data->>'role' != '' THEN
            v_role := (NEW.raw_user_meta_data->>'role')::user_role_enum;
        ELSE
            v_role := 'member'::user_role_enum;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_name := SPLIT_PART(NEW.email, '@', 1);
        v_avatar := 'avatar-1';
        v_role := 'member'::user_role_enum;
    END;

    -- Attempt to insert the profile
    BEGIN
        INSERT INTO public.profiles (id, email, full_name, avatar_id, role)
        VALUES (NEW.id, NEW.email, v_name, v_avatar, v_role)
        ON CONFLICT (id) DO UPDATE 
        SET email = EXCLUDED.email, 
            full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
    EXCEPTION WHEN OTHERS THEN
        -- If insert fails, log the exact postgres error message
        INSERT INTO public.debug_logs (error_message) VALUES (SQLERRM);
        
        -- Fallback: insert the absolute bare minimum profile to prevent signup failure
        INSERT INTO public.profiles (id, email)
        VALUES (NEW.id, NEW.email)
        ON CONFLICT (id) DO NOTHING;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Clean up any other rogue triggers on auth.users that might be causing conflicts
-- (It's common for older templates to have a trigger named differently)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_user_created ON auth.users;
DROP TRIGGER IF EXISTS create_profile_on_signup ON auth.users;
DROP TRIGGER IF EXISTS trigger_handle_new_user ON auth.users;

-- 5. Attach the clean trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
