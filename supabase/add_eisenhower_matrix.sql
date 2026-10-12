-- ==========================================================
-- EISENHOWER MATRIX SCHEMA MIGRATION
-- ==========================================================

-- 1. Add is_urgent and is_important boolean columns to public.tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT FALSE;

-- 2. Create index for high-performance matrix quadrant queries
CREATE INDEX IF NOT EXISTS idx_tasks_matrix_quadrants ON public.tasks(is_urgent, is_important);

-- 3. Backfill existing tasks based on priority (if priority exists)
DO $$
BEGIN
    -- High priority -> Urgent & Important (Q1)
    UPDATE public.tasks
    SET is_urgent = TRUE, is_important = TRUE
    WHERE (is_urgent IS NULL OR is_urgent = FALSE)
      AND (is_important IS NULL OR is_important = FALSE)
      AND priority_id IN (
          SELECT id FROM public.dropdown_priorities 
          WHERE level_order >= 4 OR name ILIKE '%high%' OR name ILIKE '%urgent%'
      );

    -- Medium priority -> Not Urgent & Important (Q2)
    UPDATE public.tasks
    SET is_urgent = FALSE, is_important = TRUE
    WHERE (is_urgent IS NULL OR is_urgent = FALSE)
      AND (is_important IS NULL OR is_important = FALSE)
      AND priority_id IN (
          SELECT id FROM public.dropdown_priorities 
          WHERE level_order = 3 OR name ILIKE '%medium%'
      );

    -- Low priority -> Urgent & Unimportant (Q3) or Not Urgent & Unimportant (Q4)
    UPDATE public.tasks
    SET is_urgent = FALSE, is_important = FALSE
    WHERE is_urgent IS NULL OR is_important IS NULL;
END $$;
