-- =========================================================================
-- Private Notes / Personal Scratchpad Schema with Strict User Isolation RLS
-- =========================================================================

-- 1. Create the private_notes table
CREATE TABLE IF NOT EXISTS public.private_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    title TEXT DEFAULT 'Quick Note',
    content TEXT DEFAULT '',
    color TEXT DEFAULT 'yellow',
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Index for high-performance lookup by user
CREATE INDEX IF NOT EXISTS idx_private_notes_user_id ON public.private_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_private_notes_updated_at ON public.private_notes(updated_at DESC);

-- 3. Trigger to maintain updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_private_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_private_notes_updated_at ON public.private_notes;
CREATE TRIGGER trg_private_notes_updated_at
BEFORE UPDATE ON public.private_notes
FOR EACH ROW
EXECUTE FUNCTION public.handle_private_notes_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.private_notes ENABLE ROW LEVEL SECURITY;

-- 5. Strict User-Only Policies (NO MANAGER OR ADMIN OVERRIDE)
-- Only the user who owns the record can view, create, edit, or delete it.

DROP POLICY IF EXISTS "private_notes_select_policy" ON public.private_notes;
CREATE POLICY "private_notes_select_policy"
ON public.private_notes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "private_notes_insert_policy" ON public.private_notes;
CREATE POLICY "private_notes_insert_policy"
ON public.private_notes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "private_notes_update_policy" ON public.private_notes;
CREATE POLICY "private_notes_update_policy"
ON public.private_notes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "private_notes_delete_policy" ON public.private_notes;
CREATE POLICY "private_notes_delete_policy"
ON public.private_notes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 6. Add to Supabase Realtime publication for multi-tab sync
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.private_notes;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END;
$$;
