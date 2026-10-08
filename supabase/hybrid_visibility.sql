-- ==========================================================
-- FEATURE UPDATE: HYBRID TASK VISIBILITY
-- Public by Default, Private to Teams
-- ==========================================================

-- 0. Ensure team_id exists on tasks (if it doesn't already)
-- The user prompt referenced `team_id IS NULL` on tasks, so we ensure the column is present.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NULL;

-- 1. Drop existing SELECT policies for tasks and lists
DROP POLICY IF EXISTS "Transparent Team Tasks Read" ON public.tasks;
DROP POLICY IF EXISTS "Transparent Team Lists Read" ON public.lists;
DROP POLICY IF EXISTS "Tasks RBAC SELECT Policy" ON public.tasks;
DROP POLICY IF EXISTS "Lists SELECT Policy" ON public.lists;
DROP POLICY IF EXISTS "Tasks Scoped Access" ON public.tasks;
DROP POLICY IF EXISTS "Lists Scoped Access" ON public.lists;

-- 2. Create Hybrid SELECT Policy for tasks
CREATE POLICY "Hybrid Task Visibility" ON public.tasks
    FOR SELECT TO authenticated USING (
        -- Manager Override
        public.get_auth_user_role() = 'manager' OR
        
        -- Task Creator or Assignee
        created_by = auth.uid() OR
        assigned_to = auth.uid() OR
        
        -- Public Task (Both the task's direct team_id and its list's team_id must be NULL)
        (
            team_id IS NULL AND 
            COALESCE((SELECT l.team_id FROM public.lists l WHERE l.id = list_id), NULL) IS NULL
        ) OR
        
        -- Team-Private Task (User is in the team associated with the task OR its list)
        EXISTS (
            SELECT 1 FROM public.team_members tm 
            WHERE (tm.team_id = public.tasks.team_id OR tm.team_id = (SELECT l.team_id FROM public.lists l WHERE l.id = list_id))
              AND tm.user_id = auth.uid()
        )
    );

-- 3. Create Hybrid SELECT Policy for lists
CREATE POLICY "Hybrid List Visibility" ON public.lists
    FOR SELECT TO authenticated USING (
        -- Manager Override
        public.get_auth_user_role() = 'manager' OR
        
        -- List Creator
        user_id = auth.uid() OR
        
        -- Public List
        team_id IS NULL OR
        
        -- Team-Private List
        EXISTS (
            SELECT 1 FROM public.team_members tm 
            WHERE tm.team_id = public.lists.team_id 
              AND tm.user_id = auth.uid()
        )
    );
