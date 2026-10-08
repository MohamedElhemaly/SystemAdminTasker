-- ==========================================================
-- FIX TASK AND LIST INSERT/UPDATE/DELETE POLICIES
-- ==========================================================
-- In the previous step, dropping "Tasks Scoped Access" (which was a FOR ALL policy)
-- accidentally removed the INSERT, UPDATE, and DELETE policies.
-- We are recreating them here.

-- 1. Tasks Modifications (INSERT / UPDATE / DELETE)
CREATE POLICY "Tasks Insert" ON public.tasks FOR INSERT TO authenticated
WITH CHECK (
    created_by = auth.uid()
);

CREATE POLICY "Tasks Update" ON public.tasks FOR UPDATE TO authenticated
USING (
    created_by = auth.uid() 
    OR assigned_to = auth.uid()
    OR public.get_auth_user_role() = 'manager'
    OR list_id IN (SELECT id FROM public.lists WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);

CREATE POLICY "Tasks Delete" ON public.tasks FOR DELETE TO authenticated
USING (
    created_by = auth.uid() 
    OR public.get_auth_user_role() = 'manager'
);

-- 2. Lists Modifications (INSERT / UPDATE / DELETE)
CREATE POLICY "Lists Insert" ON public.lists FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid()
);

CREATE POLICY "Lists Update" ON public.lists FOR UPDATE TO authenticated
USING (
    user_id = auth.uid() 
    OR public.get_auth_user_role() = 'manager'
    OR team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);

CREATE POLICY "Lists Delete" ON public.lists FOR DELETE TO authenticated
USING (
    user_id = auth.uid() 
    OR public.get_auth_user_role() = 'manager'
);
