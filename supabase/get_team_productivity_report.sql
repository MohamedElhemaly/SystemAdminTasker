-- ==============================================================================
-- TEAM PRODUCTIVITY & TIME-TRACKING REPORT RPC FUNCTION
-- Calculates tasks completed and total working time per user within a date range
-- Strictly accessible to Managers and Sub-Managers (and Admins)
-- ==============================================================================

-- Ensure 'admin' exists in user_role_enum safely if enum is in use
DO $$
BEGIN
    ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.get_team_productivity(
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ
)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    role TEXT,
    completed_tasks_count BIGINT,
    total_duration_seconds BIGINT
) 
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_calling_role TEXT;
BEGIN
    -- Security Enforcement: Ensure caller has Manager, Sub-Manager, or Admin role
    IF auth.uid() IS NOT NULL THEN
        SELECT p.role::text INTO v_calling_role
        FROM public.profiles p
        WHERE p.id = auth.uid();

        IF v_calling_role NOT IN ('manager', 'sub_manager', 'deputy_manager', 'admin') THEN
            RAISE EXCEPTION 'Access Denied: Only Managers and Sub-Managers are authorized to access Team Productivity reports.';
        END IF;
    END IF;

    -- Return aggregated productivity metrics
    RETURN QUERY
    WITH user_time_logs AS (
        SELECT 
            ttl.user_id,
            COALESCE(SUM(ttl.duration_seconds), 0)::BIGINT AS duration_sum
        FROM 
            public.task_time_logs ttl
        WHERE 
            ttl.start_time >= start_date 
            AND ttl.start_time <= end_date
        GROUP BY 
            ttl.user_id
    ),
    user_completed_tasks AS (
        SELECT 
            assigned_user_id AS user_id,
            COUNT(DISTINCT t.id)::BIGINT AS task_count
        FROM (
            -- Assigned via array
            SELECT t.id, UNNEST(t.assigned_users) AS assigned_user_id
            FROM public.tasks t
            WHERE t.is_completed = TRUE
              AND (t.updated_at >= start_date AND t.updated_at <= end_date 
                   OR t.created_at >= start_date AND t.created_at <= end_date)
            UNION
            -- Assigned via single assigned_to
            SELECT t.id, t.assigned_to AS assigned_user_id
            FROM public.tasks t
            WHERE t.is_completed = TRUE AND t.assigned_to IS NOT NULL
              AND (t.updated_at >= start_date AND t.updated_at <= end_date 
                   OR t.created_at >= start_date AND t.created_at <= end_date)
            UNION
            -- Acknowledged / finished part in team tasks
            SELECT ta.task_id AS id, ta.user_id AS assigned_user_id
            FROM public.task_acknowledgements ta
            WHERE ta.is_acknowledged = TRUE
              AND (ta.acknowledged_at >= start_date AND ta.acknowledged_at <= end_date
                   OR ta.created_at >= start_date AND ta.created_at <= end_date)
        ) sub
        JOIN public.tasks t ON t.id = sub.id
        WHERE assigned_user_id IS NOT NULL
        GROUP BY assigned_user_id
    )
    SELECT 
        p.id AS user_id,
        COALESCE(p.full_name, p.email, 'Team Member')::TEXT AS full_name,
        COALESCE(p.role, 'member')::TEXT AS role,
        COALESCE(uct.task_count, 0)::BIGINT AS completed_tasks_count,
        COALESCE(utl.duration_sum, 0)::BIGINT AS total_duration_seconds
    FROM 
        public.profiles p
    LEFT JOIN 
        user_time_logs utl ON utl.user_id = p.id
    LEFT JOIN 
        user_completed_tasks uct ON uct.user_id = p.id
    ORDER BY 
        completed_tasks_count DESC, 
        total_duration_seconds DESC, 
        full_name ASC;
END;
$$ LANGUAGE plpgsql;

-- Grant execution permissions to authenticated users (role checked inside function)
GRANT EXECUTE ON FUNCTION public.get_team_productivity(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
