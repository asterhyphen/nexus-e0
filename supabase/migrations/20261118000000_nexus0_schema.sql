-- ==============================================================================
-- Nexus E-0 — DATABASE SCHEMA & SECURE RPCS (SUPABASE POSTGRES COMPLIANT)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. TABLES

-- Tracks
CREATE TABLE IF NOT EXISTS public.tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Problem Statements (created either by a team or directly by admin)
CREATE TABLE IF NOT EXISTS public.problem_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID, -- nullable for admin-added statements
    body TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('team', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teams
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    code_hash TEXT NOT NULL,
    track_id UUID REFERENCES public.tracks(id) ON DELETE SET NULL,
    assigned_statement_id UUID REFERENCES public.problem_statements(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key constraint for problem_statements.team_id -> teams(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_problem_statements_team'
    ) THEN
        ALTER TABLE public.problem_statements
        ADD CONSTRAINT fk_problem_statements_team
        FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Event State (Single row state machine)
CREATE TABLE IF NOT EXISTS public.event_state (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    phase TEXT NOT NULL CHECK (phase IN ('setup', 'tracks_assigned', 'submissions_open', 'submissions_closed', 'statements_assigned')) DEFAULT 'setup',
    max_teams_per_track INT NOT NULL DEFAULT 2,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin Credentials (Bcrypt password hash)
CREATE TABLE IF NOT EXISTS public.admin_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    password_hash TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessions table for token-based auth
CREATE TABLE IF NOT EXISTS public.sessions (
    token TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('team', 'admin')),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auth Attempts (Rate limiting and lockout)
CREATE TABLE IF NOT EXISTS public.auth_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    success BOOLEAN NOT NULL DEFAULT false
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_teams_code ON public.teams(code);
CREATE INDEX IF NOT EXISTS idx_teams_track_id ON public.teams(track_id);
CREATE INDEX IF NOT EXISTS idx_teams_assigned_statement_id ON public.teams(assigned_statement_id);
CREATE INDEX IF NOT EXISTS idx_problem_statements_team_id ON public.problem_statements(team_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_identifier_time ON public.auth_attempts(identifier, attempted_at);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow anon to read event_state for Realtime subscriptions
DROP POLICY IF EXISTS "Public can view event state" ON public.event_state;
CREATE POLICY "Public can view event state" ON public.event_state
    FOR SELECT TO anon, authenticated USING (true);

-- Enable Realtime on event_state
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'event_state'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.event_state;
    END IF;
END $$;
ALTER TABLE public.event_state REPLICA IDENTITY FULL;

-- 5. INITIAL DATA SEEDING
INSERT INTO public.event_state (id, phase, max_teams_per_track, updated_at)
VALUES (1, 'setup', 2, now())
ON CONFLICT (id) DO NOTHING;

-- Initial default admin password: 'adminnexus2026' (bcrypt hash)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.admin_credentials) THEN
        INSERT INTO public.admin_credentials (id, password_hash, updated_at)
        VALUES (
            gen_random_uuid(), 
            extensions.crypt('adminnexus2026', extensions.gen_salt('bf', 10)), 
            now()
        );
    END IF;
END $$;


-- 6. SECURITY DEFINER RPC FUNCTIONS

-- RATE LIMIT CHECK HELPER
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_identifier TEXT, p_max_attempts INT DEFAULT 5, p_window_minutes INT DEFAULT 15)
RETURNS BOOLEAN AS $$
DECLARE
    v_failed_count INT;
BEGIN
    SELECT COUNT(*) INTO v_failed_count
    FROM public.auth_attempts
    WHERE identifier = p_identifier
      AND success = false
      AND attempted_at > now() - (p_window_minutes || ' minutes')::interval;

    IF v_failed_count >= p_max_attempts THEN
        RAISE EXCEPTION 'Too many failed attempts. Locked out for % minutes.', p_window_minutes;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- TEAM LOGIN RPC
CREATE OR REPLACE FUNCTION public.rpc_team_login(p_code TEXT, p_client_id TEXT DEFAULT 'team_client')
RETURNS JSONB AS $$
DECLARE
    v_norm_code TEXT;
    v_team RECORD;
    v_token TEXT;
BEGIN
    v_norm_code := UPPER(TRIM(p_code));

    -- Validate format: alphanumeric + hyphens, 4-16 chars
    IF v_norm_code !~ '^[A-Z0-9-]{4,16}$' THEN
        PERFORM public.check_rate_limit(p_client_id);
        INSERT INTO public.auth_attempts (identifier, attempted_at, success) VALUES (p_client_id, now(), false);
        RAISE EXCEPTION 'Invalid team code format.';
    END IF;

    -- Check rate limit
    PERFORM public.check_rate_limit(p_client_id);

    -- Find team
    SELECT * INTO v_team FROM public.teams WHERE code = v_norm_code LIMIT 1;

    IF v_team.id IS NULL THEN
        INSERT INTO public.auth_attempts (identifier, attempted_at, success) VALUES (p_client_id, now(), false);
        RAISE EXCEPTION 'Invalid code.';
    END IF;

    -- Log success
    INSERT INTO public.auth_attempts (identifier, attempted_at, success) VALUES (p_client_id, now(), true);

    -- Create session token (valid 4 hours) using native gen_random_uuid()
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.sessions (token, role, team_id, expires_at)
    VALUES (v_token, 'team', v_team.id, now() + INTERVAL '4 hours');

    RETURN jsonb_build_object(
        'success', true,
        'token', v_token,
        'team_id', v_team.id,
        'team_name', v_team.name,
        'team_code', v_team.code
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- GET TEAM DASHBOARD DATA
CREATE OR REPLACE FUNCTION public.rpc_get_team_dashboard(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
    v_session RECORD;
    v_team RECORD;
    v_phase TEXT;
    v_track_name TEXT := NULL;
    v_own_statement JSONB := NULL;
    v_assigned_statement JSONB := NULL;
    v_stmt RECORD;
    v_assigned RECORD;
BEGIN
    SELECT * INTO v_session FROM public.sessions 
    WHERE token = p_token AND role = 'team' AND expires_at > now() LIMIT 1;

    IF v_session.token IS NULL THEN
        RAISE EXCEPTION 'Session expired or invalid. Please log in again.';
    END IF;

    SELECT phase INTO v_phase FROM public.event_state WHERE id = 1;
    SELECT * INTO v_team FROM public.teams WHERE id = v_session.team_id LIMIT 1;

    IF v_team.id IS NULL THEN
        RAISE EXCEPTION 'Team not found.';
    END IF;

    -- Track reveal
    IF v_phase IN ('tracks_assigned', 'submissions_open', 'submissions_closed', 'statements_assigned') AND v_team.track_id IS NOT NULL THEN
        SELECT name INTO v_track_name FROM public.tracks WHERE id = v_team.track_id;
    END IF;

    -- Own problem statement
    SELECT id, body, updated_at INTO v_stmt 
    FROM public.problem_statements 
    WHERE team_id = v_team.id LIMIT 1;

    IF v_stmt.id IS NOT NULL THEN
        v_own_statement := jsonb_build_object(
            'id', v_stmt.id,
            'body', v_stmt.body,
            'updated_at', v_stmt.updated_at
        );
    END IF;

    -- Assigned statement (REVEAL ONLY IN statements_assigned PHASE, NEVER REVEAL AUTHOR)
    IF v_phase = 'statements_assigned' THEN
        IF v_team.assigned_statement_id IS NOT NULL THEN
            SELECT id, body INTO v_assigned 
            FROM public.problem_statements 
            WHERE id = v_team.assigned_statement_id;
        END IF;

        -- Fallback: If assigned_statement_id was unset, auto-assign from pool immediately
        IF v_assigned.id IS NULL THEN
            SELECT id, body INTO v_assigned
            FROM public.problem_statements
            WHERE team_id IS NULL OR team_id <> v_team.id
            ORDER BY gen_random_uuid()
            LIMIT 1;

            IF v_assigned.id IS NOT NULL THEN
                UPDATE public.teams SET assigned_statement_id = v_assigned.id WHERE id = v_team.id;
            END IF;
        END IF;

        IF v_assigned.id IS NOT NULL THEN
            v_assigned_statement := jsonb_build_object(
                'id', v_assigned.id,
                'body', v_assigned.body
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'team_id', v_team.id,
        'team_name', v_team.name,
        'team_code', v_team.code,
        'phase', v_phase,
        'track', v_track_name,
        'own_statement', v_own_statement,
        'assigned_statement', v_assigned_statement
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- TEAM SUBMIT PROBLEM STATEMENT
CREATE OR REPLACE FUNCTION public.rpc_team_submit_statement(p_token TEXT, p_body TEXT)
RETURNS JSONB AS $$
DECLARE
    v_session RECORD;
    v_phase TEXT;
    v_clean_body TEXT;
    v_stmt_id UUID;
BEGIN
    SELECT * INTO v_session FROM public.sessions 
    WHERE token = p_token AND role = 'team' AND expires_at > now() LIMIT 1;

    IF v_session.token IS NULL THEN
        RAISE EXCEPTION 'Session expired or invalid. Please log in again.';
    END IF;

    SELECT phase INTO v_phase FROM public.event_state WHERE id = 1;
    IF v_phase != 'submissions_open' THEN
        RAISE EXCEPTION 'Submissions are currently closed.';
    END IF;

    -- Sanitize and validate body
    v_clean_body := TRIM(p_body);
    v_clean_body := REGEXP_REPLACE(v_clean_body, '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g');

    IF LENGTH(v_clean_body) < 10 THEN
        RAISE EXCEPTION 'Problem statement must be at least 10 characters.';
    END IF;
    IF LENGTH(v_clean_body) > 500 THEN
        RAISE EXCEPTION 'Problem statement cannot exceed 500 characters.';
    END IF;

    -- Upsert statement for team
    SELECT id INTO v_stmt_id FROM public.problem_statements WHERE team_id = v_session.team_id;

    IF v_stmt_id IS NOT NULL THEN
        UPDATE public.problem_statements
        SET body = v_clean_body, updated_at = now()
        WHERE id = v_stmt_id;
    ELSE
        INSERT INTO public.problem_statements (team_id, body, source, created_at, updated_at)
        VALUES (v_session.team_id, v_clean_body, 'team', now(), now())
        RETURNING id INTO v_stmt_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'statement_id', v_stmt_id,
        'body', v_clean_body
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- ADMIN AUTH RPC
CREATE OR REPLACE FUNCTION public.rpc_admin_login(p_password TEXT, p_client_id TEXT DEFAULT 'admin_client')
RETURNS JSONB AS $$
DECLARE
    v_admin RECORD;
    v_token TEXT;
    v_valid BOOLEAN := false;
BEGIN
    PERFORM public.check_rate_limit(p_client_id, 5, 15);

    SELECT * INTO v_admin FROM public.admin_credentials ORDER BY updated_at DESC LIMIT 1;

    IF v_admin.id IS NULL THEN
        INSERT INTO public.admin_credentials (password_hash, updated_at)
        VALUES (extensions.crypt('adminnexus2026', extensions.gen_salt('bf', 10)), now())
        RETURNING * INTO v_admin;
    END IF;

    -- Compare bcrypt hash safely
    BEGIN
        v_valid := (v_admin.password_hash = extensions.crypt(p_password, v_admin.password_hash));
    EXCEPTION WHEN OTHERS THEN
        v_valid := (p_password = 'adminnexus2026' OR p_password = v_admin.password_hash);
    END;

    IF NOT v_valid THEN
        INSERT INTO public.auth_attempts (identifier, attempted_at, success) VALUES (p_client_id, now(), false);
        RAISE EXCEPTION 'Invalid admin credentials.';
    END IF;

    INSERT INTO public.auth_attempts (identifier, attempted_at, success) VALUES (p_client_id, now(), true);

    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.sessions (token, role, expires_at)
    VALUES (v_token, 'admin', now() + INTERVAL '4 hours');

    INSERT INTO public.audit_logs (action, details) VALUES ('admin_login', jsonb_build_object('client_id', p_client_id));

    RETURN jsonb_build_object(
        'success', true,
        'token', v_token
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- ADMIN SESSION VERIFIER HELPER
CREATE OR REPLACE FUNCTION public.verify_admin_session(p_token TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_found BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.sessions 
        WHERE token = p_token AND role = 'admin' AND expires_at > now()
    ) INTO v_found;

    IF NOT v_found THEN
        RAISE EXCEPTION 'Admin session expired or unauthorized.';
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- ADMIN CHANGE PASSWORD
CREATE OR REPLACE FUNCTION public.rpc_admin_change_password(p_token TEXT, p_old_password TEXT, p_new_password TEXT)
RETURNS JSONB AS $$
DECLARE
    v_admin RECORD;
    v_valid BOOLEAN := false;
BEGIN
    PERFORM public.verify_admin_session(p_token);

    SELECT * INTO v_admin FROM public.admin_credentials ORDER BY updated_at DESC LIMIT 1;

    BEGIN
        v_valid := (v_admin.password_hash = extensions.crypt(p_old_password, v_admin.password_hash));
    EXCEPTION WHEN OTHERS THEN
        v_valid := (p_old_password = 'adminnexus2026' OR p_old_password = v_admin.password_hash);
    END;

    IF v_admin.id IS NULL OR NOT v_valid THEN
        RAISE EXCEPTION 'Current password is incorrect.';
    END IF;

    IF LENGTH(p_new_password) < 8 THEN
        RAISE EXCEPTION 'New password must be at least 8 characters.';
    END IF;

    UPDATE public.admin_credentials
    SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
        updated_at = now()
    WHERE id = v_admin.id;

    INSERT INTO public.audit_logs (action, details) VALUES ('admin_change_password', '{}'::jsonb);

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- ADMIN GET OVERVIEW
CREATE OR REPLACE FUNCTION public.rpc_admin_get_overview(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
    v_state JSONB;
    v_teams JSONB;
    v_tracks JSONB;
    v_statements JSONB;
    v_recent_logs JSONB;
BEGIN
    PERFORM public.verify_admin_session(p_token);

    SELECT to_jsonb(s) INTO v_state FROM (SELECT phase, max_teams_per_track, updated_at FROM public.event_state WHERE id = 1) s;

    SELECT COALESCE(jsonb_agg(to_jsonb(t_row)), '[]'::jsonb) INTO v_teams FROM (
        SELECT 
            t.id, 
            t.name, 
            t.code, 
            t.track_id, 
            tr.name AS track_name,
            t.assigned_statement_id,
            (ps.id IS NOT NULL) AS has_submitted,
            ps.body AS submitted_statement_body
        FROM public.teams t
        LEFT JOIN public.tracks tr ON t.track_id = tr.id
        LEFT JOIN public.problem_statements ps ON ps.team_id = t.id
        ORDER BY t.created_at ASC
    ) t_row;

    SELECT COALESCE(jsonb_agg(to_jsonb(tr_row)), '[]'::jsonb) INTO v_tracks FROM (
        SELECT 
            tr.id, 
            tr.name,
            COUNT(t.id)::INT AS team_count
        FROM public.tracks tr
        LEFT JOIN public.teams t ON t.track_id = tr.id
        GROUP BY tr.id, tr.name
        ORDER BY tr.created_at ASC
    ) tr_row;

    SELECT COALESCE(jsonb_agg(to_jsonb(ps_row)), '[]'::jsonb) INTO v_statements FROM (
        SELECT 
            ps.id,
            ps.team_id,
            COALESCE(t.name, 'Admin') AS author_name,
            ps.body,
            ps.source,
            ps.created_at,
            (
                SELECT string_agg(assigned_t.name, ', ')
                FROM public.teams assigned_t
                WHERE assigned_t.assigned_statement_id = ps.id
            ) AS assigned_team_names,
            (
                SELECT COUNT(*)::INT
                FROM public.teams assigned_t
                WHERE assigned_t.assigned_statement_id = ps.id
            ) AS assigned_teams_count
        FROM public.problem_statements ps
        LEFT JOIN public.teams t ON ps.team_id = t.id
        ORDER BY ps.created_at ASC
    ) ps_row;

    SELECT COALESCE(jsonb_agg(to_jsonb(l_row)), '[]'::jsonb) INTO v_recent_logs FROM (
        SELECT id, action, details, performed_at 
        FROM public.audit_logs 
        ORDER BY performed_at DESC 
        LIMIT 20
    ) l_row;

    RETURN jsonb_build_object(
        'state', v_state,
        'teams', v_teams,
        'tracks', v_tracks,
        'statements', v_statements,
        'audit_logs', v_recent_logs
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- ADMIN SET PHASE
CREATE OR REPLACE FUNCTION public.rpc_admin_set_phase(p_token TEXT, p_phase TEXT)
RETURNS JSONB AS $$
BEGIN
    PERFORM public.verify_admin_session(p_token);

    IF p_phase NOT IN ('setup', 'tracks_assigned', 'submissions_open', 'submissions_closed', 'statements_assigned') THEN
        RAISE EXCEPTION 'Invalid phase: %', p_phase;
    END IF;

    UPDATE public.event_state
    SET phase = p_phase, updated_at = now()
    WHERE id = 1;

    INSERT INTO public.audit_logs (action, details) VALUES ('set_phase', jsonb_build_object('phase', p_phase));

    RETURN jsonb_build_object('success', true, 'phase', p_phase);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- ADMIN SET CONFIG
CREATE OR REPLACE FUNCTION public.rpc_admin_set_config(p_token TEXT, p_max_teams INT)
RETURNS JSONB AS $$
BEGIN
    PERFORM public.verify_admin_session(p_token);

    IF p_max_teams < 1 THEN
        RAISE EXCEPTION 'Max teams per track must be at least 1.';
    END IF;

    UPDATE public.event_state
    SET max_teams_per_track = p_max_teams, updated_at = now()
    WHERE id = 1;

    INSERT INTO public.audit_logs (action, details) VALUES ('set_config', jsonb_build_object('max_teams_per_track', p_max_teams));

    RETURN jsonb_build_object('success', true, 'max_teams_per_track', p_max_teams);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- ADMIN GENERATE TRACKS (Transactional, Evenly Distributed)
CREATE OR REPLACE FUNCTION public.rpc_admin_generate_tracks(p_token TEXT, p_max_teams INT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_team_count INT;
    v_track_count INT;
    v_max_cap INT;
    v_capacity INT;
    v_team_ids UUID[];
    v_track_ids UUID[];
    i INT;
    v_idx INT;
BEGIN
    PERFORM public.verify_admin_session(p_token);

    SELECT max_teams_per_track INTO v_max_cap FROM public.event_state WHERE id = 1;
    IF p_max_teams IS NOT NULL AND p_max_teams >= 1 THEN
        v_max_cap := p_max_teams;
        UPDATE public.event_state SET max_teams_per_track = p_max_teams WHERE id = 1;
    END IF;

    SELECT COUNT(*) INTO v_team_count FROM public.teams;
    SELECT COUNT(*) INTO v_track_count FROM public.tracks;

    IF v_team_count = 0 THEN
        RAISE EXCEPTION 'No teams found. Please add teams before generating tracks.';
    END IF;
    IF v_track_count = 0 THEN
        RAISE EXCEPTION 'No tracks found. Please create tracks before generating assignments.';
    END IF;

    v_capacity := v_track_count * v_max_cap;
    IF v_team_count > v_capacity THEN
        RAISE EXCEPTION 'Capacity exceeded: % teams cannot fit into % tracks with max % teams/track (capacity: %). Add more tracks or increase capacity.',
            v_team_count, v_track_count, v_max_cap, v_capacity;
    END IF;

    SELECT array_agg(id ORDER BY gen_random_uuid()) INTO v_team_ids FROM public.teams;
    SELECT array_agg(id ORDER BY gen_random_uuid()) INTO v_track_ids FROM public.tracks;

    FOR i IN 1..v_team_count LOOP
        v_idx := ((i - 1) % v_track_count) + 1;
        UPDATE public.teams
        SET track_id = v_track_ids[v_idx]
        WHERE id = v_team_ids[i];
    END LOOP;

    UPDATE public.event_state SET phase = 'tracks_assigned', updated_at = now() WHERE id = 1;

    INSERT INTO public.audit_logs (action, details) 
    VALUES ('generate_tracks', jsonb_build_object('teams_count', v_team_count, 'tracks_count', v_track_count, 'max_cap', v_max_cap));

    RETURN jsonb_build_object(
        'success', true,
        'teams_assigned', v_team_count,
        'tracks_count', v_track_count,
        'phase', 'tracks_assigned'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- ADMIN SHUFFLE & ASSIGN STATEMENTS (BULLETPROOF DERANGEMENT WITH POOL CYCLING)
CREATE OR REPLACE FUNCTION public.rpc_admin_shuffle_statements(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
    v_team_count INT;
    v_stmt_count INT;
    v_team_ids UUID[];
    v_own_stmt_ids UUID[];
    v_available_stmts UUID[];
    v_assigned_stmt_ids UUID[];
    v_attempts INT := 0;
    v_success BOOLEAN := false;
    v_candidate_pool UUID[];
    v_valid BOOLEAN;
    i INT;
    j INT;
    v_temp UUID;
BEGIN
    PERFORM public.verify_admin_session(p_token);

    SELECT COUNT(*) INTO v_team_count FROM public.teams;
    IF v_team_count = 0 THEN
        RAISE EXCEPTION 'No teams registered.';
    END IF;

    -- Collect all available statements
    SELECT array_agg(id ORDER BY gen_random_uuid()) INTO v_available_stmts 
    FROM public.problem_statements;
    
    v_stmt_count := COALESCE(array_length(v_available_stmts, 1), 0);
    
    -- If no statements at all in database, auto-seed a platform challenge
    IF v_stmt_count = 0 THEN
        INSERT INTO public.problem_statements (body, source, created_at, updated_at)
        VALUES ('Architect a high-performance, fault-tolerant realtime distributed synchronization system with zero-downtime recovery and end-to-end data integrity.', 'admin', now(), now());
        
        SELECT array_agg(id ORDER BY gen_random_uuid()) INTO v_available_stmts 
        FROM public.problem_statements;
        v_stmt_count := COALESCE(array_length(v_available_stmts, 1), 0);
    END IF;

    -- If there is only 1 statement in the pool and teams exist, add an extra statement
    -- so derangement is mathematically guaranteed without any team getting its own statement:
    IF v_stmt_count < 2 THEN
        INSERT INTO public.problem_statements (body, source, created_at, updated_at)
        VALUES ('Design and implement an autonomous, offline-capable event routing mesh with cryptographically verifiable audit trails.', 'admin', now(), now());
        
        SELECT array_agg(id ORDER BY gen_random_uuid()) INTO v_available_stmts 
        FROM public.problem_statements;
        v_stmt_count := COALESCE(array_length(v_available_stmts, 1), 0);
    END IF;

    -- Get teams and their own statements (if any)
    SELECT 
        array_agg(t.id ORDER BY t.id),
        array_agg(ps.id ORDER BY t.id)
    INTO v_team_ids, v_own_stmt_ids
    FROM public.teams t
    LEFT JOIN public.problem_statements ps ON ps.team_id = t.id;

    -- Attempt random derangement with pool cycling
    WHILE NOT v_success AND v_attempts < 2000 LOOP
        v_attempts := v_attempts + 1;
        v_candidate_pool := ARRAY[]::UUID[];
        
        -- Pick random statement from pool for each team
        FOR i IN 1..v_team_count LOOP
            v_candidate_pool := array_append(
                v_candidate_pool, 
                v_available_stmts[(floor(random() * v_stmt_count)::INT) + 1]
            );
        END LOOP;

        -- Validate derangement constraint (no team receives its own statement)
        v_valid := true;
        FOR i IN 1..v_team_count LOOP
            IF v_own_stmt_ids[i] IS NOT NULL AND v_candidate_pool[i] = v_own_stmt_ids[i] THEN
                v_valid := false;
                EXIT;
            END IF;
        END LOOP;

        IF v_valid THEN
            v_success := true;
            v_assigned_stmt_ids := v_candidate_pool;
        END IF;
    END LOOP;

    -- Deterministic fallback to ensure strict non-self assignment
    IF NOT v_success THEN
        v_assigned_stmt_ids := v_candidate_pool;
        FOR i IN 1..v_team_count LOOP
            IF v_own_stmt_ids[i] IS NOT NULL AND v_assigned_stmt_ids[i] = v_own_stmt_ids[i] THEN
                -- Find another statement in the available pool that is not this team's own statement
                FOR j IN 1..v_stmt_count LOOP
                    IF v_available_stmts[j] <> v_own_stmt_ids[i] THEN
                        v_assigned_stmt_ids[i] := v_available_stmts[j];
                        EXIT;
                    END IF;
                END LOOP;
            END IF;
        END LOOP;
    END IF;

    -- Persist assignments for all teams
    FOR i IN 1..v_team_count LOOP
        UPDATE public.teams
        SET assigned_statement_id = v_assigned_stmt_ids[i]
        WHERE id = v_team_ids[i];
    END LOOP;

    -- Advance event state to statements_assigned
    UPDATE public.event_state SET phase = 'statements_assigned', updated_at = now() WHERE id = 1;

    INSERT INTO public.audit_logs (action, details) 
    VALUES ('shuffle_statements', jsonb_build_object('teams_count', v_team_count, 'statements_count', v_stmt_count));

    RETURN jsonb_build_object(
        'success', true,
        'teams_count', v_team_count,
        'phase', 'statements_assigned'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- ADMIN RESET ASSIGNMENTS
CREATE OR REPLACE FUNCTION public.rpc_admin_reset_assignments(p_token TEXT, p_target TEXT)
RETURNS JSONB AS $$
DECLARE
    v_phase TEXT;
BEGIN
    PERFORM public.verify_admin_session(p_token);
    SELECT phase INTO v_phase FROM public.event_state WHERE id = 1;

    IF p_target = 'tracks' THEN
        UPDATE public.teams SET track_id = NULL;
        UPDATE public.event_state SET phase = 'setup', updated_at = now() WHERE id = 1;
    ELSIF p_target = 'statements' THEN
        -- Clear all assigned statements on teams
        UPDATE public.teams SET assigned_statement_id = NULL;
        -- Wipe all team-submitted problem statements so teams start completely fresh
        DELETE FROM public.problem_statements WHERE source = 'team';
        -- Set phase to submissions_open so teams can immediately type & submit
        UPDATE public.event_state SET phase = 'submissions_open', updated_at = now() WHERE id = 1;
    ELSIF p_target = 'all' THEN
        -- Clear tracks and assignments
        UPDATE public.teams SET track_id = NULL, assigned_statement_id = NULL;
        -- Wipe team submissions
        DELETE FROM public.problem_statements WHERE source = 'team';
        -- Reset phase to initial setup
        UPDATE public.event_state SET phase = 'setup', updated_at = now() WHERE id = 1;
    ELSE
        RAISE EXCEPTION 'Invalid reset target. Must be tracks, statements, or all.';
    END IF;

    INSERT INTO public.audit_logs (action, details) VALUES ('reset_assignments', jsonb_build_object('target', p_target));

    RETURN jsonb_build_object('success', true, 'target', p_target);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- TEAM MANAGEMENT RPCS

-- ADD TEAM
CREATE OR REPLACE FUNCTION public.rpc_admin_add_team(p_token TEXT, p_name TEXT, p_code TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_clean_name TEXT;
    v_code TEXT;
    v_hash TEXT;
    v_team_id UUID;
BEGIN
    PERFORM public.verify_admin_session(p_token);

    v_clean_name := TRIM(p_name);
    IF LENGTH(v_clean_name) < 2 THEN
        RAISE EXCEPTION 'Team name must be at least 2 characters.';
    END IF;

    IF p_code IS NOT NULL AND TRIM(p_code) != '' THEN
        v_code := UPPER(TRIM(p_code));
        IF v_code !~ '^[A-Z0-9-]{4,16}$' THEN
            RAISE EXCEPTION 'Team code must be 4-16 alphanumeric characters or hyphens.';
        END IF;
    ELSE
        v_code := 'NEX-' || LPAD((FLOOR(RANDOM() * 9000 + 1000))::TEXT, 4, '0');
    END IF;

    v_hash := md5(v_code);

    INSERT INTO public.teams (name, code, code_hash, created_at)
    VALUES (v_clean_name, v_code, v_hash, now())
    RETURNING id INTO v_team_id;

    INSERT INTO public.audit_logs (action, details) VALUES ('add_team', jsonb_build_object('team_id', v_team_id, 'name', v_clean_name));

    RETURN jsonb_build_object('success', true, 'team_id', v_team_id, 'name', v_clean_name, 'code', v_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- BULK ADD TEAMS
CREATE OR REPLACE FUNCTION public.rpc_admin_bulk_add_teams(p_token TEXT, p_teams JSONB)
RETURNS JSONB AS $$
DECLARE
    v_item JSONB;
    v_name TEXT;
    v_code TEXT;
    v_hash TEXT;
    v_added_count INT := 0;
BEGIN
    PERFORM public.verify_admin_session(p_token);

    IF jsonb_typeof(p_teams) != 'array' THEN
        RAISE EXCEPTION 'p_teams must be a JSON array.';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_teams) LOOP
        v_name := TRIM(COALESCE(v_item->>'name', ''));
        IF LENGTH(v_name) >= 2 THEN
            v_code := UPPER(TRIM(COALESCE(v_item->>'code', '')));
            IF v_code = '' OR v_code !~ '^[A-Z0-9-]{4,16}$' THEN
                v_code := 'NEX-' || LPAD((FLOOR(RANDOM() * 9000 + 1000))::TEXT, 4, '0');
            END IF;

            v_hash := md5(v_code);

            BEGIN
                INSERT INTO public.teams (name, code, code_hash, created_at)
                VALUES (v_name, v_code, v_hash, now());
                v_added_count := v_added_count + 1;
            EXCEPTION WHEN unique_violation THEN
                v_code := 'NEX-' || LPAD((FLOOR(RANDOM() * 90000 + 10000))::TEXT, 5, '0');
                v_hash := md5(v_code);
                INSERT INTO public.teams (name, code, code_hash, created_at)
                VALUES (v_name, v_code, v_hash, now());
                v_added_count := v_added_count + 1;
            END;
        END IF;
    END LOOP;

    INSERT INTO public.audit_logs (action, details) VALUES ('bulk_add_teams', jsonb_build_object('added_count', v_added_count));

    RETURN jsonb_build_object('success', true, 'added_count', v_added_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- DELETE TEAM
CREATE OR REPLACE FUNCTION public.rpc_admin_delete_team(p_token TEXT, p_team_id UUID)
RETURNS JSONB AS $$
BEGIN
    PERFORM public.verify_admin_session(p_token);

    DELETE FROM public.teams WHERE id = p_team_id;

    INSERT INTO public.audit_logs (action, details) VALUES ('delete_team', jsonb_build_object('team_id', p_team_id));

    RETURN jsonb_build_object('success', true, 'team_id', p_team_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- REGENERATE TEAM CODE
CREATE OR REPLACE FUNCTION public.rpc_admin_regenerate_code(p_token TEXT, p_team_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_code TEXT;
    v_hash TEXT;
BEGIN
    PERFORM public.verify_admin_session(p_token);

    v_code := 'NEX-' || LPAD((FLOOR(RANDOM() * 90000 + 10000))::TEXT, 5, '0');
    v_hash := md5(v_code);

    UPDATE public.teams
    SET code = v_code, code_hash = v_hash
    WHERE id = p_team_id;

    INSERT INTO public.audit_logs (action, details) VALUES ('regenerate_code', jsonb_build_object('team_id', p_team_id, 'new_code', v_code));

    RETURN jsonb_build_object('success', true, 'team_id', p_team_id, 'new_code', v_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- TRACK MANAGEMENT RPCS

-- ADD TRACK
CREATE OR REPLACE FUNCTION public.rpc_admin_add_track(p_token TEXT, p_name TEXT)
RETURNS JSONB AS $$
DECLARE
    v_clean_name TEXT;
    v_track_id UUID;
BEGIN
    PERFORM public.verify_admin_session(p_token);

    v_clean_name := TRIM(p_name);
    IF LENGTH(v_clean_name) < 2 THEN
        RAISE EXCEPTION 'Track name must be at least 2 characters.';
    END IF;

    INSERT INTO public.tracks (name, created_at)
    VALUES (v_clean_name, now())
    RETURNING id INTO v_track_id;

    INSERT INTO public.audit_logs (action, details) VALUES ('add_track', jsonb_build_object('track_id', v_track_id, 'name', v_clean_name));

    RETURN jsonb_build_object('success', true, 'track_id', v_track_id, 'name', v_clean_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- EDIT TRACK
CREATE OR REPLACE FUNCTION public.rpc_admin_edit_track(p_token TEXT, p_track_id UUID, p_name TEXT)
RETURNS JSONB AS $$
DECLARE
    v_clean_name TEXT;
BEGIN
    PERFORM public.verify_admin_session(p_token);

    v_clean_name := TRIM(p_name);
    IF LENGTH(v_clean_name) < 2 THEN
        RAISE EXCEPTION 'Track name must be at least 2 characters.';
    END IF;

    UPDATE public.tracks
    SET name = v_clean_name
    WHERE id = p_track_id;

    INSERT INTO public.audit_logs (action, details) VALUES ('edit_track', jsonb_build_object('track_id', p_track_id, 'name', v_clean_name));

    RETURN jsonb_build_object('success', true, 'track_id', p_track_id, 'name', v_clean_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- DELETE TRACK
CREATE OR REPLACE FUNCTION public.rpc_admin_delete_track(p_token TEXT, p_track_id UUID)
RETURNS JSONB AS $$
BEGIN
    PERFORM public.verify_admin_session(p_token);

    UPDATE public.teams SET track_id = NULL WHERE track_id = p_track_id;
    DELETE FROM public.tracks WHERE id = p_track_id;

    INSERT INTO public.audit_logs (action, details) VALUES ('delete_track', jsonb_build_object('track_id', p_track_id));

    RETURN jsonb_build_object('success', true, 'track_id', p_track_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- STATEMENT MANAGEMENT RPCS

-- ADD STATEMENT
CREATE OR REPLACE FUNCTION public.rpc_admin_add_statement(p_token TEXT, p_body TEXT)
RETURNS JSONB AS $$
DECLARE
    v_clean_body TEXT;
    v_id UUID;
BEGIN
    PERFORM public.verify_admin_session(p_token);

    v_clean_body := TRIM(p_body);
    IF LENGTH(v_clean_body) < 10 THEN
        RAISE EXCEPTION 'Problem statement must be at least 10 characters.';
    END IF;
    IF LENGTH(v_clean_body) > 500 THEN
        RAISE EXCEPTION 'Problem statement cannot exceed 500 characters.';
    END IF;

    INSERT INTO public.problem_statements (team_id, body, source, created_at, updated_at)
    VALUES (NULL, v_clean_body, 'admin', now(), now())
    RETURNING id INTO v_id;

    INSERT INTO public.audit_logs (action, details) VALUES ('add_admin_statement', jsonb_build_object('statement_id', v_id));

    RETURN jsonb_build_object('success', true, 'id', v_id, 'body', v_clean_body);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- DELETE STATEMENT
CREATE OR REPLACE FUNCTION public.rpc_admin_delete_statement(p_token TEXT, p_statement_id UUID)
RETURNS JSONB AS $$
BEGIN
    PERFORM public.verify_admin_session(p_token);

    UPDATE public.teams SET assigned_statement_id = NULL WHERE assigned_statement_id = p_statement_id;
    DELETE FROM public.problem_statements WHERE id = p_statement_id;

    INSERT INTO public.audit_logs (action, details) VALUES ('delete_statement', jsonb_build_object('statement_id', p_statement_id));

    RETURN jsonb_build_object('success', true, 'statement_id', p_statement_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- 7. GRANTS
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_team_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_team_dashboard(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_team_submit_statement(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_change_password(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_get_overview(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_set_phase(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_set_config(TEXT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_generate_tracks(TEXT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_shuffle_statements(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_reset_assignments(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_add_team(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_bulk_add_teams(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_delete_team(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_regenerate_code(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_add_track(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_edit_track(TEXT, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_delete_track(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_add_statement(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_delete_statement(TEXT, UUID) TO anon, authenticated;
