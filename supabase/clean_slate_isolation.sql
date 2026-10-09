-- ==============================================================================
-- 🔒 ABSOLUTE STRICT SUB-TEAM ISOLATION (CLEAN SLATE)
-- ==============================================================================
-- This script completely wipes all existing security policies that might be 
-- secretly granting broad access (like "total transparency" scripts), and 
-- strictly locks down the tables once and for all.
-- ==============================================================================

-- 1. Create a Security Definer function to bypass RLS recursion safely
CREATE OR REPLACE FUNCTION public.get_user_team_ids()
RETURNS SETOF uuid AS $$
BEGIN
  RETURN QUERY SELECT team_id FROM public.team_members WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Dynamically obliterate ALL existing policies on the targeted tables
--    to guarantee no rogue "transparency" policies are keeping data visible!
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

CREATE POLICY "Team Members Write" ON public.team_members FOR ALL TO authenticated 
USING (
    public.is_manager() 
    OR team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
);

-- 5. Lists / Folders (Absolute Strict Isolation)
-- You MUST be the creator OR in the team. No exceptions.
CREATE POLICY "Lists Scoped Access" ON public.lists FOR ALL TO authenticated 
USING (
    user_id = auth.uid() 
    OR team_id IN (SELECT public.get_user_team_ids())
);

-- 6. Tasks (Absolute Strict Isolation)
-- You MUST be the creator, assignee, OR in the list's team. No exceptions.
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
