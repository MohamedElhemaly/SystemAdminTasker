-- ==============================================================================
-- 🚀 FEATURE: MAP VISIBILITY TOGGLE FOR TAGS
-- ==============================================================================
-- Add is_map_visible column to dropdown_tags so Admins can control 
-- which tags allow tasks to appear on the React Flow map.
-- ==============================================================================

ALTER TABLE public.dropdown_tags 
ADD COLUMN IF NOT EXISTS is_map_visible BOOLEAN DEFAULT FALSE;

-- Reload schema for PostgREST
NOTIFY pgrst, 'reload schema';
