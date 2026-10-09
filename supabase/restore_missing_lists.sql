-- ==============================================================================
-- 🔒 FIX: RESTORE MISSING TEAM FOLDERS
-- ==============================================================================
-- If your Team Folders failed to create due to the earlier database bugs, 
-- they physically do not exist in the database.
-- This script safely generates the missing Workspace Folders for any team 
-- that currently lacks one.
-- ==============================================================================

DO $$
DECLARE
    team_rec record;
BEGIN
    FOR team_rec IN 
        SELECT t.id, t.name, t.created_by 
        FROM public.teams t
        WHERE NOT EXISTS (
            SELECT 1 FROM public.lists l WHERE l.team_id = t.id
        )
    LOOP
        INSERT INTO public.lists (
            id, 
            name, 
            color, 
            icon, 
            user_id, 
            team_id
        ) VALUES (
            gen_random_uuid(),
            '🚀 ' || team_rec.name || ' Workspace',
            '#ec4899',
            'users',
            team_rec.created_by,
            team_rec.id
        );
    END LOOP;
END $$;
