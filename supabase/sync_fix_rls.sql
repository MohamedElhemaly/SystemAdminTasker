-- ==============================================================================
-- 🔒 CRITICAL FIX: REAL-TIME SYNC & BULLETPROOF HYBRID RLS
-- ==============================================================================
-- This script safely enables Real-time broadcasts for the necessary tables
-- so the frontend instantly syncs. It also establishes the absolute bulletproof
-- SELECT RLS policies you requested.
-- ==============================================================================

-- 1. ENABLE SUPABASE REALTIME (Crucial for instant Frontend Sync)
-- This ensures the React app receives websocket events when members are added
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;

-- 2. DROP EXISTING LISTS & TASKS POLICIES
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
-- 3. BULLETPROOF SELECT POLICIES
-- ==============================================================================

-- LISTS SELECT Access
CREATE POLICY "Lists SELECT Access" ON public.lists FOR SELECT TO authenticated 
USING (
    team_id IS NULL 
    OR EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE team_members.team_id = public.lists.team_id 
        AND team_members.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'manager'
    )
);

-- TASKS SELECT Access
CREATE POLICY "Tasks SELECT Access" ON public.tasks FOR SELECT TO authenticated
USING (
    list_id IS NULL
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
    OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'manager'
    )
);

-- ==============================================================================
-- 4. BULLETPROOF WRITE POLICIES (Required so you can still add/edit)
-- ==============================================================================

CREATE POLICY "Lists WRITE Access" ON public.lists FOR ALL TO authenticated 
USING (
    team_id IS NULL 
    OR EXISTS (SELECT 1 FROM public.team_members WHERE team_members.team_id = public.lists.team_id AND team_members.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
);

CREATE POLICY "Tasks WRITE Access" ON public.tasks FOR ALL TO authenticated
USING (
    list_id IS NULL
    OR EXISTS (
        SELECT 1 FROM public.lists WHERE lists.id = public.tasks.list_id AND (
            lists.team_id IS NULL OR EXISTS (SELECT 1 FROM public.team_members WHERE team_members.team_id = lists.team_id AND team_members.user_id = auth.uid())
        )
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
);

-- Force PostgREST to reload the schema and policies
NOTIFY pgrst, 'reload schema';
