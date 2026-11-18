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


-- 2. FIX: ADMIN SHUFFLE STATEMENTS (BULLETPROOF DERANGEMENT WITH POOL CYCLING)
-- Works even if statements < teams. Ensures every team gets an assigned statement
-- and strictly guarantees no team receives its own problem statement.
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

-- Grant permissions to anon and authenticated
GRANT EXECUTE ON FUNCTION public.rpc_admin_reset_assignments(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_shuffle_statements(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_team_dashboard(TEXT) TO anon, authenticated;
