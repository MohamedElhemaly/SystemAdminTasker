-- ==============================================================================
-- 🔒 CRITICAL BUG FIX: TEAM FOLDER DATA LEAK (HYBRID RLS POLICY)
-- ==============================================================================
-- This script fixes the data leak where team tasks were appearing in the Inbox
-- and Today views of non-team members. It explicitly defines the SELECT policies
-- using high-performance EXISTS subqueries.
-- ==============================================================================

-- 1. Drop existing 'Lists Access' and 'Tasks Access' policies (which were FOR ALL)
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('lists', 'tasks')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ==============================================================================
-- 2. NEW LISTS POLICIES
-- ==============================================================================

-- SELECT Policy for Lists
CREATE POLICY "Lists SELECT Access" ON public.lists FOR SELECT TO authenticated 
USING (
    public.is_manager()
    OR team_id IS NULL
    OR EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE team_members.team_id = public.lists.team_id 
        AND team_members.user_id = auth.uid()
    )
);

-- WRITE Policy for Lists (so you can still create/edit lists you have access to)
CREATE POLICY "Lists WRITE Access" ON public.lists FOR ALL TO authenticated 
USING (
    public.is_manager()
    OR team_id IS NULL
    OR EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE team_members.team_id = public.lists.team_id 
        AND team_members.user_id = auth.uid()
    )
);

-- ==============================================================================
-- 3. NEW TASKS POLICIES
-- ==============================================================================

-- SELECT Policy for Tasks
CREATE POLICY "Tasks SELECT Access" ON public.tasks FOR SELECT TO authenticated
USING (
    public.is_manager()
    OR list_id IS NULL
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

-- WRITE Policy for Tasks (so you can still create/edit tasks you have access to)
CREATE POLICY "Tasks WRITE Access" ON public.tasks FOR ALL TO authenticated
USING (
    public.is_manager()
    OR list_id IS NULL
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

-- 4. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
