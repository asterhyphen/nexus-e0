import { createClient } from '@supabase/supabase-js';
import { mockDb } from './mockStore';
import { Phase, TeamDashboardData, AdminOverviewData } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dpkqovqavcauovdhlrhq.supabase.co';
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_5PU4VyyrXp7vge_zQ8zmEA_WV_kAj86';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Global status listener to notify UI when falling back to mock or when live
let usingMock = false;
const listeners = new Set<(isMock: boolean) => void>();

export function isBackendMock(): boolean {
  return usingMock;
}

export function subscribeBackendStatus(fn: (isMock: boolean) => void) {
  listeners.add(fn);
  fn(usingMock);
  return () => {
    listeners.delete(fn);
  };
}

function notifyBackendStatus(isMock: boolean) {
  if (usingMock !== isMock) {
    usingMock = isMock;
    listeners.forEach((fn) => fn(usingMock));
  }
}

// Helper to determine if an error is due to missing SQL schema
function isSchemaMissingError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = err.code || '';
  return (
    code === 'PGRST202' || // Function not found
    code === 'PGRST205' || // Table not found
    code === '42883' || // Undefined function
    code === '42P01' || // Undefined table
    msg.includes('could not find the function') ||
    msg.includes('schema cache') ||
    msg.includes('not found') ||
    msg.includes('secret api key required')
  );
}

// -------------------------------------------------------------
// TEAM API
// -------------------------------------------------------------

export async function apiTeamLogin(code: string): Promise<{ success: boolean; token: string; team_id: string; team_name: string; team_code: string }> {
  try {
    const { data, error } = await supabase.rpc('rpc_team_login', {
      p_code: code,
      p_client_id: 'client_' + window.location.hostname,
    });

    if (error) {
      if (isSchemaMissingError(error)) {
        notifyBackendStatus(true);
        return mockDb.teamLogin(code);
      }
      throw new Error(error.message || 'Invalid code.');
    }

    notifyBackendStatus(false);
    return data;
  } catch (err: any) {
    if (isSchemaMissingError(err)) {
      notifyBackendStatus(true);
      return mockDb.teamLogin(code);
    }
    throw err;
  }
}

export async function apiGetTeamDashboard(token: string): Promise<TeamDashboardData> {
  if (usingMock || token.startsWith('mock-')) {
    return mockDb.getTeamDashboard(token);
  }

  try {
    const { data, error } = await supabase.rpc('rpc_get_team_dashboard', {
      p_token: token,
    });

    if (error) {
      if (isSchemaMissingError(error)) {
        notifyBackendStatus(true);
        return mockDb.getTeamDashboard(token);
      }
      throw new Error(error.message);
    }

    notifyBackendStatus(false);
    return data;
  } catch (err: any) {
    if (isSchemaMissingError(err)) {
      notifyBackendStatus(true);
      return mockDb.getTeamDashboard(token);
    }
    throw err;
  }
}

export async function apiTeamSubmitStatement(token: string, body: string): Promise<{ success: boolean; body: string }> {
  if (usingMock || token.startsWith('mock-')) {
    return mockDb.submitStatement(token, body);
  }

  try {
    const { data, error } = await supabase.rpc('rpc_team_submit_statement', {
      p_token: token,
      p_body: body,
    });

    if (error) {
      if (isSchemaMissingError(error)) {
        notifyBackendStatus(true);
        return mockDb.submitStatement(token, body);
      }
      throw new Error(error.message);
    }

    return data;
  } catch (err: any) {
    if (isSchemaMissingError(err)) {
      notifyBackendStatus(true);
      return mockDb.submitStatement(token, body);
    }
    throw err;
  }
}

// -------------------------------------------------------------
// ADMIN API
// -------------------------------------------------------------

export async function apiAdminLogin(password: string): Promise<{ success: boolean; token: string }> {
  try {
    const { data, error } = await supabase.rpc('rpc_admin_login', {
      p_password: password,
      p_client_id: 'admin_' + window.location.hostname,
    });

    if (error) {
      if (isSchemaMissingError(error)) {
        notifyBackendStatus(true);
        return mockDb.adminLogin(password);
      }
      throw new Error(error.message || 'Invalid admin password.');
    }

    notifyBackendStatus(false);
    return data;
  } catch (err: any) {
    if (isSchemaMissingError(err)) {
      notifyBackendStatus(true);
      return mockDb.adminLogin(password);
    }
    throw err;
  }
}

export async function apiAdminGetOverview(token: string): Promise<AdminOverviewData> {
  if (usingMock || token.startsWith('mock-')) {
    return mockDb.getAdminOverview(token);
  }

  try {
    const { data, error } = await supabase.rpc('rpc_admin_get_overview', {
      p_token: token,
    });

    if (error) {
      if (isSchemaMissingError(error)) {
        notifyBackendStatus(true);
        return mockDb.getAdminOverview(token);
      }
      throw new Error(error.message);
    }

    notifyBackendStatus(false);
    return data;
  } catch (err: any) {
    if (isSchemaMissingError(err)) {
      notifyBackendStatus(true);
      return mockDb.getAdminOverview(token);
    }
    throw err;
  }
}

export async function apiAdminSetPhase(token: string, phase: Phase) {
  if (usingMock || token.startsWith('mock-')) {
    return mockDb.setPhase(token, phase);
  }
  const { data, error } = await supabase.rpc('rpc_admin_set_phase', {
    p_token: token,
    p_phase: phase,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminSetConfig(token: string, maxTeams: number) {
  if (usingMock || token.startsWith('mock-')) {
    return mockDb.setConfig(token, maxTeams);
  }
  const { data, error } = await supabase.rpc('rpc_admin_set_config', {
    p_token: token,
    p_max_teams: maxTeams,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminGenerateTracks(token: string, maxTeams?: number) {
  if (usingMock || token.startsWith('mock-')) {
    return mockDb.generateTracks(token, maxTeams);
  }
  const { data, error } = await supabase.rpc('rpc_admin_generate_tracks', {
    p_token: token,
    p_max_teams: maxTeams || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminShuffleStatements(token: string) {
  if (usingMock || token.startsWith('mock-')) {
    return mockDb.shuffleStatements(token);
  }
  const { data, error } = await supabase.rpc('rpc_admin_shuffle_statements', {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminResetAssignments(token: string, target: 'tracks' | 'statements' | 'all') {
  if (usingMock || token.startsWith('mock-')) {
    return mockDb.resetAssignments(token, target);
  }
  const { data, error } = await supabase.rpc('rpc_admin_reset_assignments', {
    p_token: token,
    p_target: target,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminAddTeam(token: string, name: string, code?: string) {
  if (usingMock || token.startsWith('mock-')) {
    return mockDb.addTeam(token, name, code);
  }
  const { data, error } = await supabase.rpc('rpc_admin_add_team', {
    p_token: token,
    p_name: name,
    p_code: code || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminBulkAddTeams(token: string, teams: Array<{ name: string; code?: string }>) {
  if (usingMock || token.startsWith('mock-')) {
    return mockDb.bulkAddTeams(token, teams);
  }
  const { data, error } = await supabase.rpc('rpc_admin_bulk_add_teams', {
    p_token: token,
    p_teams: teams,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminDeleteTeam(token: string, teamId: string) {
  if (usingMock || token.startsWith('mock-')) {
    return mockDb.deleteTeam(token, teamId);
  }
  const { data, error } = await supabase.rpc('rpc_admin_delete_team', {
    p_token: token,
    p_team_id: teamId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminRegenerateCode(token: string, teamId: string) {
  if (usingMock || token.startsWith('mock-')) {
    return mockDb.regenerateCode(token, teamId);
  }
  const { data, error } = await supabase.rpc('rpc_admin_regenerate_code', {
    p_token: token,
    p_team_id: teamId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminAddTrack(token: string, name: string) {
  if (usingMock || token.startsWith('mock-')) {
    return mockDb.addTrack(token, name);
  }
  const { data, error } = await supabase.rpc('rpc_admin_add_track', {
    p_token: token,
    p_name: name,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminEditTrack(token: string, trackId: string, name: string) {
  if (usingMock || token.startsWith('mock-')) {
    return mockDb.editTrack(token, trackId, name);
  }
  const { data, error } = await supabase.rpc('rpc_admin_edit_track', {
    p_token: token,
    p_track_id: trackId,
    p_name: name,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminDeleteTrack(token: string, trackId: string) {
  if (usingMock || token.startsWith('mock-')) {
    return mockDb.deleteTrack(token, trackId);
  }
  const { data, error } = await supabase.rpc('rpc_admin_delete_track', {
    p_token: token,
    p_track_id: trackId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminAddStatement(token: string, body: string) {
  if (usingMock || token.startsWith('mock-')) {
    return mockDb.addStatement(token, body);
  }
  const { data, error } = await supabase.rpc('rpc_admin_add_statement', {
    p_token: token,
    p_body: body,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminDeleteStatement(token: string, statementId: string) {
  if (usingMock || token.startsWith('mock-')) {
    return mockDb.deleteStatement(token, statementId);
  }
  const { data, error } = await supabase.rpc('rpc_admin_delete_statement', {
    p_token: token,
    p_statement_id: statementId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function apiAdminChangePassword(token: string, oldPass: string, newPass: string) {
  if (usingMock || token.startsWith('mock-')) {
    return mockDb.changePassword(token, oldPass, newPass);
  }
  const { data, error } = await supabase.rpc('rpc_admin_change_password', {
    p_token: token,
    p_old_password: oldPass,
    p_new_password: newPass,
  });
  if (error) throw new Error(error.message);
  return data;
}
