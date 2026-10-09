-- ==============================================================================
-- 🔒 FIX: MAKE TEAMS & TEAM MEMBERS DIRECTORY VISIBLE
-- ==============================================================================
-- To allow Managers and users to see who is in a team (and render the UI properly),
-- the 'teams' and 'team_members' tables must be visible to everyone.
-- The actual private data (Folders and Tasks) is strictly protected by the 
-- Lists and Tasks RLS policies.
-- ==============================================================================

-- 1. Drop the restrictive Read policies
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('teams', 'team_members')
        AND cmd = 'SELECT'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 2. Create Transparent Read Policies for Directory Purposes
CREATE POLICY "Teams SELECT Transparency" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team Members SELECT Transparency" ON public.team_members FOR SELECT TO authenticated USING (true);

-- 3. Ensure Write policies allow managers and creators to manage teams
DROP POLICY IF EXISTS "Teams Write" ON public.teams;
CREATE POLICY "Teams WRITE Access" ON public.teams FOR ALL TO authenticated 
USING (created_by = auth.uid() OR public.is_manager());

DROP POLICY IF EXISTS "Team Members Write" ON public.team_members;
CREATE POLICY "Team Members WRITE Access" ON public.team_members FOR ALL TO authenticated 
USING (
    public.is_manager() 
    OR team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
);

-- 4. Refresh Cache
NOTIFY pgrst, 'reload schema';
