-- ==============================================================================
-- ADVANCED TIME TRACKING (PLAY/PAUSE) & USER WORK PRESENCE (SUPABASE MIGRATION)
-- ==============================================================================

-- Ensure 'admin' exists in user_role_enum safely if enum is in use
DO $$
BEGIN
    ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;

-- 1. Create task_time_logs table for precise interval recording
CREATE TABLE IF NOT EXISTS public.task_time_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ NULL,
    duration_seconds INTEGER NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for performance querying
CREATE INDEX IF NOT EXISTS idx_task_time_logs_task_id ON public.task_time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_user_id ON public.task_time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_active ON public.task_time_logs(user_id) WHERE end_time IS NULL;

-- 2. Add work_status column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS work_status VARCHAR(30) DEFAULT 'offline';

-- Check constraint to ensure valid work statuses
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_profiles_work_status'
    ) THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT check_profiles_work_status
        CHECK (work_status IN ('online', 'ready', 'working', 'in_break', 'offline'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_work_status ON public.profiles(work_status);

-- 3. Row Level Security for task_time_logs
ALTER TABLE public.task_time_logs ENABLE ROW LEVEL SECURITY;

-- Transparent read access for team visibility
DROP POLICY IF EXISTS "Authenticated users can view time logs" ON public.task_time_logs;
CREATE POLICY "Authenticated users can view time logs"
ON public.task_time_logs FOR SELECT
TO authenticated
USING (true);

-- Users can insert their own time intervals
DROP POLICY IF EXISTS "Users can insert their own time logs" ON public.task_time_logs;
CREATE POLICY "Users can insert their own time logs"
ON public.task_time_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update/pause their own time logs (and managers have supervisory override)
DROP POLICY IF EXISTS "Users can update their own time logs" ON public.task_time_logs;
CREATE POLICY "Users can update their own time logs"
ON public.task_time_logs FOR UPDATE
TO authenticated
USING (
    auth.uid() = user_id 
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role::text IN ('manager', 'sub_manager', 'deputy_manager', 'admin'))
);

-- Users can delete their own time logs
DROP POLICY IF EXISTS "Users can delete their own time logs" ON public.task_time_logs;
CREATE POLICY "Users can delete their own time logs"
ON public.task_time_logs FOR DELETE
TO authenticated
USING (
    auth.uid() = user_id 
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role::text IN ('manager', 'sub_manager', 'deputy_manager', 'admin'))
);

-- 4. Enable Supabase Realtime Replication for instant live sync across users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'task_time_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.task_time_logs;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.task_time_logs REPLICA IDENTITY FULL;

-- 5. Auto-close previous active time log when starting a new task (Edge Case: Switch tasks without finishing)
CREATE OR REPLACE FUNCTION public.fn_auto_close_previous_user_time_logs()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    -- If user inserts a new active timer log (end_time IS NULL), close any prior open logs for this user
    IF NEW.end_time IS NULL THEN
        UPDATE public.task_time_logs
        SET 
            end_time = COALESCE(NEW.start_time, NOW()),
            duration_seconds = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (COALESCE(NEW.start_time, NOW()) - start_time))))::INTEGER
        WHERE user_id = NEW.user_id
          AND end_time IS NULL
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_close_previous_user_time_logs ON public.task_time_logs;
CREATE TRIGGER trg_auto_close_previous_user_time_logs
BEFORE INSERT ON public.task_time_logs
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_close_previous_user_time_logs();

-- 6. Auto-close active time logs on task completion or submission for review
CREATE OR REPLACE FUNCTION public.fn_auto_close_task_time_logs_on_completion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    -- When a task is marked completed, under_review, or is_completed = true
    IF (NEW.is_completed = TRUE OR NEW.status IN ('completed', 'under_review')) THEN
        UPDATE public.task_time_logs
        SET 
            end_time = NOW(),
            duration_seconds = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - start_time))))::INTEGER
        WHERE task_id = NEW.id
          AND end_time IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_close_task_time_logs ON public.tasks;
CREATE TRIGGER trg_auto_close_task_time_logs
AFTER UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_close_task_time_logs_on_completion();

-- 7. Ensure full replica identity for realtime notifications
DO $$
BEGIN
    ALTER TABLE public.notifications REPLICA IDENTITY FULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 8. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

