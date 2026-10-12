-- ==========================================================
-- ADD GOOGLE CALENDAR 2-WAY SYNC COLUMN TO TASKS TABLE
-- ==========================================================

-- 1. Add google_event_id column to tasks table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'tasks' 
      AND column_name = 'google_event_id'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN google_event_id TEXT NULL;
  END IF;
END $$;

-- 2. Create index for fast lookups during 2-way sync
CREATE INDEX IF NOT EXISTS idx_tasks_google_event_id ON public.tasks(google_event_id);

-- 3. Add column description
COMMENT ON COLUMN public.tasks.google_event_id IS 'Unique Google Calendar Event ID used for 2-way synchronization';
