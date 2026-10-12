-- ==========================================================
-- NUDGE / REMIND SYSTEM (TEAM TASKS & NOTIFICATIONS)
-- ==========================================================

-- 1. Stored Function: Nudge All Pending / Unacknowledged Members for a Task
CREATE OR REPLACE FUNCTION public.fn_nudge_task_members(
    p_task_id UUID,
    p_actor_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_task_title TEXT;
    v_actor_name TEXT := 'Team Member';
    v_nudged_count INT := 0;
    v_ack RECORD;
BEGIN
    -- Verify task exists
    SELECT title INTO v_task_title
    FROM public.tasks
    WHERE id = p_task_id;

    IF v_task_title IS NULL THEN
        RAISE EXCEPTION 'Task with id % not found', p_task_id;
    END IF;

    -- Fetch actor name if available
    IF p_actor_id IS NOT NULL THEN
        SELECT COALESCE(full_name, email) INTO v_actor_name
        FROM public.profiles
        WHERE id = p_actor_id;
    END IF;

    -- Loop through all users with pending acknowledgements for this task
    FOR v_ack IN 
        SELECT ack.user_id 
        FROM public.task_acknowledgements ack
        WHERE ack.task_id = p_task_id 
          AND ack.is_acknowledged = FALSE
          AND (p_actor_id IS NULL OR ack.user_id IS DISTINCT FROM p_actor_id)
    LOOP
        INSERT INTO public.notifications (
            user_id,
            actor_id,
            type,
            entity_id,
            message_data,
            is_read
        ) VALUES (
            v_ack.user_id,
            p_actor_id,
            'nudge_ack',
            p_task_id,
            jsonb_build_object(
                'task_id', p_task_id,
                'task_title', v_task_title,
                'actor_name', COALESCE(v_actor_name, 'Manager'),
                'custom_text', COALESCE(v_actor_name, 'Manager') || ' nudged you to finish your part on "' || v_task_title || '".'
            ),
            FALSE
        );
        v_nudged_count := v_nudged_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', TRUE,
        'task_id', p_task_id,
        'nudged_count', v_nudged_count
    );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.fn_nudge_task_members(UUID, UUID) TO authenticated;
