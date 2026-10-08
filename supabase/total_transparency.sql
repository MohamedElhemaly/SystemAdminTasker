-- ==========================================================
-- TOTAL TRANSPARENCY: EVERYONE SEES EVERYTHING
-- ==========================================================
-- This script guarantees that ALL users can read ALL tasks and lists,
-- while keeping the write/edit rules secure.

-- 1. NUKE ALL EXISTING POLICIES on tasks and lists to prevent conflicts
DO $$ DECLARE
    pol record;
BEGIN
    -- Delete all policies on tasks
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tasks' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.tasks', pol.policyname);
    END LOOP;
    
    -- Delete all policies on lists
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lists' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.lists', pol.policyname);
    END LOOP;
END $$;

-- ==========================================
-- 2. TASKS POLICIES
-- ==========================================

-- SELECT: Total Transparency (Everyone sees all tasks)
CREATE POLICY "Tasks Select" ON public.tasks FOR SELECT TO authenticated
USING (true);

-- INSERT: Anyone can insert their own tasks
CREATE POLICY "Tasks Insert" ON public.tasks FOR INSERT TO authenticated
WITH CHECK (
    created_by = auth.uid() OR public.get_auth_user_role() = 'manager'
);

-- UPDATE: Creator, Assignee, Manager, or Team Member can update
CREATE POLICY "Tasks Update" ON public.tasks FOR UPDATE TO authenticated
USING (
    created_by = auth.uid() OR 
    assigned_to = auth.uid() OR 
    public.get_auth_user_role() = 'manager' OR
    EXISTS (
        SELECT 1 FROM public.team_members tm 
        WHERE (tm.team_id = public.tasks.team_id OR tm.team_id = (SELECT l.team_id FROM public.lists l WHERE l.id = list_id))
          AND tm.user_id = auth.uid()
    )
);

-- DELETE: Creator or Manager can delete
CREATE POLICY "Tasks Delete" ON public.tasks FOR DELETE TO authenticated
USING (
    created_by = auth.uid() OR public.get_auth_user_role() = 'manager'
);

-- ==========================================
-- 3. LISTS POLICIES
-- ==========================================

-- SELECT: Total Transparency (Everyone sees all lists)
CREATE POLICY "Lists Select" ON public.lists FOR SELECT TO authenticated
USING (true);

-- INSERT: Anyone can insert their own lists
CREATE POLICY "Lists Insert" ON public.lists FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid() OR public.get_auth_user_role() = 'manager'
);

-- UPDATE: Creator, Manager, or Team Member can update
CREATE POLICY "Lists Update" ON public.lists FOR UPDATE TO authenticated
USING (
    user_id = auth.uid() OR 
    public.get_auth_user_role() = 'manager' OR
    EXISTS (
        SELECT 1 FROM public.team_members tm 
        WHERE tm.team_id = public.lists.team_id 
          AND tm.user_id = auth.uid()
    )
);

-- DELETE: Creator or Manager can delete
CREATE POLICY "Lists Delete" ON public.lists FOR DELETE TO authenticated
USING (
    user_id = auth.uid() OR public.get_auth_user_role() = 'manager'
);
