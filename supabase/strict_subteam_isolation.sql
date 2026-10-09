-- ==============================================================================
-- 🔒 STRICT SUB-TEAM ISOLATION RLS PATCH (FIXED FOR RECURSION)
-- ==============================================================================
-- This script fixes the infinite recursion bug while maintaining 100% strict 
-- sub-team separation in the company!
-- ==============================================================================

-- 1. Create a Security Definer function to bypass RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_team_ids()
RETURNS SETOF uuid AS $$
BEGIN
  -- Runs as DB owner, bypassing RLS to prevent infinite recursion
  RETURN QUERY SELECT team_id FROM public.team_members WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing broken policies
DROP POLICY IF EXISTS "Teams Write" ON public.teams;
DROP POLICY IF EXISTS "Teams Read" ON public.teams;
DROP POLICY IF EXISTS "Team Members Read" ON public.team_members;
DROP POLICY IF EXISTS "Team Members Write" ON public.team_members;
DROP POLICY IF EXISTS "Lists Scoped Access" ON public.lists;
DROP POLICY IF EXISTS "Tasks Scoped Access" ON public.tasks;

-- 3. Teams (Strict Isolation)
CREATE POLICY "Teams Read" ON public.teams FOR SELECT TO authenticated 
USING (
    created_by = auth.uid() 
    OR id IN (SELECT public.get_user_team_ids())
);

CREATE POLICY "Teams Write" ON public.teams FOR ALL TO authenticated 
USING (created_by = auth.uid());

-- 4. Team Members (Strict Isolation)
CREATE POLICY "Team Members Read" ON public.team_members FOR SELECT TO authenticated 
USING (
    team_id IN (SELECT public.get_user_team_ids())
    OR user_id = auth.uid()
);

-- Only managers or the team creator can manage members
CREATE POLICY "Team Members Write" ON public.team_members FOR ALL TO authenticated 
USING (
    public.is_manager() 
    OR team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
);

-- 5. Lists / Folders (Strict Sub-Team Separation)
-- Managers must be in the team to see the folder.
CREATE POLICY "Lists Scoped Access" ON public.lists FOR ALL TO authenticated 
USING (
    user_id = auth.uid() 
    OR team_id IN (SELECT public.get_user_team_ids())
);

-- 6. Tasks (Strict Sub-Team Separation)
-- Tasks in a team list are completely invisible to non-members.
CREATE POLICY "Tasks Scoped Access" ON public.tasks FOR ALL TO authenticated
USING (
    created_by = auth.uid() 
    OR assigned_to = auth.uid()
    OR (
        list_id IN (
            SELECT id FROM public.lists WHERE team_id IN (
                SELECT public.get_user_team_ids()
            )
        )
    )
);

-- 7. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
