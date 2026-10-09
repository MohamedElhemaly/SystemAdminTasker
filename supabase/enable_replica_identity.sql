-- ==============================================================================
-- 🔒 ENABLE FULL PAYLOADS FOR REALTIME DELETES
-- ==============================================================================
-- By default, PostgreSQL does not send the full row data during a DELETE event.
-- It only sends the Primary Key. To trigger UI updates when a user is removed,
-- we must tell PostgreSQL to send the full row payload (including user_id).
-- ==============================================================================

ALTER TABLE public.team_members REPLICA IDENTITY FULL;
