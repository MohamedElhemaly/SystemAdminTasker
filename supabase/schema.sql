-- ==========================================================
-- ENTERPRISE TICKTICK CLONE WITH DYNAMIC DROPDOWNS, RLS & MANY-TO-MANY TAGS
-- ==========================================================
-- SECURITY PRINCIPLE: Every single table has RLS enabled.
-- NO anonymous reads/writes. All policies target `authenticated` role only.
-- All user-owned data is scoped via `auth.uid()`.
-- ==========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Custom Enums
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
        CREATE TYPE user_role_enum AS ENUM ('manager', 'sub_manager', 'deputy_manager', 'member');
    ELSE
        BEGIN
            ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'sub_manager';
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;
END $$;

-- 2. Create Profiles Table (Built-in Avatar ID: avatar-1 to avatar-10)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_id TEXT DEFAULT 'avatar-1',
    role user_role_enum DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Dynamic Dropdown Lookup Tables (Database-Driven Menus)

-- Priority Dropdown Lookup Table
CREATE TABLE IF NOT EXISTS public.dropdown_priorities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color_hex TEXT DEFAULT '#94a3b8',
    level_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Status Dropdown Lookup Table
CREATE TABLE IF NOT EXISTS public.dropdown_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color_hex TEXT DEFAULT '#3b82f6',
    is_completed_state BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task Type Dropdown Lookup Table
CREATE TABLE IF NOT EXISTS public.dropdown_task_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color_hex TEXT DEFAULT '#ec4899',
    description TEXT DEFAULT '',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tag Dropdown Lookup Table
CREATE TABLE IF NOT EXISTS public.dropdown_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color_hex TEXT DEFAULT '#3b82f6',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams & Team Members Tables
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

-- Lists Table
CREATE TABLE IF NOT EXISTS public.lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    icon TEXT DEFAULT 'list',
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tasks Table with Foreign Keys to Dynamic Dropdowns
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_completed BOOLEAN DEFAULT FALSE,
    due_date TIMESTAMP WITH TIME ZONE NULL,
    priority_id UUID REFERENCES public.dropdown_priorities(id) ON DELETE SET NULL,
    status_id UUID REFERENCES public.dropdown_statuses(id) ON DELETE SET NULL,
    task_type_id UUID REFERENCES public.dropdown_task_types(id) ON DELETE SET NULL,
    list_id UUID REFERENCES public.lists(id) ON DELETE CASCADE NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction Table: Many-to-Many Mapping for Generic Task Tags (TickTick style)
CREATE TABLE IF NOT EXISTS public.task_tag_mapping (
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.dropdown_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (task_id, tag_id)
);

-- Subtasks Table
CREATE TABLE IF NOT EXISTS public.subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task Acknowledgements Table
CREATE TABLE IF NOT EXISTS public.task_acknowledgements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(task_id, user_id)
);

-- Task Attachments Table (Excel-Only Files)
CREATE TABLE IF NOT EXISTS public.task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    mime_type TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Seed Default Entries for Dynamic Dropdown Tables
INSERT INTO public.dropdown_priorities (name, color_hex, level_order) VALUES
    ('None', '#94a3b8', 0),
    ('Low', '#3b82f6', 1),
    ('Medium', '#eab308', 2),
    ('High', '#ef4444', 3)
ON CONFLICT DO NOTHING;

INSERT INTO public.dropdown_statuses (name, color_hex, is_completed_state) VALUES
    ('To Do', '#3b82f6', FALSE),
    ('In Progress', '#eab308', FALSE),
    ('In Review', '#8b5cf6', FALSE),
    ('Completed', '#10b981', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO public.dropdown_task_types (name, color_hex, description) VALUES
    ('Personal', '#3b82f6', 'Standard personal task'),
    ('Team Task', '#ec4899', 'Requires team member mandatory acknowledgement'),
    ('Urgent Review', '#ef4444', 'High-priority management review'),
    ('Deployment', '#8b5cf6', 'Release and infrastructure task')
ON CONFLICT DO NOTHING;

INSERT INTO public.dropdown_tags (name, color_hex) VALUES
    ('Production', '#ef4444'),
    ('Backend', '#3b82f6'),
    ('Security', '#8b5cf6')
ON CONFLICT DO NOTHING;

-- 6. Enable Supabase Realtime
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.task_acknowledgements;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 7. Storage Setup for Task Files (EXCEL/CSV ONLY + Task Isolation Download Policy)
INSERT INTO storage.buckets (id, name, public, allowed_mime_types) 
VALUES (
    'task_files', 
    'task_files', 
    false, -- Private bucket for strict RLS download security
    ARRAY[
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
    ]
) 
ON CONFLICT (id) DO UPDATE SET 
    public = false,
    allowed_mime_types = ARRAY[
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
    ];

-- 8. Helper Function for Auth User Role Retrieval
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS user_role_enum AS $$
DECLARE
    v_role user_role_enum;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(v_role, 'member'::user_role_enum);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Storage Download Security RLS Policy
DROP POLICY IF EXISTS "Task files select access" ON storage.objects;
DROP POLICY IF EXISTS "Task files public access" ON storage.objects;
DROP POLICY IF EXISTS "Only Excel/CSV uploads allowed" ON storage.objects;

CREATE POLICY "Task files select access" ON storage.objects FOR SELECT TO authenticated USING (
    bucket_id = 'task_files' AND (
        public.get_auth_user_role() = 'manager' OR
        auth.uid() = owner OR
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE storage.objects.name LIKE '%' || t.id::text || '%'
              AND (
                t.created_by = auth.uid() OR 
                t.assigned_to = auth.uid() OR 
                EXISTS (SELECT 1 FROM public.task_acknowledgements WHERE task_id = t.id AND user_id = auth.uid())
              )
        )
    )
);

CREATE POLICY "Only Excel/CSV uploads allowed" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'task_files' AND (
            LOWER(storage.extension(name)) IN ('xlsx', 'xls', 'csv') OR
            (metadata->>'mimetype' IN (
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel',
                'text/csv'
            ))
        )
    );

-- 9. Triggers

-- Auto Profile creation on Supabase Auth User Creation/Invite
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_id, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'avatar_id', 'avatar-1'),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role_enum, 'member'::user_role_enum)
    )
    ON CONFLICT (id) DO UPDATE 
    SET email = EXCLUDED.email, 
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Prevent completion of tasks if unacknowledged tags exist
CREATE OR REPLACE FUNCTION public.fn_prevent_unacknowledged_task_completion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_completed = TRUE AND (OLD.is_completed IS NULL OR OLD.is_completed = FALSE) THEN
        IF EXISTS (
            SELECT 1 FROM public.task_acknowledgements
            WHERE task_id = NEW.id AND is_acknowledged = FALSE
        ) THEN
            RAISE EXCEPTION 'Cannot complete task: Mandatory team acknowledgements remain pending.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_unacknowledged_task_completion ON public.tasks;
CREATE TRIGGER trg_prevent_unacknowledged_task_completion
    BEFORE UPDATE OF is_completed ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_unacknowledged_task_completion();


-- ==========================================================
-- 10. ROW LEVEL SECURITY — IMPENETRABLE ACCOUNT ISOLATION
-- ==========================================================
-- RULES:
-- 1. EVERY table has RLS enabled — NO EXCEPTIONS
-- 2. NO anonymous access — all policies target TO authenticated
-- 3. User-owned data is scoped strictly via auth.uid()
-- 4. Manager role has broad read access but is still scoped
-- 5. No user can EVER see, mutate, or delete another user's private data
--    unless explicitly authorized (e.g., assigned_to, team membership)
-- ==========================================================

-- STEP 1: Enable RLS on ALL tables (idempotent)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropdown_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropdown_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropdown_task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropdown_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_tag_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- STEP 2: Drop ALL existing policies (clean slate — prevents duplicates)
DROP POLICY IF EXISTS "Profiles SELECT Policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles INSERT Policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles UPDATE Policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles DELETE Policy" ON public.profiles;

DROP POLICY IF EXISTS "Dropdown Priorities SELECT" ON public.dropdown_priorities;
DROP POLICY IF EXISTS "Dropdown Priorities Admin ALL" ON public.dropdown_priorities;
DROP POLICY IF EXISTS "Dropdown Priorities INSERT" ON public.dropdown_priorities;
DROP POLICY IF EXISTS "Dropdown Priorities UPDATE" ON public.dropdown_priorities;
DROP POLICY IF EXISTS "Dropdown Priorities DELETE" ON public.dropdown_priorities;

DROP POLICY IF EXISTS "Dropdown Statuses SELECT" ON public.dropdown_statuses;
DROP POLICY IF EXISTS "Dropdown Statuses Admin ALL" ON public.dropdown_statuses;
DROP POLICY IF EXISTS "Dropdown Statuses INSERT" ON public.dropdown_statuses;
DROP POLICY IF EXISTS "Dropdown Statuses UPDATE" ON public.dropdown_statuses;
DROP POLICY IF EXISTS "Dropdown Statuses DELETE" ON public.dropdown_statuses;

DROP POLICY IF EXISTS "Dropdown Task Types SELECT" ON public.dropdown_task_types;
DROP POLICY IF EXISTS "Dropdown Task Types Admin ALL" ON public.dropdown_task_types;
DROP POLICY IF EXISTS "Dropdown Task Types INSERT" ON public.dropdown_task_types;
DROP POLICY IF EXISTS "Dropdown Task Types UPDATE" ON public.dropdown_task_types;
DROP POLICY IF EXISTS "Dropdown Task Types DELETE" ON public.dropdown_task_types;

DROP POLICY IF EXISTS "Dropdown Tags SELECT" ON public.dropdown_tags;
DROP POLICY IF EXISTS "Dropdown Tags Admin ALL" ON public.dropdown_tags;
DROP POLICY IF EXISTS "Dropdown Tags INSERT" ON public.dropdown_tags;
DROP POLICY IF EXISTS "Dropdown Tags UPDATE" ON public.dropdown_tags;
DROP POLICY IF EXISTS "Dropdown Tags DELETE" ON public.dropdown_tags;

DROP POLICY IF EXISTS "Task Tag Mapping SELECT" ON public.task_tag_mapping;
DROP POLICY IF EXISTS "Task Tag Mapping INSERT" ON public.task_tag_mapping;
DROP POLICY IF EXISTS "Task Tag Mapping DELETE" ON public.task_tag_mapping;
DROP POLICY IF EXISTS "Task Tag Mapping ALL" ON public.task_tag_mapping;

DROP POLICY IF EXISTS "Teams SELECT" ON public.teams;
DROP POLICY IF EXISTS "Teams INSERT" ON public.teams;
DROP POLICY IF EXISTS "Teams UPDATE" ON public.teams;
DROP POLICY IF EXISTS "Teams DELETE" ON public.teams;

DROP POLICY IF EXISTS "Team Members SELECT" ON public.team_members;
DROP POLICY IF EXISTS "Team Members INSERT" ON public.team_members;
DROP POLICY IF EXISTS "Team Members DELETE" ON public.team_members;

DROP POLICY IF EXISTS "Lists SELECT Policy" ON public.lists;
DROP POLICY IF EXISTS "Lists INSERT Policy" ON public.lists;
DROP POLICY IF EXISTS "Lists UPDATE Policy" ON public.lists;
DROP POLICY IF EXISTS "Lists DELETE Policy" ON public.lists;

DROP POLICY IF EXISTS "Tasks RBAC SELECT Policy" ON public.tasks;
DROP POLICY IF EXISTS "Tasks INSERT Policy" ON public.tasks;
DROP POLICY IF EXISTS "Tasks UPDATE Policy" ON public.tasks;
DROP POLICY IF EXISTS "Tasks DELETE Policy" ON public.tasks;

DROP POLICY IF EXISTS "Subtasks SELECT" ON public.subtasks;
DROP POLICY IF EXISTS "Subtasks INSERT" ON public.subtasks;
DROP POLICY IF EXISTS "Subtasks UPDATE" ON public.subtasks;
DROP POLICY IF EXISTS "Subtasks DELETE" ON public.subtasks;
DROP POLICY IF EXISTS "Subtasks ALL" ON public.subtasks;

DROP POLICY IF EXISTS "Task Ack SELECT" ON public.task_acknowledgements;
DROP POLICY IF EXISTS "Task Ack INSERT" ON public.task_acknowledgements;
DROP POLICY IF EXISTS "Task Ack STRICT UPDATE" ON public.task_acknowledgements;
DROP POLICY IF EXISTS "Task Ack DELETE" ON public.task_acknowledgements;

DROP POLICY IF EXISTS "Task Attachments SELECT Policy" ON public.task_attachments;
DROP POLICY IF EXISTS "Task Attachments INSERT Policy" ON public.task_attachments;
DROP POLICY IF EXISTS "Task Attachments DELETE Policy" ON public.task_attachments;


-- ==========================================================
-- PROFILES POLICIES
-- ==========================================================
-- SELECT: Authenticated users can read all profiles (for team member display, 
--         assignee dropdowns, etc.). This is a deliberate design choice — 
--         profile data (name, avatar, role) is not considered private.
-- INSERT: Handled by the on_auth_user_created trigger (SECURITY DEFINER).
--         No direct inserts from the client.
-- UPDATE: A user can ONLY update their OWN profile (id = auth.uid()).
--         Managers can also update any profile (for role changes, etc.).
-- DELETE: BLOCKED — profiles should never be deleted from the client.
--         They cascade-delete when the auth.users row is removed.
-- ==========================================================
CREATE POLICY "Profiles SELECT Policy" ON public.profiles
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Profiles UPDATE Policy" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id OR public.get_auth_user_role() = 'manager')
    WITH CHECK (auth.uid() = id OR public.get_auth_user_role() = 'manager');


-- ==========================================================
-- DYNAMIC DROPDOWN LOOKUP POLICIES
-- All authenticated users can read. Only Managers can write.
-- ==========================================================
CREATE POLICY "Dropdown Priorities SELECT" ON public.dropdown_priorities
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Dropdown Priorities INSERT" ON public.dropdown_priorities
    FOR INSERT TO authenticated WITH CHECK (public.get_auth_user_role() = 'manager');
CREATE POLICY "Dropdown Priorities UPDATE" ON public.dropdown_priorities
    FOR UPDATE TO authenticated
    USING (public.get_auth_user_role() = 'manager')
    WITH CHECK (public.get_auth_user_role() = 'manager');
CREATE POLICY "Dropdown Priorities DELETE" ON public.dropdown_priorities
    FOR DELETE TO authenticated USING (public.get_auth_user_role() = 'manager');

CREATE POLICY "Dropdown Statuses SELECT" ON public.dropdown_statuses
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Dropdown Statuses INSERT" ON public.dropdown_statuses
    FOR INSERT TO authenticated WITH CHECK (public.get_auth_user_role() = 'manager');
CREATE POLICY "Dropdown Statuses UPDATE" ON public.dropdown_statuses
    FOR UPDATE TO authenticated
    USING (public.get_auth_user_role() = 'manager')
    WITH CHECK (public.get_auth_user_role() = 'manager');
CREATE POLICY "Dropdown Statuses DELETE" ON public.dropdown_statuses
    FOR DELETE TO authenticated USING (public.get_auth_user_role() = 'manager');

CREATE POLICY "Dropdown Task Types SELECT" ON public.dropdown_task_types
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Dropdown Task Types INSERT" ON public.dropdown_task_types
    FOR INSERT TO authenticated WITH CHECK (public.get_auth_user_role() = 'manager');
CREATE POLICY "Dropdown Task Types UPDATE" ON public.dropdown_task_types
    FOR UPDATE TO authenticated
    USING (public.get_auth_user_role() = 'manager')
    WITH CHECK (public.get_auth_user_role() = 'manager');
CREATE POLICY "Dropdown Task Types DELETE" ON public.dropdown_task_types
    FOR DELETE TO authenticated USING (public.get_auth_user_role() = 'manager');

CREATE POLICY "Dropdown Tags SELECT" ON public.dropdown_tags
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Dropdown Tags INSERT" ON public.dropdown_tags
    FOR INSERT TO authenticated WITH CHECK (public.get_auth_user_role() = 'manager');
CREATE POLICY "Dropdown Tags UPDATE" ON public.dropdown_tags
    FOR UPDATE TO authenticated
    USING (public.get_auth_user_role() = 'manager')
    WITH CHECK (public.get_auth_user_role() = 'manager');
CREATE POLICY "Dropdown Tags DELETE" ON public.dropdown_tags
    FOR DELETE TO authenticated USING (public.get_auth_user_role() = 'manager');


-- ==========================================================
-- TASK TAG MAPPING POLICIES (Many-to-Many Junction Table)
-- ==========================================================
-- A user can see tag mappings only for tasks they can already see.
-- A user can insert/delete tag mappings only for tasks they own,
-- are assigned to, or if they are a manager.
-- ==========================================================
CREATE POLICY "Task Tag Mapping SELECT" ON public.task_tag_mapping
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = public.task_tag_mapping.task_id
              AND (
                  t.created_by = auth.uid() OR
                  t.assigned_to = auth.uid() OR
                  public.get_auth_user_role() = 'manager' OR
                  EXISTS (SELECT 1 FROM public.task_acknowledgements WHERE task_id = t.id AND user_id = auth.uid())
              )
        )
    );

CREATE POLICY "Task Tag Mapping INSERT" ON public.task_tag_mapping
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = public.task_tag_mapping.task_id
              AND (
                  t.created_by = auth.uid() OR
                  t.assigned_to = auth.uid() OR
                  public.get_auth_user_role() = 'manager'
              )
        )
    );

CREATE POLICY "Task Tag Mapping DELETE" ON public.task_tag_mapping
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = public.task_tag_mapping.task_id
              AND (
                  t.created_by = auth.uid() OR
                  t.assigned_to = auth.uid() OR
                  public.get_auth_user_role() = 'manager'
              )
        )
    );


-- ==========================================================
-- TEAMS & MEMBERS POLICIES
-- ==========================================================
-- Teams are visible to all authenticated users (needed for team selection).
-- Only the creator can insert a team. Members visible to all authenticated.
-- ==========================================================
CREATE POLICY "Teams SELECT" ON public.teams
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teams INSERT" ON public.teams
    FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Teams UPDATE" ON public.teams
    FOR UPDATE TO authenticated
    USING (created_by = auth.uid() OR public.get_auth_user_role() = 'manager')
    WITH CHECK (created_by = auth.uid() OR public.get_auth_user_role() = 'manager');
CREATE POLICY "Teams DELETE" ON public.teams
    FOR DELETE TO authenticated
    USING (created_by = auth.uid() OR public.get_auth_user_role() = 'manager');

CREATE POLICY "Team Members SELECT" ON public.team_members
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team Members INSERT" ON public.team_members
    FOR INSERT TO authenticated
    WITH CHECK (
        -- Only team creator or manager can add members
        EXISTS (
            SELECT 1 FROM public.teams WHERE id = public.team_members.team_id
            AND (created_by = auth.uid() OR public.get_auth_user_role() = 'manager')
        )
    );
CREATE POLICY "Team Members DELETE" ON public.team_members
    FOR DELETE TO authenticated
    USING (
        -- Only team creator or manager can remove members
        EXISTS (
            SELECT 1 FROM public.teams WHERE id = public.team_members.team_id
            AND (created_by = auth.uid() OR public.get_auth_user_role() = 'manager')
        )
    );


-- ==========================================================
-- LISTS ISOLATION POLICIES
-- ==========================================================
-- SELECT: Owner, manager, or team member can see lists.
-- INSERT: Only the owner (user_id = auth.uid()).
-- UPDATE: Only the owner or manager.
-- DELETE: Only the owner or manager.
-- ==========================================================
CREATE POLICY "Lists SELECT Policy" ON public.lists
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() OR 
        public.get_auth_user_role() = 'manager' OR
        (
            team_id IS NOT NULL AND 
            EXISTS (
                SELECT 1 FROM public.team_members 
                WHERE team_id = public.lists.team_id AND user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Lists INSERT Policy" ON public.lists
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Lists UPDATE Policy" ON public.lists
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR public.get_auth_user_role() = 'manager')
    WITH CHECK (user_id = auth.uid() OR public.get_auth_user_role() = 'manager');

CREATE POLICY "Lists DELETE Policy" ON public.lists
    FOR DELETE TO authenticated
    USING (user_id = auth.uid() OR public.get_auth_user_role() = 'manager');


-- ==========================================================
-- TASKS — WATERTIGHT RBAC ISOLATION
-- ==========================================================
-- SELECT: A user can see a task ONLY if:
--   1. They are a manager (full visibility), OR
--   2. They created the task (created_by = auth.uid()), OR
--   3. They are assigned to the task (assigned_to = auth.uid()), OR
--   4. They have a pending/completed acknowledgement on the task, OR
--   5. The task belongs to a list they own or are a team member of
-- INSERT: created_by MUST equal auth.uid(). Members can only self-assign.
-- UPDATE: creator, assignee, acknowledged user, or manager.
-- DELETE: creator or manager ONLY.
-- ==========================================================
CREATE POLICY "Tasks RBAC SELECT Policy" ON public.tasks
    FOR SELECT TO authenticated
    USING (
        public.get_auth_user_role() = 'manager' OR
        created_by = auth.uid() OR
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.task_acknowledgements 
            WHERE task_id = public.tasks.id AND user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.lists 
            WHERE id = public.tasks.list_id AND (
                user_id = auth.uid() OR 
                team_id IN (
                    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "Tasks INSERT Policy" ON public.tasks
    FOR INSERT TO authenticated
    WITH CHECK (
        -- CRITICAL: You can only create tasks as yourself
        created_by = auth.uid() AND (
            -- Managers/deputies can assign to anyone
            public.get_auth_user_role() IN ('manager', 'deputy_manager') OR
            -- Members can only self-assign or leave unassigned
            assigned_to IS NULL OR
            assigned_to = auth.uid()
        )
    );

CREATE POLICY "Tasks UPDATE Policy" ON public.tasks
    FOR UPDATE TO authenticated
    USING (
        created_by = auth.uid() OR
        assigned_to = auth.uid() OR
        public.get_auth_user_role() = 'manager' OR
        EXISTS (
            SELECT 1 FROM public.task_acknowledgements 
            WHERE task_id = public.tasks.id AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        created_by = auth.uid() OR
        assigned_to = auth.uid() OR
        public.get_auth_user_role() = 'manager' OR
        EXISTS (
            SELECT 1 FROM public.task_acknowledgements 
            WHERE task_id = public.tasks.id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Tasks DELETE Policy" ON public.tasks
    FOR DELETE TO authenticated
    USING (
        created_by = auth.uid() OR public.get_auth_user_role() = 'manager'
    );


-- ==========================================================
-- SUBTASKS POLICIES
-- ==========================================================
-- Subtasks inherit access from their parent task.
-- A user can see/modify subtasks only for tasks they can access.
-- ==========================================================
CREATE POLICY "Subtasks SELECT" ON public.subtasks
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = public.subtasks.task_id
              AND (
                  t.created_by = auth.uid() OR
                  t.assigned_to = auth.uid() OR
                  public.get_auth_user_role() = 'manager' OR
                  EXISTS (SELECT 1 FROM public.task_acknowledgements WHERE task_id = t.id AND user_id = auth.uid())
              )
        )
    );

CREATE POLICY "Subtasks INSERT" ON public.subtasks
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = public.subtasks.task_id
              AND (
                  t.created_by = auth.uid() OR
                  t.assigned_to = auth.uid() OR
                  public.get_auth_user_role() = 'manager'
              )
        )
    );

CREATE POLICY "Subtasks UPDATE" ON public.subtasks
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = public.subtasks.task_id
              AND (
                  t.created_by = auth.uid() OR
                  t.assigned_to = auth.uid() OR
                  public.get_auth_user_role() = 'manager' OR
                  EXISTS (SELECT 1 FROM public.task_acknowledgements WHERE task_id = t.id AND user_id = auth.uid())
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = public.subtasks.task_id
              AND (
                  t.created_by = auth.uid() OR
                  t.assigned_to = auth.uid() OR
                  public.get_auth_user_role() = 'manager' OR
                  EXISTS (SELECT 1 FROM public.task_acknowledgements WHERE task_id = t.id AND user_id = auth.uid())
              )
        )
    );

CREATE POLICY "Subtasks DELETE" ON public.subtasks
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = public.subtasks.task_id
              AND (
                  t.created_by = auth.uid() OR
                  t.assigned_to = auth.uid() OR
                  public.get_auth_user_role() = 'manager'
              )
        )
    );


-- ==========================================================
-- TASK ACKNOWLEDGEMENTS POLICIES
-- ==========================================================
-- SELECT: Visible to users who can see the parent task.
-- INSERT: Managers/task creators can tag team members for acknowledgement.
-- UPDATE: STRICT — ONLY the tagged user can acknowledge their own record.
--         user_id MUST equal auth.uid(). No one else can flip this flag.
-- DELETE: Only task creator or manager.
-- ==========================================================
CREATE POLICY "Task Ack SELECT" ON public.task_acknowledgements
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = public.task_acknowledgements.task_id
              AND (
                  t.created_by = auth.uid() OR
                  t.assigned_to = auth.uid() OR
                  public.get_auth_user_role() = 'manager'
              )
        )
    );

CREATE POLICY "Task Ack INSERT" ON public.task_acknowledgements
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = public.task_acknowledgements.task_id
              AND (
                  t.created_by = auth.uid() OR
                  public.get_auth_user_role() = 'manager'
              )
        )
    );

CREATE POLICY "Task Ack STRICT UPDATE" ON public.task_acknowledgements
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Task Ack DELETE" ON public.task_acknowledgements
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = public.task_acknowledgements.task_id
              AND (t.created_by = auth.uid() OR public.get_auth_user_role() = 'manager')
        )
    );


-- ==========================================================
-- TASK ATTACHMENTS POLICIES
-- ==========================================================
-- SELECT: Visible to manager, uploader, or task participant.
-- INSERT: Only the uploader (uploaded_by = auth.uid()).
-- DELETE: Only the uploader or manager.
-- ==========================================================
CREATE POLICY "Task Attachments SELECT Policy" ON public.task_attachments
    FOR SELECT TO authenticated
    USING (
        public.get_auth_user_role() = 'manager' OR
        uploaded_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = public.task_attachments.task_id AND (
                t.created_by = auth.uid() OR
                t.assigned_to = auth.uid() OR
                EXISTS (SELECT 1 FROM public.task_acknowledgements WHERE task_id = t.id AND user_id = auth.uid())
            )
        )
    );

CREATE POLICY "Task Attachments INSERT Policy" ON public.task_attachments
    FOR INSERT TO authenticated
    WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Task Attachments DELETE Policy" ON public.task_attachments
    FOR DELETE TO authenticated
    USING (
        uploaded_by = auth.uid() OR public.get_auth_user_role() = 'manager'
    );
