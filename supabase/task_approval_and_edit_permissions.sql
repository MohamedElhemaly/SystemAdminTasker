-- ============================================================================
-- TASK DUAL APPROVAL WORKFLOW & COLUMN-LEVEL EDIT RESTRICTIONS (POSTGRESQL TRIGGER)
-- Enforces:
-- 1. Dual Approval: BOTH Manager AND Sub-Manager must approve before a task is Completed.
-- 2. Members CANNOT edit task details (title, description, due_date, etc.).
-- 3. Members can ONLY update task status to 'under_review' for manager review.
-- 4. Managers & Sub-Managers have unrestricted edit access.
-- ============================================================================

-- 1. Ensure 'status' and dual approval columns exist on public.tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'to_do',
ADD COLUMN IF NOT EXISTS manager_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sub_manager_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS manager_approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sub_manager_approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sub_manager_approved_at TIMESTAMPTZ;

-- 2. Create indices for high-performance filtering
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_dual_approval ON public.tasks(manager_approved, sub_manager_approved);

-- 3. Backfill status and approvals based on existing completion states
UPDATE public.tasks
SET 
    manager_approved = TRUE,
    sub_manager_approved = TRUE,
    status = 'completed'
WHERE is_completed = TRUE;

UPDATE public.tasks
SET status = CASE
    WHEN status_id IN (SELECT id FROM public.dropdown_statuses WHERE LOWER(name) LIKE '%review%') THEN 'under_review'
    ELSE 'to_do'
END
WHERE is_completed = FALSE AND (status IS NULL OR status = 'to_do');

-- 4. Trigger Function: Enforce strict dual approval & column-level security
CREATE OR REPLACE FUNCTION public.fn_enforce_task_member_edit_restrictions()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_role TEXT;
BEGIN
    -- Allow internal system operations, database seeding, or migrations without auth.uid()
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Fetch the calling user's role from public.profiles
    SELECT role::text INTO v_user_role
    FROM public.profiles
    WHERE id = auth.uid();

    -- Fallback default if profile is missing
    IF v_user_role IS NULL THEN
        v_user_role := 'member';
    END IF;

    -- ─────────────────────────────────────────────────────────────
    -- DUAL APPROVAL INTEGRITY CHECK (Enforced globally)
    -- Both Manager and Sub-Manager must approve before task can be completed!
    -- ─────────────────────────────────────────────────────────────
    IF (NEW.is_completed = TRUE OR NEW.status = 'completed') THEN
        IF (NEW.manager_approved IS NOT TRUE OR NEW.sub_manager_approved IS NOT TRUE) THEN
            RAISE EXCEPTION 'Dual Approval Required: Both Manager and Sub-Manager must approve the task before completion.';
        END IF;
    END IF;

    -- Track who approved
    IF (NEW.manager_approved IS DISTINCT FROM OLD.manager_approved) AND NEW.manager_approved = TRUE THEN
        IF v_user_role NOT IN ('manager', 'admin') THEN
            RAISE EXCEPTION 'Only a Manager can grant Manager approval.';
        END IF;
        NEW.manager_approved_by := auth.uid();
        NEW.manager_approved_at := NOW();
    END IF;

    IF (NEW.sub_manager_approved IS DISTINCT FROM OLD.sub_manager_approved) AND NEW.sub_manager_approved = TRUE THEN
        IF v_user_role NOT IN ('sub_manager', 'deputy_manager', 'admin') THEN
            RAISE EXCEPTION 'Only a Sub-Manager can grant Sub-Manager approval.';
        END IF;
        NEW.sub_manager_approved_by := auth.uid();
        NEW.sub_manager_approved_at := NOW();
    END IF;

    -- Managers and Sub-Managers (and Deputy Managers / Admins) have full edit permissions
    IF v_user_role IN ('manager', 'sub_manager', 'deputy_manager', 'admin') THEN
        -- Automatic state sync: When both approved, complete task
        IF NEW.manager_approved = TRUE AND NEW.sub_manager_approved = TRUE THEN
            NEW.is_completed := TRUE;
            NEW.status := 'completed';
        ELSIF NEW.status IN ('to_do', 'in_progress', 'under_review') THEN
            NEW.is_completed := FALSE;
        END IF;
        RETURN NEW;
    END IF;

    -- ─────────────────────────────────────────────────────────────
    -- Strict Governance for Regular Members
    -- ─────────────────────────────────────────────────────────────
    IF v_user_role = 'member' THEN
        -- Check if title, due_date, or any protected details were modified
        IF (NEW.title IS DISTINCT FROM OLD.title) OR
           (NEW.description IS DISTINCT FROM OLD.description) OR
           (NEW.due_date IS DISTINCT FROM OLD.due_date) OR
           (NEW.priority_id IS DISTINCT FROM OLD.priority_id) OR
           (NEW.task_type_id IS DISTINCT FROM OLD.task_type_id) OR
           (NEW.list_id IS DISTINCT FROM OLD.list_id) OR
           (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) OR
           (NEW.assigned_users IS DISTINCT FROM OLD.assigned_users) OR
           (NEW.recurrence_rule IS DISTINCT FROM OLD.recurrence_rule) OR
           (NEW.is_urgent IS DISTINCT FROM OLD.is_urgent) OR
           (NEW.is_important IS DISTINCT FROM OLD.is_important) OR
           (NEW.reminder_offset_days IS DISTINCT FROM OLD.reminder_offset_days) OR
           (NEW.reminder_time IS DISTINCT FROM OLD.reminder_time) OR
           (NEW.created_by IS DISTINCT FROM OLD.created_by)
        THEN
            RAISE EXCEPTION 'Members are not allowed to edit task details';
        END IF;

        -- Members cannot grant manager or sub-manager approvals
        IF (NEW.manager_approved IS DISTINCT FROM OLD.manager_approved) OR
           (NEW.sub_manager_approved IS DISTINCT FROM OLD.sub_manager_approved)
        THEN
            RAISE EXCEPTION 'Members cannot approve tasks.';
        END IF;

        -- Members are ONLY allowed to transition status to 'under_review'
        IF (NEW.status IS DISTINCT FROM OLD.status) THEN
            IF NEW.status != 'under_review' THEN
                RAISE EXCEPTION 'Members are not allowed to edit task details';
            END IF;
        END IF;

        -- Members cannot directly mark tasks as completed
        IF (NEW.is_completed IS DISTINCT FROM OLD.is_completed) AND NEW.is_completed = TRUE THEN
            RAISE EXCEPTION 'Members are not allowed to mark tasks as completed without Manager & Sub-Manager approval';
        END IF;

        -- If member submitted for review, ensure is_completed stays FALSE
        IF NEW.status = 'under_review' THEN
            NEW.is_completed := FALSE;
            NEW.manager_approved := FALSE;
            NEW.sub_manager_approved := FALSE;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach BEFORE UPDATE trigger to public.tasks
DROP TRIGGER IF EXISTS tr_enforce_task_member_edit_restrictions ON public.tasks;
CREATE TRIGGER tr_enforce_task_member_edit_restrictions
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.fn_enforce_task_member_edit_restrictions();

-- 6. Refresh PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';


