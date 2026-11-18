-- =========================================================================
-- Nexus E-0 CRITICAL EVENT FLOW FIXES (RESET, SHUFFLE & DERANGEMENT, FINAL ROUND)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/dpkqovqavcauovdhlrhq/sql
-- =========================================================================

-- 1. FIX: ADMIN RESET ASSIGNMENTS
-- Clears assignments, wipes team statements cleanly so old text does not persist,
-- and re-opens submissions so teams can draft fresh statements immediately.
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


-- 2. FIX: ADMIN SHUFFLE STATEMENTS (STRICT 1-TO-1 UNIQUE DERANGEMENT)
-- Exactly one unique problem statement randomized for one team.
-- Never assigns any problem statement to more than one team!
CREATE OR REPLACE FUNCTION public.rpc_admin_shuffle_statements(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
    v_team_count INT;
    v_stmt_count INT;
    v_team_ids UUID[];
    v_own_stmt_ids UUID[];
    v_shuffled_pool UUID[];
    v_assigned_stmt_ids UUID[];
    v_attempts INT := 0;
    v_success BOOLEAN := false;
    v_valid BOOLEAN;
    i INT;
    j INT;
    v_temp UUID;
    v_needed INT;
    v_seed_bank TEXT[] := ARRAY[
        'Architect a high-performance, fault-tolerant realtime distributed synchronization mesh with zero-downtime recovery and end-to-end data integrity.',
        'Design and implement an autonomous, offline-first peer-to-peer event routing system with cryptographically verifiable audit trails.',
        'Build a zero-knowledge credential verification gateway with sub-millisecond latency and automated rate-limiting enforcement.',
        'Implement an asynchronous event-driven state machine with distributed lock leasing, idempotency keys, and self-healing consensus.',
        'Develop an ultra-low latency real-time collaborative whiteboard engine supporting conflict-free replicated data types (CRDTs).',
        'Engineer a resilient API gateway with dynamic token-bucket rate limiting, automatic circuit breakers, and anomaly detection.',
        'Design a decentralized identity and session management protocol resistant to replay attacks and token spoofing.',
        'Build a streaming telemetry and metrics aggregation pipeline capable of processing 100k events/sec with sliding window analytics.'
    ];
    v_seed_idx INT := 1;
BEGIN
    PERFORM public.verify_admin_session(p_token);

    SELECT COUNT(*) INTO v_team_count FROM public.teams;
    IF v_team_count = 0 THEN
        RAISE EXCEPTION 'No teams registered.';
    END IF;

    -- Count distinct statements currently in pool
    SELECT COUNT(*) INTO v_stmt_count FROM public.problem_statements;

    -- If fewer statements than teams, auto-seed distinct admin statements
    -- so that every team receives a UNIQUE statement (no statement given to > 1 team):
    IF v_stmt_count < v_team_count THEN
        v_needed := v_team_count - v_stmt_count;
        FOR i IN 1..v_needed LOOP
            v_seed_idx := ((i - 1) % array_length(v_seed_bank, 1)) + 1;
            INSERT INTO public.problem_statements (body, source, created_at, updated_at)
            VALUES (v_seed_bank[v_seed_idx] || ' [Ref: ' || substr(gen_random_uuid()::text, 1, 8) || ']', 'admin', now(), now());
        END LOOP;
    END IF;

    -- If there are only 1 or 2 teams and we need to ensure non-self assignment
    SELECT COUNT(*) INTO v_stmt_count FROM public.problem_statements;
    IF v_stmt_count < 2 AND v_team_count > 1 THEN
        INSERT INTO public.problem_statements (body, source, created_at, updated_at)
        VALUES ('Design and implement an autonomous, offline-first peer-to-peer event routing mesh with cryptographically verifiable audit trails.', 'admin', now(), now());
    END IF;

    -- Get teams and their own statements (if any)
    SELECT 
        array_agg(t.id ORDER BY t.id),
        array_agg(ps.id ORDER BY t.id)
    INTO v_team_ids, v_own_stmt_ids
    FROM public.teams t
    LEFT JOIN public.problem_statements ps ON ps.team_id = t.id;

    -- Find a 1-to-1 unique derangement (every statement in the slice is pairwise distinct)
    WHILE NOT v_success AND v_attempts < 2000 LOOP
        v_attempts := v_attempts + 1;
        
        -- Shuffle all distinct statements in the database
        SELECT array_agg(id ORDER BY gen_random_uuid()) INTO v_shuffled_pool 
        FROM public.problem_statements;
        
        -- Take the first v_team_count DISTINCT statements from the shuffled pool
        v_assigned_stmt_ids := v_shuffled_pool[1:v_team_count];

        -- Check derangement constraint: no team receives its own statement
        v_valid := true;
        FOR i IN 1..v_team_count LOOP
            IF v_own_stmt_ids[i] IS NOT NULL AND v_assigned_stmt_ids[i] = v_own_stmt_ids[i] THEN
                v_valid := false;
                EXIT;
            END IF;
        END LOOP;

        IF v_valid THEN
            v_success := true;
        END IF;
    END LOOP;

    -- Deterministic permutation swap fallback if random attempts had a collision
    IF NOT v_success THEN
        FOR i IN 1..v_team_count LOOP
            IF v_own_stmt_ids[i] IS NOT NULL AND v_assigned_stmt_ids[i] = v_own_stmt_ids[i] THEN
                -- Find another index j to swap with where neither gets its own statement
                FOR j IN 1..v_team_count LOOP
                    IF j <> i AND 
                       (v_own_stmt_ids[j] IS NULL OR v_assigned_stmt_ids[i] <> v_own_stmt_ids[j]) AND
                       (v_own_stmt_ids[i] IS NULL OR v_assigned_stmt_ids[j] <> v_own_stmt_ids[i]) THEN
                        v_temp := v_assigned_stmt_ids[i];
                        v_assigned_stmt_ids[i] := v_assigned_stmt_ids[j];
                        v_assigned_stmt_ids[j] := v_temp;
                        EXIT;
                    END IF;
                END LOOP;
            END IF;
        END LOOP;
    END IF;

    -- Persist 1-to-1 unique assignments: exactly one unique statement per team
    FOR i IN 1..v_team_count LOOP
        UPDATE public.teams
        SET assigned_statement_id = v_assigned_stmt_ids[i]
        WHERE id = v_team_ids[i];
    END LOOP;

    -- Advance event state to statements_assigned
    UPDATE public.event_state SET phase = 'statements_assigned', updated_at = now() WHERE id = 1;

    INSERT INTO public.audit_logs (action, details) 
    VALUES ('shuffle_statements', jsonb_build_object(
        'teams_count', v_team_count, 
        'unique_1_to_1', true
    ));

    RETURN jsonb_build_object(
        'success', true,
        'teams_count', v_team_count,
        'phase', 'statements_assigned'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- 3. FIX: TEAM DASHBOARD RPC (ALWAYS DELIVER FINAL ROUND ASSIGNED CHALLENGE)
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

-- 4. FIX: ADMIN OVERVIEW RPC (INCLUDES WHICH TEAM EACH STATEMENT IS ASSIGNED TO)
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


-- 5. FIX: ADMIN LOGIN RPC (WITH UPDATED CUSTOM ERROR MESSAGE)
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
        RAISE EXCEPTION 'Funi guy, u aint no worthy of Bruce Wayne.';
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

-- Grant permissions to anon and authenticated
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_reset_assignments(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_shuffle_statements(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_team_dashboard(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_get_overview(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_login(TEXT, TEXT) TO anon, authenticated;
