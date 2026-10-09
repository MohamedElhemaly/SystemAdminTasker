-- ==============================================================================
-- 🔒 HYBRID TRANSPARENCY & TEAM ISOLATION
-- ==============================================================================
-- This script gives you the exact setup you asked for:
-- 1. Everyone can see and interact with all standard tasks in the company (Inbox, etc).
-- 2. But if a task or folder belongs to a Team (like the SystemAdmin Workspace),
--    ONLY members of that team can see it or interact with it.
-- ==============================================================================

-- 1. Function to safely get a user's teams
CREATE OR REPLACE FUNCTION public.get_user_team_ids()
RETURNS SETOF uuid AS $$
BEGIN
  RETURN QUERY SELECT team_id FROM public.team_members WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop all previous policies to start fresh
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('teams', 'team_members', 'lists', 'tasks')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 3. Teams & Members (Only visible to members or creators)
CREATE POLICY "Teams Read" ON public.teams FOR SELECT TO authenticated 
USING (created_by = auth.uid() OR id IN (SELECT public.get_user_team_ids()));

CREATE POLICY "Teams Write" ON public.teams FOR ALL TO authenticated 
USING (created_by = auth.uid());

CREATE POLICY "Team Members Read" ON public.team_members FOR SELECT TO authenticated 
USING (team_id IN (SELECT public.get_user_team_ids()) OR user_id = auth.uid());

CREATE POLICY "Team Members Write" ON public.team_members FOR ALL TO authenticated 
USING (public.is_manager() OR team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid()));

-- 4. Lists (Hybrid Transparency)
-- Visible if it's NOT a team folder, OR if you are in the team.
CREATE POLICY "Lists Access" ON public.lists FOR ALL TO authenticated 
USING (
    team_id IS NULL 
    OR team_id IN (SELECT public.get_user_team_ids())
);

-- 5. Tasks (Hybrid Transparency)
-- Visible if the task is NOT in a team folder, OR if you are in the team.
CREATE POLICY "Tasks Access" ON public.tasks FOR ALL TO authenticated
USING (
    -- If the task has no list (e.g. Inbox), everyone sees it
    list_id IS NULL 
    -- Or if it's in a smart list or string-based ID
    OR list_id NOT IN (SELECT id FROM public.lists WHERE team_id IS NOT NULL)
    -- Or if it IS in a team folder, you must be in the team
    OR list_id IN (
        SELECT id FROM public.lists WHERE team_id IN (SELECT public.get_user_team_ids())
    )
);

-- 6. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
