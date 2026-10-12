-- ==========================================================
-- MULTI-SELECT ASSIGNEES & DYNAMIC ACKNOWLEDGEMENT SYSTEM
-- ==========================================================

-- 1. Add assigned_users ARRAY of UUIDs to public.tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS assigned_users UUID[] DEFAULT '{}'::uuid[];

-- 2. Create high-performance GIN index for array lookups
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_users 
ON public.tasks USING GIN(assigned_users);

-- 3. Backfill existing assigned_to into assigned_users array
UPDATE public.tasks 
SET assigned_users = ARRAY[assigned_to] 
WHERE assigned_to IS NOT NULL 
AND (assigned_users IS NULL OR assigned_users = '{}'::uuid[]);

-- 4. Bidirectional Sync Trigger:
-- Keep primary assigned_to in sync with assigned_users[1] for 100% backward compatibility
CREATE OR REPLACE FUNCTION public.fn_sync_task_assignees()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    -- If assigned_users is provided, keep assigned_to as primary (first element)
    IF NEW.assigned_users IS NOT NULL AND array_length(NEW.assigned_users, 1) > 0 THEN
        NEW.assigned_to := NEW.assigned_users[1];
    -- If only single assigned_to is updated, reflect into assigned_users
    ELSIF NEW.assigned_to IS NOT NULL AND (NEW.assigned_users IS NULL OR array_length(NEW.assigned_users, 1) IS NULL OR array_length(NEW.assigned_users, 1) = 0) THEN
        NEW.assigned_users := ARRAY[NEW.assigned_to];
    -- If cleared
    ELSIF NEW.assigned_to IS NULL AND (NEW.assigned_users IS NULL OR array_length(NEW.assigned_users, 1) = 0) THEN
        NEW.assigned_users := '{}'::uuid[];
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_task_assignees ON public.tasks;
CREATE TRIGGER trigger_sync_task_assignees
    BEFORE INSERT OR UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_task_assignees();

-- 5. Updated Notification Trigger to alert ALL assigned users in array
CREATE OR REPLACE FUNCTION public.fn_notify_task_assigned()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
    v_list_name TEXT := 'Inbox';
    v_uid UUID;
BEGIN
    v_actor_id := COALESCE(auth.uid(), NEW.created_by);

    -- Fetch actor name
    IF v_actor_id IS NOT NULL THEN
        SELECT COALESCE(full_name, email) INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
    END IF;
    v_actor_name := COALESCE(v_actor_name, 'Team Member');

    -- Fetch list name
    IF NEW.list_id IS NOT NULL THEN
        SELECT name INTO v_list_name FROM public.lists WHERE id = NEW.list_id;
    END IF;

    -- Case A: Multi-assignees array (Personal tasks)
    IF NEW.assigned_users IS NOT NULL AND array_length(NEW.assigned_users, 1) > 0 THEN
        FOREACH v_uid IN ARRAY NEW.assigned_users LOOP
            -- Skip self-assignment
            IF v_uid IS NOT NULL AND (v_actor_id IS NULL OR v_uid <> v_actor_id) THEN
                -- Only notify on INSERT or if user was not previously in OLD.assigned_users
                IF TG_OP = 'INSERT' OR OLD.assigned_users IS NULL OR NOT (v_uid = ANY(OLD.assigned_users)) THEN
                    INSERT INTO public.notifications (
                        user_id,
                        actor_id,
                        type,
                        entity_id,
                        message_data,
                        is_read
                    ) VALUES (
                        v_uid,
                        v_actor_id,
                        'task_assigned',
                        NEW.id,
                        jsonb_build_object(
                            'task_title', NEW.title,
                            'list_name', COALESCE(v_list_name, 'Inbox'),
                            'actor_name', v_actor_name
                        ),
                        FALSE
                    );
                END IF;
            END IF;
        END LOOP;
    
    -- Case B: Single assigned_to fallback
    ELSIF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
        IF v_actor_id IS NULL OR NEW.assigned_to <> v_actor_id THEN
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
                    'actor_name', v_actor_name
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
