-- ==========================================================
-- PHASE 1: TRANSPARENT TEAM, CASCADE DELETE & RPC
-- ==========================================================

-- 1. Drop old SELECT RLS policies (from schema.sql and secure_rls.sql)
DROP POLICY IF EXISTS "Tasks RBAC SELECT Policy" ON public.tasks;
DROP POLICY IF EXISTS "Lists SELECT Policy" ON public.lists;
DROP POLICY IF EXISTS "Task Ack SELECT" ON public.task_acknowledgements;
DROP POLICY IF EXISTS "Task Attachments SELECT Policy" ON public.task_attachments;

-- If secure_rls.sql "FOR ALL" policies exist, they will safely OR with the new SELECT policies below.
-- We do not drop the "FOR ALL" policies here as that would destroy INSERT/UPDATE/DELETE access.

-- 2. Create new Transparent Team SELECT policies (Everyone can read)
CREATE POLICY "Transparent Team Tasks Read" ON public.tasks
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Transparent Team Lists Read" ON public.lists
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Transparent Team Ack Read" ON public.task_acknowledgements
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Transparent Team Attachments Read" ON public.task_attachments
    FOR SELECT TO authenticated USING (true);

-- 3. Alter Profiles Foreign Key to ON DELETE CASCADE
-- We first drop the existing constraint. We assume the standard constraint name generated is profiles_id_fkey.
ALTER TABLE public.profiles 
    DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Create RPC for Secure Account Deletion
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id UUID)
RETURNS void AS $$
DECLARE
    v_role text;
BEGIN
    -- Get the role of the caller
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

    -- Ensure caller is either deleting themselves, or is a manager
    IF auth.uid() != target_user_id AND COALESCE(v_role, '') != 'manager' THEN
        RAISE EXCEPTION 'Unauthorized to delete user account';
    END IF;

    -- Delete from auth.users (this requires SECURITY DEFINER to bypass auth schema restrictions)
    -- Because of the ON DELETE CASCADE on profiles, this will cascade downwards.
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
