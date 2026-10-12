-- ==============================================================================
-- FIX: INFINITE RECURSION IN POLICY FOR RELATION "tasks"
-- ==============================================================================
-- Root Cause:
-- Circular dependencies between RLS policies:
-- 1. "Tasks Unified Select Policy" queried public.task_acknowledgements & public.lists.
-- 2. "Lists Assignee Read Access" queried public.tasks.
-- 3. "Task Ack Select" queried public.tasks.
-- 4. Trigger "trigger_sync_assigned_users_acks" was BEFORE INSERT on tasks, inserting
--    into task_acknowledgements before the parent task existed.
--
-- This script completely breaks the recursion cycles and establishes clean,
-- lightning-fast, and watertight policies.
-- ==============================================================================

-- 1. Ensure columns exist on public.tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS assigned_users UUID[] DEFAULT '{}'::uuid[],
ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_users 
ON public.tasks USING GIN(assigned_users);

-- 2. Helper: Check list/team access without querying tasks
CREATE OR REPLACE FUNCTION public.check_user_has_list_access(p_list_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT CASE 
        WHEN p_list_id IS NULL THEN TRUE -- Unassigned / Inbox tasks accessible to creator/assignee
        ELSE EXISTS (
            SELECT 1 FROM public.lists l
            WHERE l.id = p_list_id AND (
                l.user_id = p_user_id OR 
                (l.team_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.team_members tm 
                    WHERE tm.team_id = l.team_id AND tm.user_id = p_user_id
                ))
            )
        )
    END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_has_list_access(UUID, UUID) TO authenticated, anon;

-- 3. Fix Sync Triggers: MUST be AFTER INSERT so the task ID exists in public.tasks
CREATE OR REPLACE FUNCTION public.fn_sync_primary_assignee()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.assigned_users IS NOT NULL AND array_length(NEW.assigned_users, 1) > 0 THEN
        NEW.assigned_to := NEW.assigned_users[1];
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_primary_assignee ON public.tasks;
CREATE TRIGGER trigger_sync_primary_assignee
    BEFORE INSERT OR UPDATE OF assigned_users ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_primary_assignee();

CREATE OR REPLACE FUNCTION public.fn_sync_assigned_users_to_acknowledgements()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_uid UUID;
BEGIN
    -- Synchronize assigned_users array to task_acknowledgements
    IF NEW.assigned_users IS NOT NULL AND array_length(NEW.assigned_users, 1) > 0 THEN
        FOREACH v_uid IN ARRAY NEW.assigned_users LOOP
            IF v_uid IS NOT NULL THEN
                INSERT INTO public.task_acknowledgements (
                    task_id,
                    user_id,
                    is_acknowledged
                ) VALUES (
                    NEW.id,
                    v_uid,
                    FALSE
                )
                ON CONFLICT (task_id, user_id) DO NOTHING;
            END IF;
        END LOOP;
    ELSIF NEW.assigned_to IS NOT NULL THEN
        INSERT INTO public.task_acknowledgements (
            task_id,
            user_id,
            is_acknowledged
        ) VALUES (
            NEW.id,
            NEW.assigned_to,
            FALSE
        )
        ON CONFLICT (task_id, user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_assigned_users_acks ON public.tasks;
CREATE TRIGGER trigger_sync_assigned_users_acks
    AFTER INSERT OR UPDATE OF assigned_users, assigned_to ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_assigned_users_to_acknowledgements();

-- 4. Clean up and recreate policies on public.lists (NEVER reference tasks table!)
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lists'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.lists', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "lists_select_policy" ON public.lists
FOR SELECT TO authenticated
USING (
    user_id = auth.uid() OR
    public.get_auth_user_role() IN ('manager', 'deputy_manager') OR
    (team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.team_id = public.lists.team_id AND tm.user_id = auth.uid()
    ))
);

CREATE POLICY "lists_insert_policy" ON public.lists
FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid() OR
    public.get_auth_user_role() IN ('manager', 'deputy_manager')
);

CREATE POLICY "lists_update_policy" ON public.lists
FOR UPDATE TO authenticated
USING (
    user_id = auth.uid() OR
    public.get_auth_user_role() IN ('manager', 'deputy_manager')
)
WITH CHECK (
    user_id = auth.uid() OR
    public.get_auth_user_role() IN ('manager', 'deputy_manager')
);

CREATE POLICY "lists_delete_policy" ON public.lists
FOR DELETE TO authenticated
USING (
    user_id = auth.uid() OR
    public.get_auth_user_role() IN ('manager', 'deputy_manager')
);

-- 5. Clean up and recreate policies on public.task_acknowledgements
ALTER TABLE public.task_acknowledgements ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'task_acknowledgements'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.task_acknowledgements', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "task_ack_select_policy" ON public.task_acknowledgements
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "task_ack_insert_policy" ON public.task_acknowledgements
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "task_ack_update_policy" ON public.task_acknowledgements
FOR UPDATE TO authenticated
USING (
    user_id = auth.uid() OR
    public.get_auth_user_role() IN ('manager', 'deputy_manager')
)
WITH CHECK (
    user_id = auth.uid() OR
    public.get_auth_user_role() IN ('manager', 'deputy_manager')
);

CREATE POLICY "task_ack_delete_policy" ON public.task_acknowledgements
FOR DELETE TO authenticated
USING (
    user_id = auth.uid() OR
    public.get_auth_user_role() IN ('manager', 'deputy_manager')
);

-- 6. Clean up and recreate watertight non-recursive policies on public.tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tasks'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.tasks', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "tasks_select_policy" ON public.tasks
FOR SELECT TO authenticated
USING (
    public.get_auth_user_role() IN ('manager', 'deputy_manager') OR
    created_by = auth.uid() OR
    assigned_to = auth.uid() OR
    auth.uid() = ANY(COALESCE(assigned_users, '{}'::uuid[])) OR
    public.check_user_has_list_access(list_id, auth.uid())
);

CREATE POLICY "tasks_insert_policy" ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (
    created_by = auth.uid() OR
    public.get_auth_user_role() IN ('manager', 'deputy_manager')
);

CREATE POLICY "tasks_update_policy" ON public.tasks
FOR UPDATE TO authenticated
USING (
    public.get_auth_user_role() IN ('manager', 'deputy_manager') OR
    created_by = auth.uid() OR
    assigned_to = auth.uid() OR
    auth.uid() = ANY(COALESCE(assigned_users, '{}'::uuid[])) OR
    public.check_user_has_list_access(list_id, auth.uid())
)
WITH CHECK (
    public.get_auth_user_role() IN ('manager', 'deputy_manager') OR
    created_by = auth.uid() OR
    assigned_to = auth.uid() OR
    auth.uid() = ANY(COALESCE(assigned_users, '{}'::uuid[])) OR
    public.check_user_has_list_access(list_id, auth.uid())
);

CREATE POLICY "tasks_delete_policy" ON public.tasks
FOR DELETE TO authenticated
USING (
    created_by = auth.uid() OR
    public.get_auth_user_role() IN ('manager', 'deputy_manager')
);

-- 7. Completion Lock Trigger: Ensure all assignees finish before marking complete
CREATE OR REPLACE FUNCTION public.fn_prevent_unacknowledged_task_completion()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_unack_count INT;
    v_pending_names TEXT;
BEGIN
    IF NEW.is_completed = TRUE AND (OLD.is_completed IS NULL OR OLD.is_completed = FALSE) THEN
        SELECT 
            COUNT(*),
            STRING_AGG(COALESCE(p.full_name, p.email, 'Member'), ', ')
        INTO 
            v_unack_count,
            v_pending_names
        FROM public.task_acknowledgements ack
        LEFT JOIN public.profiles p ON p.id = ack.user_id
        WHERE ack.task_id = NEW.id AND ack.is_acknowledged = FALSE;

        IF v_unack_count > 0 THEN
            RAISE EXCEPTION 'Cannot complete task: % assigned user(s) still have not finished their part (%). All assigned users must mark their part done first.', v_unack_count, v_pending_names;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_unacknowledged_task_completion ON public.tasks;
CREATE TRIGGER trg_prevent_unacknowledged_task_completion
    BEFORE UPDATE OF is_completed ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_unacknowledged_task_completion();
