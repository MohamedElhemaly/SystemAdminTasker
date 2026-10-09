-- ==============================================================================
-- 🚀 FEATURE: MAP VISIBILITY TOGGLE FOR STATUSES
-- ==============================================================================
-- Add is_map_visible column to dropdown_statuses so Admins can control 
-- which statuses allow tasks to appear on the React Flow map.
-- ==============================================================================

ALTER TABLE public.dropdown_statuses 
ADD COLUMN IF NOT EXISTS is_map_visible BOOLEAN DEFAULT FALSE;

-- Reload schema for PostgREST
NOTIFY pgrst, 'reload schema';
