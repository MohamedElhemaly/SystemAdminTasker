-- =========================================================================
-- TASK CHECKLISTS / SUBTASKS SCHEMA WITH PROGRESS TRACKING & RBAC
-- =========================================================================

-- Ensure 'admin' role exists in enum if applicable
DO $$
BEGIN
    ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;

-- 1. Create public.task_checklists table
CREATE TABLE IF NOT EXISTS public.task_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for high-performance retrieval and sorting
CREATE INDEX IF NOT EXISTS idx_task_checklists_task_id ON public.task_checklists(task_id);
CREATE INDEX IF NOT EXISTS idx_task_checklists_order ON public.task_checklists(task_id, order_index, created_at);

-- 2. Idempotently migrate existing subtasks records into task_checklists if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subtasks') THEN
        INSERT INTO public.task_checklists (id, task_id, title, is_completed, created_at)
        SELECT id, task_id, title, COALESCE(is_completed, FALSE), COALESCE(created_at, NOW())
        FROM public.subtasks
        ON CONFLICT (id) DO NOTHING;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;

-- Transparent read access for team visibility
DROP POLICY IF EXISTS "task_checklists_select_policy" ON public.task_checklists;
CREATE POLICY "task_checklists_select_policy"
ON public.task_checklists
FOR SELECT
TO authenticated
USING (true);

-- Managers / Sub-Managers / Admins can INSERT checklist items
DROP POLICY IF EXISTS "task_checklists_insert_policy" ON public.task_checklists;
CREATE POLICY "task_checklists_insert_policy"
ON public.task_checklists
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role::text IN ('manager', 'sub_manager', 'deputy_manager', 'admin')
    )
);

-- Managers / Sub-Managers can UPDATE everything.
-- Members assigned to the parent task can UPDATE (checked box).
DROP POLICY IF EXISTS "task_checklists_update_policy" ON public.task_checklists;
CREATE POLICY "task_checklists_update_policy"
ON public.task_checklists
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role::text IN ('manager', 'sub_manager', 'deputy_manager', 'admin')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = task_checklists.task_id
          AND (
              t.assigned_to = auth.uid()
              OR (t.assigned_users IS NOT NULL AND auth.uid() = ANY(t.assigned_users))
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role::text IN ('manager', 'sub_manager', 'deputy_manager', 'admin')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = task_checklists.task_id
          AND (
              t.assigned_to = auth.uid()
              OR (t.assigned_users IS NOT NULL AND auth.uid() = ANY(t.assigned_users))
          )
    )
);

-- Managers / Sub-Managers / Admins can DELETE checklist items
DROP POLICY IF EXISTS "task_checklists_delete_policy" ON public.task_checklists;
CREATE POLICY "task_checklists_delete_policy"
ON public.task_checklists
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role::text IN ('manager', 'sub_manager', 'deputy_manager', 'admin')
    )
);

-- 4. Trigger: Prevent members from modifying title, task_id, or order_index
CREATE OR REPLACE FUNCTION public.fn_enforce_checklist_member_restrictions()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_role TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT role::text INTO v_user_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_user_role IS NULL THEN
        v_user_role := 'member';
    END IF;

    -- Strict Governance: Members can only toggle is_completed!
    IF v_user_role = 'member' THEN
        IF (NEW.title IS DISTINCT FROM OLD.title) OR
           (NEW.task_id IS DISTINCT FROM OLD.task_id) OR
           (NEW.order_index IS DISTINCT FROM OLD.order_index) OR
           (NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
            RAISE EXCEPTION 'Security Policy: Members can only toggle checklist completion and cannot edit checklist titles.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_checklist_member_restrictions ON public.task_checklists;
CREATE TRIGGER trg_enforce_checklist_member_restrictions
BEFORE UPDATE ON public.task_checklists
FOR EACH ROW
EXECUTE FUNCTION public.fn_enforce_checklist_member_restrictions();

-- 5. Realtime Publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'task_checklists'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.task_checklists;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.task_checklists REPLICA IDENTITY FULL;

-- 6. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
