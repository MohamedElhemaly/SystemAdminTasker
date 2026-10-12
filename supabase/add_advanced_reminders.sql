-- ==============================================================================
-- ADVANCED REMINDER SYSTEM FOR RECURRING TASKS & SUPABASE PG_CRON
-- ==============================================================================

-- 1. Add Reminder Columns to public.tasks
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS reminder_offset_days INTEGER NULL,
ADD COLUMN IF NOT EXISTS reminder_time TIME NULL DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS next_reminder_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS is_reminder_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_constant_reminder BOOLEAN DEFAULT FALSE;

-- High performance partial index for background reminder scanning
CREATE INDEX IF NOT EXISTS idx_tasks_next_reminder_at_pending 
ON public.tasks(next_reminder_at) 
WHERE is_reminder_sent = FALSE AND is_completed = FALSE;

-- 2. Helper function to compute next_reminder_at
CREATE OR REPLACE FUNCTION public.fn_compute_task_reminder_at(
    p_due_date TIMESTAMPTZ,
    p_offset_days INT,
    p_reminder_time TIME
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_target_date DATE;
    v_time TIME := COALESCE(p_reminder_time, '09:00:00'::TIME);
BEGIN
    IF p_due_date IS NULL OR p_offset_days IS NULL THEN
        RETURN NULL;
    END IF;

    -- Subtract offset days from the due date
    v_target_date := (p_due_date AT TIME ZONE 'UTC')::DATE - (p_offset_days * INTERVAL '1 day')::INTERVAL;
    
    -- Combine with the specified reminder_time
    RETURN (v_target_date + v_time) AT TIME ZONE 'UTC';
END;
$$;

-- 3. Automatic Trigger: Keep next_reminder_at in sync whenever due_date or reminder changes
CREATE OR REPLACE FUNCTION public.fn_sync_task_reminder()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.reminder_offset_days IS NOT NULL THEN
        -- Recompute if due_date, offset, or time changed, or next_reminder_at is null
        IF (TG_OP = 'INSERT') OR 
           (OLD.due_date IS DISTINCT FROM NEW.due_date) OR 
           (OLD.reminder_offset_days IS DISTINCT FROM NEW.reminder_offset_days) OR 
           (OLD.reminder_time IS DISTINCT FROM NEW.reminder_time) OR
           (NEW.next_reminder_at IS NULL) THEN
           
            NEW.next_reminder_at := public.fn_compute_task_reminder_at(
                NEW.due_date, 
                NEW.reminder_offset_days, 
                NEW.reminder_time
            );
            
            -- Reset reminder sent flag on date/time change or rollover
            NEW.is_reminder_sent := FALSE;
        END IF;
    ELSE
        NEW.next_reminder_at := NULL;
        NEW.is_reminder_sent := FALSE;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_task_reminder ON public.tasks;
CREATE TRIGGER trigger_sync_task_reminder
    BEFORE INSERT OR UPDATE OF due_date, reminder_offset_days, reminder_time ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_task_reminder();

-- 4. Background Processor Function:
-- Finds all due reminders, creates notifications for assigned members, and marks is_reminder_sent = TRUE
CREATE OR REPLACE FUNCTION public.process_task_reminders()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    r RECORD;
    v_target_uid UUID;
    v_due_text TEXT;
BEGIN
    FOR r IN 
        SELECT 
            t.id, 
            t.title, 
            t.due_date, 
            t.created_by, 
            t.assigned_to, 
            t.assigned_users,
            t.is_constant_reminder
        FROM public.tasks t
        WHERE t.next_reminder_at IS NOT NULL
          AND t.next_reminder_at <= NOW()
          AND t.is_reminder_sent = FALSE
          AND t.is_completed = FALSE
    LOOP
        -- Determine relative due status text
        IF r.due_date IS NOT NULL AND r.due_date::date = CURRENT_DATE THEN
            v_due_text := 'today';
        ELSIF r.due_date IS NOT NULL AND r.due_date::date < CURRENT_DATE THEN
            v_due_text := 'overdue';
        ELSE
            v_due_text := 'soon';
        END IF;

        -- A. If multi-assignees present, notify each assigned user
        IF r.assigned_users IS NOT NULL AND array_length(r.assigned_users, 1) > 0 THEN
            FOREACH v_target_uid IN ARRAY r.assigned_users LOOP
                IF v_target_uid IS NOT NULL THEN
                    INSERT INTO public.notifications (
                        user_id,
                        actor_id,
                        type,
                        entity_id,
                        message_data,
                        is_read
                    ) VALUES (
                        v_target_uid,
                        r.created_by,
                        'task_reminder',
                        r.id,
                        jsonb_build_object(
                            'task_id', r.id,
                            'task_title', r.title,
                            'due_date', r.due_date,
                            'due_text', v_due_text
                        ),
                        FALSE
                    );
                END IF;
            END LOOP;

        -- B. If single assigned_to is set
        ELSIF r.assigned_to IS NOT NULL THEN
            INSERT INTO public.notifications (
                user_id,
                actor_id,
                type,
                entity_id,
                message_data,
                is_read
            ) VALUES (
                r.assigned_to,
                r.created_by,
                'task_reminder',
                r.id,
                jsonb_build_object(
                    'task_id', r.id,
                    'task_title', r.title,
                    'due_date', r.due_date,
                    'due_text', v_due_text
                ),
                FALSE
            );

        -- C. Otherwise notify the creator
        ELSIF r.created_by IS NOT NULL THEN
            INSERT INTO public.notifications (
                user_id,
                actor_id,
                type,
                entity_id,
                message_data,
                is_read
            ) VALUES (
                r.created_by,
                r.created_by,
                'task_reminder',
                r.id,
                jsonb_build_object(
                    'task_id', r.id,
                    'task_title', r.title,
                    'due_date', r.due_date,
                    'due_text', v_due_text
                ),
                FALSE
            );
        END IF;

        -- Mark task as reminder sent for current cycle
        UPDATE public.tasks
        SET is_reminder_sent = TRUE
        WHERE id = r.id;

    END LOOP;
END;
$$;

-- 5. Enable pg_cron Extension & Schedule 1-Minute Job
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA cron TO postgres;

DO $$
BEGIN
    PERFORM cron.unschedule('process-task-reminders-job');
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END;
$$;

SELECT cron.schedule(
    'process-task-reminders-job',
    '* * * * *',
    $$SELECT public.process_task_reminders();$$
);
