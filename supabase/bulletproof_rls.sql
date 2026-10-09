-- ==============================================================================
-- 🔒 BULLETPROOF RLS PATCH
-- ==============================================================================
-- This script safely drops any potentially conflicting policies and recreates
-- the absolute simplest, most robust rules for Lists and Tasks without relying 
-- on any external functions that might cause silent evaluation errors.
-- ==============================================================================

DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('lists', 'tasks', 'teams', 'team_members')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 1. TEAMS & TEAM MEMBERS DIRECTORY (100% Transparent Read)
CREATE POLICY "Teams SELECT Transparency" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teams WRITE Access" ON public.teams FOR ALL TO authenticated 
USING (
    created_by = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
);

CREATE POLICY "Team Members SELECT Transparency" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team Members WRITE Access" ON public.team_members FOR ALL TO authenticated 
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
    OR team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
);

-- 2. LISTS ACCESS (Read & Write)
CREATE POLICY "Lists Access" ON public.lists FOR ALL TO authenticated 
USING (
    team_id IS NULL
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
    OR EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE team_members.team_id = public.lists.team_id 
        AND team_members.user_id = auth.uid()
    )
);

-- 3. TASKS ACCESS (Read & Write)
CREATE POLICY "Tasks Access" ON public.tasks FOR ALL TO authenticated
USING (
    list_id IS NULL
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
    OR EXISTS (
        SELECT 1 FROM public.lists
        WHERE lists.id = public.tasks.list_id
        AND (
            lists.team_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.team_members
                WHERE team_members.team_id = lists.team_id
                AND team_members.user_id = auth.uid()
            )
        )
    )
);

NOTIFY pgrst, 'reload schema';
