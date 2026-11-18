import { createClient } from '@supabase/supabase-js';
import { Phase, TeamDashboardData, AdminOverviewData } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dpkqovqavcauovdhlrhq.supabase.co';
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_5PU4VyyrXp7vge_zQ8zmEA_WV_kAj86';

export const supabase = createClient(supabaseUrl, supabaseKey);

// -------------------------------------------------------------
// TEAM API (Direct Supabase RPCs)
// -------------------------------------------------------------

export async function apiTeamLogin(code: string): Promise<{
  success: boolean;
  token: string;
  team_id: string;
  team_name: string;
  team_code: string;
}> {
  const { data, error } = await supabase.rpc('rpc_team_login', {
    p_code: code,
    p_client_id: 'client_' + window.location.hostname,
  });

  if (error) {
    throw new Error(error.message || 'Invalid code.');
  }

  return data;
}

export async function apiGetTeamDashboard(token: string): Promise<TeamDashboardData> {
  const { data, error } = await supabase.rpc('rpc_get_team_dashboard', {
    p_token: token,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function apiTeamSubmitStatement(
  token: string,
  body: string
): Promise<{ success: boolean; body: string }> {
  const { data, error } = await supabase.rpc('rpc_team_submit_statement', {
    p_token: token,
    p_body: body,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// -------------------------------------------------------------
// ADMIN API (Direct Supabase RPCs)
// -------------------------------------------------------------

export async function apiAdminLogin(password: string): Promise<{ success: boolean; token: string }> {
  const { data, error } = await supabase.rpc('rpc_admin_login', {
    p_password: password,
    p_client_id: 'admin_' + window.location.hostname,
  });

  if (error) {
    throw new Error(error.message || 'Funi guy, u aint no worthy of Bruce Wayne.');
  }

  return data;
}

export async function apiAdminGetOverview(token: string): Promise<AdminOverviewData> {
  const { data, error } = await supabase.rpc('rpc_admin_get_overview', {
    p_token: token,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function apiAdminSetPhase(token: string, phase: Phase) {
  const { data, error } = await supabase.rpc('rpc_admin_set_phase', {
    p_token: token,
    p_phase: phase,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminSetConfig(token: string, maxTeams: number) {
  const { data, error } = await supabase.rpc('rpc_admin_set_config', {
    p_token: token,
    p_max_teams: maxTeams,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminGenerateTracks(token: string, maxTeams?: number) {
  const { data, error } = await supabase.rpc('rpc_admin_generate_tracks', {
    p_token: token,
    p_max_teams: maxTeams || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminShuffleStatements(token: string) {
  const { data, error } = await supabase.rpc('rpc_admin_shuffle_statements', {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminResetAssignments(token: string, target: 'tracks' | 'statements' | 'all') {
  const { data, error } = await supabase.rpc('rpc_admin_reset_assignments', {
    p_token: token,
    p_target: target,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminAddTeam(token: string, name: string, code?: string) {
  const { data, error } = await supabase.rpc('rpc_admin_add_team', {
    p_token: token,
    p_name: name,
    p_code: code || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminBulkAddTeams(
  token: string,
  teams: Array<{ name: string; code?: string }>
) {
  const { data, error } = await supabase.rpc('rpc_admin_bulk_add_teams', {
    p_token: token,
    p_teams: teams,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminDeleteTeam(token: string, teamId: string) {
  const { data, error } = await supabase.rpc('rpc_admin_delete_team', {
    p_token: token,
    p_team_id: teamId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminRegenerateCode(token: string, teamId: string) {
  const { data, error } = await supabase.rpc('rpc_admin_regenerate_code', {
    p_token: token,
    p_team_id: teamId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminAddTrack(token: string, name: string) {
  const { data, error } = await supabase.rpc('rpc_admin_add_track', {
    p_token: token,
    p_name: name,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminEditTrack(token: string, trackId: string, name: string) {
  const { data, error } = await supabase.rpc('rpc_admin_edit_track', {
    p_token: token,
    p_track_id: trackId,
    p_name: name,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminDeleteTrack(token: string, trackId: string) {
  const { data, error } = await supabase.rpc('rpc_admin_delete_track', {
    p_token: token,
    p_track_id: trackId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminAddStatement(token: string, body: string) {
  const { data, error } = await supabase.rpc('rpc_admin_add_statement', {
    p_token: token,
    p_body: body,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminDeleteStatement(token: string, statementId: string) {
  const { data, error } = await supabase.rpc('rpc_admin_delete_statement', {
    p_token: token,
    p_statement_id: statementId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminChangePassword(token: string, oldPass: string, newPass: string) {
  const { data, error } = await supabase.rpc('rpc_admin_change_password', {
    p_token: token,
    p_old_password: oldPass,
    p_new_password: newPass,
  });
  if (error) throw new Error(error.message);
  return data;
}
