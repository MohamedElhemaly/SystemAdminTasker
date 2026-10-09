-- ==============================================================================
-- 🔒 AUTO-FIX DUPLICATE TEAMS MAPPING
-- ==============================================================================
-- Because you have TWO "SystemAdmin" teams, the tasks were placed in Team A's folder
-- but the members were added to Team B.
-- This script forcefully adds all your users to ALL your teams so they can 
-- finally see the correct folder that actually contains the tasks!
-- ==============================================================================

DO $$
DECLARE
    team_rec record;
    user_rec record;
BEGIN
    -- Loop through every team
    FOR team_rec IN SELECT id FROM public.teams LOOP
        -- Loop through every user
        FOR user_rec IN SELECT id FROM public.profiles LOOP
            -- Insert every user into every team as a member (ignoring duplicates)
            INSERT INTO public.team_members (team_id, user_id, role)
            VALUES (team_rec.id, user_rec.id, 'member')
            ON CONFLICT (team_id, user_id) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;
