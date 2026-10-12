-- Migration: Advanced Recurring Tasks (RRULE)
-- Adds standard RFC 5545 recurrence rule support to tasks table

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS recurrence_rule TEXT NULL;

-- Description comment
COMMENT ON COLUMN public.tasks.recurrence_rule IS 'RFC 5545 RRULE string specifying task recurrence (e.g. FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR)';
