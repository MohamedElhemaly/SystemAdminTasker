-- ==========================================================
-- CRITICAL BUG FIX: GLOBAL READ ACCESS FOR ALL ROLES
-- ==========================================================

-- 1. Drop existing restrictive SELECT policies for tasks
DROP POLICY IF EXISTS "Hybrid Task Visibility" ON public.tasks;
DROP POLICY IF EXISTS "Transparent Team Tasks Read" ON public.tasks;
DROP POLICY IF EXISTS "Tasks RBAC SELECT Policy" ON public.tasks;

-- 2. Drop existing restrictive SELECT policies for lists
DROP POLICY IF EXISTS "Hybrid List Visibility" ON public.lists;
DROP POLICY IF EXISTS "Transparent Team Lists Read" ON public.lists;
DROP POLICY IF EXISTS "Lists SELECT Policy" ON public.lists;

-- 3. Create unrestricted SELECT policy for tasks
-- This ensures ALL authenticated users can see ALL tasks across the system
CREATE POLICY "Global Read Access Tasks" ON public.tasks
    FOR SELECT TO authenticated USING (true);

-- 4. Create unrestricted SELECT policy for lists
-- This ensures ALL authenticated users can see ALL lists across the system
CREATE POLICY "Global Read Access Lists" ON public.lists
    FOR SELECT TO authenticated USING (true);

-- Note: INSERT, UPDATE, and DELETE policies remain strictly role-based and untouched.
