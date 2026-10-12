-- ==========================================================
-- REAL-TIME NOTIFICATION & ACTIVITY SYSTEM (TICKTICK STYLE)
-- ==========================================================

-- 1. Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL, -- 'task_assigned', 'team_added', 'shared_list', 'task_completed'
    entity_id UUID NULL,
    message_data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for high-performance lookup & real-time filtering
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- 2. Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notifications SELECT Policy" ON public.notifications;
CREATE POLICY "Notifications SELECT Policy" ON public.notifications
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Notifications UPDATE Policy" ON public.notifications;
CREATE POLICY "Notifications UPDATE Policy" ON public.notifications
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Notifications INSERT Policy" ON public.notifications;
CREATE POLICY "Notifications INSERT Policy" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Notifications DELETE Policy" ON public.notifications;
CREATE POLICY "Notifications DELETE Policy" ON public.notifications
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- 3. Automation Trigger: Notify when a task is assigned to a user
CREATE OR REPLACE FUNCTION public.fn_notify_task_assigned()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
    v_list_name TEXT := 'Inbox';
BEGIN
    -- Only trigger if assigned_to is set and changed (or new)
    IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
        
        v_actor_id := COALESCE(auth.uid(), NEW.created_by);
        
        -- Don't notify if assigning task to oneself
        IF v_actor_id IS NULL OR NEW.assigned_to IS DISTINCT FROM v_actor_id THEN
            
            -- Fetch actor name
            IF v_actor_id IS NOT NULL THEN
                SELECT COALESCE(full_name, email) INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
            END IF;
            
            -- Fetch list name if exists
            IF NEW.list_id IS NOT NULL THEN
                SELECT name INTO v_list_name FROM public.lists WHERE id = NEW.list_id;
            END IF;

            INSERT INTO public.notifications (
                user_id,
                actor_id,
                type,
                entity_id,
                message_data,
                is_read
            ) VALUES (
                NEW.assigned_to,
                v_actor_id,
                'task_assigned',
                NEW.id,
                jsonb_build_object(
                    'task_title', NEW.title,
                    'list_name', COALESCE(v_list_name, 'Inbox'),
                    'actor_name', COALESCE(v_actor_name, 'Team Member')
                ),
                FALSE
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_task_assigned ON public.tasks;
CREATE TRIGGER trigger_notify_task_assigned
    AFTER INSERT OR UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.fn_notify_task_assigned();

-- 4. Safe Idempotent Enable Supabase Realtime on notifications table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END;
$$;
