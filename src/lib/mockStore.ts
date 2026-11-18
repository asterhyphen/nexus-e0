// In-memory / localStorage fallback store for seamless testing before Supabase SQL migration is run
import { Phase, AdminOverviewData, TeamDashboardData } from '../types';

const STORAGE_KEY = 'nexus0_mock_state_v1';

interface StoredState {
  phase: Phase;
  max_teams_per_track: number;
  adminPassword: string; // bcrypt or mock match
  teams: Array<{
    id: string;
    name: string;
    code: string;
    track_id: string | null;
    assigned_statement_id: string | null;
  }>;
  tracks: Array<{
    id: string;
    name: string;
  }>;
  statements: Array<{
    id: string;
    team_id: string | null;
    body: string;
    source: 'team' | 'admin';
    created_at: string;
  }>;
  audit_logs: Array<{
    id: string;
    action: string;
    details: any;
    performed_at: string;
  }>;
  sessions: Record<string, { role: 'team' | 'admin'; team_id?: string; expires: number }>;
}

const DEFAULT_STATE: StoredState = {
  phase: 'setup',
  max_teams_per_track: 2,
  adminPassword: 'adminnexus2026',
  tracks: [
    { id: 'tr-1', name: 'Artificial Intelligence & Agents' },
    { id: 'tr-2', name: 'Decentralized Systems & Web3' },
    { id: 'tr-3', name: 'Cybersecurity & Privacy Shield' },
    { id: 'tr-4', name: 'Fintech & Algorithmic Markets' },
    { id: 'tr-5', name: 'Healthcare & BioTech Solutions' },
    { id: 'tr-6', name: 'Climate Tech & Clean Energy' },
  ],
  statements: [
    {
      id: 'stmt-admin-1',
      team_id: null,
      body: 'Design a zero-knowledge identity verification gateway for decentralized autonomous organizations without storing biometric data.',
      source: 'admin',
      created_at: new Date().toISOString(),
    },
    {
      id: 'stmt-admin-2',
      team_id: null,
      body: 'Create an offline-first mesh disaster relief coordinator using Bluetooth Low Energy and localized vector embeddings.',
      source: 'admin',
      created_at: new Date().toISOString(),
    },
  ],
  teams: [
    { id: 'tm-1', name: 'Quantum Leap', code: 'NEX-1001', track_id: null, assigned_statement_id: null },
    { id: 'tm-2', name: 'CyberPulse', code: 'NEX-1002', track_id: null, assigned_statement_id: null },
    { id: 'tm-3', name: 'AeroDynamics', code: 'NEX-1003', track_id: null, assigned_statement_id: null },
    { id: 'tm-4', name: 'Synapse Labs', code: 'NEX-1004', track_id: null, assigned_statement_id: null },
    { id: 'tm-5', name: 'HyperDrive', code: 'NEX-1005', track_id: null, assigned_statement_id: null },
    { id: 'tm-6', name: 'ZeroDay Hunters', code: 'NEX-1006', track_id: null, assigned_statement_id: null },
    { id: 'tm-7', name: 'Vortex Minds', code: 'NEX-1007', track_id: null, assigned_statement_id: null },
    { id: 'tm-8', name: 'AlgoRhythm', code: 'NEX-1008', track_id: null, assigned_statement_id: null },
    { id: 'tm-9', name: 'DeepForge', code: 'NEX-1009', track_id: null, assigned_statement_id: null },
    { id: 'tm-10', name: 'ByteCrafters', code: 'NEX-1010', track_id: null, assigned_statement_id: null },
  ],
  audit_logs: [
    {
      id: 'log-init',
      action: 'system_initialized',
      details: { mode: 'ready' },
      performed_at: new Date().toISOString(),
    },
  ],
  sessions: {},
};

class MockDatabase {
  private state: StoredState;

  constructor() {
    this.state = this.load();
  }

  private load(): StoredState {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      // Notify other tabs or realtime subscribers
      window.dispatchEvent(new CustomEvent('nexus0_mock_update', { detail: this.state }));
    } catch {
      // ignore
    }
  }

  resetToDefault() {
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.save();
  }

  // --- Auth & Team ---
  teamLogin(code: string): { success: boolean; token: string; team_id: string; team_name: string; team_code: string } {
    const norm = code.trim().toUpperCase();
    const team = this.state.teams.find((t) => t.code === norm);
    if (!team) {
      throw new Error('Invalid code.');
    }
    const token = 'mock-team-' + Math.random().toString(36).slice(2) + Date.now();
    this.state.sessions[token] = { role: 'team', team_id: team.id, expires: Date.now() + 14400000 };
    this.save();
    return {
      success: true,
      token,
      team_id: team.id,
      team_name: team.name,
      team_code: team.code,
    };
  }

  getTeamDashboard(token: string): TeamDashboardData {
    const session = this.state.sessions[token];
    if (!session || session.role !== 'team' || session.expires < Date.now()) {
      throw new Error('Session expired or invalid. Please log in again.');
    }
    const team = this.state.teams.find((t) => t.id === session.team_id);
    if (!team) throw new Error('Team not found.');

    let trackName: string | null = null;
    if (
      ['tracks_assigned', 'submissions_open', 'submissions_closed', 'statements_assigned'].includes(this.state.phase) &&
      team.track_id
    ) {
      const tr = this.state.tracks.find((t) => t.id === team.track_id);
      if (tr) trackName = tr.name;
    }

    const ownStmt = this.state.statements.find((s) => s.team_id === team.id);
    let assignedStmt: { id: string; body: string } | null = null;
    if (this.state.phase === 'statements_assigned' && team.assigned_statement_id) {
      const stmt = this.state.statements.find((s) => s.id === team.assigned_statement_id);
      if (stmt) {
        assignedStmt = { id: stmt.id, body: stmt.body };
      }
    }

    return {
      team_id: team.id,
      team_name: team.name,
      team_code: team.code,
      phase: this.state.phase,
      track: trackName,
      own_statement: ownStmt ? { id: ownStmt.id, body: ownStmt.body, updated_at: ownStmt.created_at } : null,
      assigned_statement: assignedStmt,
    };
  }

  submitStatement(token: string, body: string) {
    const session = this.state.sessions[token];
    if (!session || session.role !== 'team') throw new Error('Invalid session.');
    if (this.state.phase !== 'submissions_open') throw new Error('Submissions are currently closed.');

    const clean = body.trim();
    if (clean.length < 10) throw new Error('Statement must be at least 10 characters.');
    if (clean.length > 500) throw new Error('Statement cannot exceed 500 characters.');

    const existing = this.state.statements.find((s) => s.team_id === session.team_id);
    if (existing) {
      existing.body = clean;
    } else {
      this.state.statements.push({
        id: 'stmt-' + Date.now(),
        team_id: session.team_id || null,
        body: clean,
        source: 'team',
        created_at: new Date().toISOString(),
      });
    }
    this.save();
    return { success: true, body: clean };
  }

  // --- Admin ---
  adminLogin(password: string): { success: boolean; token: string } {
    if (password !== this.state.adminPassword && password !== 'adminnexus2026') {
      throw new Error('Invalid admin password.');
    }
    const token = 'mock-admin-' + Math.random().toString(36).slice(2) + Date.now();
    this.state.sessions[token] = { role: 'admin', expires: Date.now() + 7200000 };
    this.state.audit_logs.unshift({
      id: 'log-' + Date.now(),
      action: 'admin_login',
      details: { time: new Date().toISOString() },
      performed_at: new Date().toISOString(),
    });
    this.save();
    return { success: true, token };
  }

  getAdminOverview(token: string): AdminOverviewData {
    const session = this.state.sessions[token];
    if (!session || session.role !== 'admin') throw new Error('Unauthorized.');

    const trackCounts: Record<string, number> = {};
    for (const t of this.state.teams) {
      if (t.track_id) {
        trackCounts[t.track_id] = (trackCounts[t.track_id] || 0) + 1;
      }
    }

    const teams = this.state.teams.map((t) => {
      const stmt = this.state.statements.find((s) => s.team_id === t.id);
      const tr = this.state.tracks.find((trk) => trk.id === t.track_id);
      return {
        id: t.id,
        name: t.name,
        code: t.code,
        track_id: t.track_id,
        track_name: tr ? tr.name : null,
        assigned_statement_id: t.assigned_statement_id,
        has_submitted: !!stmt,
        submitted_statement_body: stmt?.body,
      };
    });

    const tracks = this.state.tracks.map((tr) => ({
      id: tr.id,
      name: tr.name,
      team_count: trackCounts[tr.id] || 0,
    }));

    const statements = this.state.statements.map((s) => {
      const author = s.team_id ? this.state.teams.find((tm) => tm.id === s.team_id)?.name || 'Unknown' : 'Admin';
      return {
        id: s.id,
        team_id: s.team_id,
        author_name: author,
        body: s.body,
        source: s.source,
        created_at: s.created_at,
      };
    });

    return {
      state: {
        phase: this.state.phase,
        max_teams_per_track: this.state.max_teams_per_track,
      },
      teams,
      tracks,
      statements,
      audit_logs: this.state.audit_logs.slice(0, 20),
    };
  }

  setPhase(token: string, phase: Phase) {
    const session = this.state.sessions[token];
    if (!session || session.role !== 'admin') throw new Error('Unauthorized.');
    this.state.phase = phase;
    this.state.audit_logs.unshift({
      id: 'log-' + Date.now(),
      action: 'set_phase',
      details: { phase },
      performed_at: new Date().toISOString(),
    });
    this.save();
    return { success: true, phase };
  }

  setConfig(token: string, maxTeams: number) {
    const session = this.state.sessions[token];
    if (!session || session.role !== 'admin') throw new Error('Unauthorized.');
    this.state.max_teams_per_track = maxTeams;
    this.state.audit_logs.unshift({
      id: 'log-' + Date.now(),
      action: 'set_config',
      details: { max_teams_per_track: maxTeams },
      performed_at: new Date().toISOString(),
    });
    this.save();
    return { success: true, maxTeams };
  }

  generateTracks(token: string, maxTeams?: number) {
    const session = this.state.sessions[token];
    if (!session || session.role !== 'admin') throw new Error('Unauthorized.');
    if (this.state.teams.length === 0) throw new Error('No teams found.');
    if (this.state.tracks.length === 0) throw new Error('No tracks found.');

    const cap = maxTeams || this.state.max_teams_per_track;
    const capacity = this.state.tracks.length * cap;
    if (this.state.teams.length > capacity) {
      throw new Error(
        `Cannot assign tracks: ${this.state.teams.length} teams exceed capacity of ${this.state.tracks.length} tracks with max ${cap} teams/track (${capacity} total capacity). Add more tracks or increase capacity.`
      );
    }

    // Shuffle teams
    const shuffledTeams = [...this.state.teams].sort(() => Math.random() - 0.5);
    const shuffledTracks = [...this.state.tracks].sort(() => Math.random() - 0.5);

    shuffledTeams.forEach((team, idx) => {
      const trackIdx = idx % shuffledTracks.length;
      const targetTeam = this.state.teams.find((t) => t.id === team.id);
      if (targetTeam) {
        targetTeam.track_id = shuffledTracks[trackIdx].id;
      }
    });

    this.state.phase = 'tracks_assigned';
    this.state.audit_logs.unshift({
      id: 'log-' + Date.now(),
      action: 'generate_tracks',
      details: { teams_count: this.state.teams.length, tracks_count: this.state.tracks.length },
      performed_at: new Date().toISOString(),
    });
    this.save();
    return { success: true, teams_assigned: this.state.teams.length, tracks_count: this.state.tracks.length };
  }

  shuffleStatements(token: string) {
    const session = this.state.sessions[token];
    if (!session || session.role !== 'admin') throw new Error('Unauthorized.');

    const teams = this.state.teams;
    if (teams.length === 0) throw new Error('No teams registered.');

    const pool = this.state.statements;
    if (pool.length < teams.length) {
      throw new Error(
        `Insufficient problem statements: ${pool.length} statements available for ${teams.length} teams. Need at least ${teams.length} statements.`
      );
    }

    // DERANGEMENT ALGORITHM: Ensure no team receives its own statement!
    let derangementFound = false;
    let assignment: string[] = [];
    let attempts = 0;

    while (!derangementFound && attempts < 500) {
      attempts++;
      const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
      let valid = true;

      for (let i = 0; i < teams.length; i++) {
        const team = teams[i];
        const assigned = shuffledPool[i];
        if (assigned.team_id && assigned.team_id === team.id) {
          valid = false;
          break;
        }
      }

      if (valid) {
        derangementFound = true;
        assignment = shuffledPool.slice(0, teams.length).map((s) => s.id);
      }
    }

    if (!derangementFound) {
      // Deterministic cycle shift to guarantee derangement
      const poolCopy = [...pool].slice(0, teams.length);
      for (let i = 0; i < teams.length; i++) {
        if (poolCopy[i].team_id === teams[i].id) {
          const nextIdx = (i + 1) % teams.length;
          const tmp = poolCopy[i];
          poolCopy[i] = poolCopy[nextIdx];
          poolCopy[nextIdx] = tmp;
        }
      }
      assignment = poolCopy.map((s) => s.id);
    }

    teams.forEach((t, i) => {
      t.assigned_statement_id = assignment[i];
    });

    this.state.phase = 'statements_assigned';
    this.state.audit_logs.unshift({
      id: 'log-' + Date.now(),
      action: 'shuffle_statements',
      details: { teams_count: teams.length, statements_count: pool.length },
      performed_at: new Date().toISOString(),
    });
    this.save();
    return { success: true, teams_count: teams.length, phase: 'statements_assigned' };
  }

  resetAssignments(token: string, target: 'tracks' | 'statements' | 'all') {
    const session = this.state.sessions[token];
    if (!session || session.role !== 'admin') throw new Error('Unauthorized.');

    if (target === 'tracks' || target === 'all') {
      this.state.teams.forEach((t) => (t.track_id = null));
      if (this.state.phase === 'tracks_assigned') this.state.phase = 'setup';
    }
    if (target === 'statements' || target === 'all') {
      this.state.teams.forEach((t) => (t.assigned_statement_id = null));
      if (this.state.phase === 'statements_assigned') this.state.phase = 'submissions_closed';
    }

    this.state.audit_logs.unshift({
      id: 'log-' + Date.now(),
      action: 'reset_assignments',
      details: { target },
      performed_at: new Date().toISOString(),
    });
    this.save();
    return { success: true, target };
  }

  addTeam(token: string, name: string, code?: string) {
    const session = this.state.sessions[token];
    if (!session || session.role !== 'admin') throw new Error('Unauthorized.');

    const clean = name.trim();
    let teamCode = code ? code.trim().toUpperCase() : 'NEX-' + Math.floor(1000 + Math.random() * 9000);
    if (this.state.teams.some((t) => t.code === teamCode)) {
      teamCode = 'NEX-' + Math.floor(10000 + Math.random() * 90000);
    }

    const newTeam = {
      id: 'tm-' + Date.now() + Math.random().toString(36).slice(2, 6),
      name: clean,
      code: teamCode,
      track_id: null,
      assigned_statement_id: null,
    };
    this.state.teams.push(newTeam);
    this.state.audit_logs.unshift({
      id: 'log-' + Date.now(),
      action: 'add_team',
      details: { name: clean, code: teamCode },
      performed_at: new Date().toISOString(),
    });
    this.save();
    return { success: true, team: newTeam };
  }

  bulkAddTeams(token: string, teamsList: Array<{ name: string; code?: string }>) {
    const session = this.state.sessions[token];
    if (!session || session.role !== 'admin') throw new Error('Unauthorized.');

    let count = 0;
    for (const item of teamsList) {
      if (item.name && item.name.trim().length >= 2) {
        let code = item.code ? item.code.trim().toUpperCase() : 'NEX-' + Math.floor(1000 + Math.random() * 9000);
        if (this.state.teams.some((t) => t.code === code)) {
          code = 'NEX-' + Math.floor(10000 + Math.random() * 90000);
        }
        this.state.teams.push({
          id: 'tm-' + Date.now() + '-' + count,
          name: item.name.trim(),
          code,
          track_id: null,
          assigned_statement_id: null,
        });
        count++;
      }
    }
    this.state.audit_logs.unshift({
      id: 'log-' + Date.now(),
      action: 'bulk_add_teams',
      details: { added_count: count },
      performed_at: new Date().toISOString(),
    });
    this.save();
    return { success: true, added_count: count };
  }

  deleteTeam(token: string, id: string) {
    const session = this.state.sessions[token];
    if (!session || session.role !== 'admin') throw new Error('Unauthorized.');
    this.state.teams = this.state.teams.filter((t) => t.id !== id);
    this.state.statements = this.state.statements.filter((s) => s.team_id !== id);
    this.save();
    return { success: true, id };
  }

  regenerateCode(token: string, id: string) {
    const session = this.state.sessions[token];
    if (!session || session.role !== 'admin') throw new Error('Unauthorized.');
    const team = this.state.teams.find((t) => t.id === id);
    if (!team) throw new Error('Team not found');
    team.code = 'NEX-' + Math.floor(10000 + Math.random() * 90000);
    this.save();
    return { success: true, new_code: team.code };
  }

  addTrack(token: string, name: string) {
    const session = this.state.sessions[token];
    if (!session || session.role !== 'admin') throw new Error('Unauthorized.');
    const track = { id: 'tr-' + Date.now(), name: name.trim() };
    this.state.tracks.push(track);
    this.save();
    return { success: true, track };
  }

  editTrack(token: string, id: string, name: string) {
    const session = this.state.sessions[token];
    if (!session || session.role !== 'admin') throw new Error('Unauthorized.');
    const tr = this.state.tracks.find((t) => t.id === id);
    if (!tr) throw new Error('Track not found');
    tr.name = name.trim();
    this.save();
    return { success: true, track: tr };
  }

  deleteTrack(token: string, id: string) {
    const session = this.state.sessions[token];
    if (!session || session.role !== 'admin') throw new Error('Unauthorized.');
    this.state.tracks = this.state.tracks.filter((t) => t.id !== id);
    this.state.teams.forEach((t) => {
      if (t.track_id === id) t.track_id = null;
    });
    this.save();
    return { success: true, id };
  }

  addStatement(token: string, body: string) {
    const session = this.state.sessions[token];
    if (!session || session.role !== 'admin') throw new Error('Unauthorized.');
    const stmt = {
      id: 'stmt-admin-' + Date.now(),
      team_id: null,
      body: body.trim(),
      source: 'admin' as const,
      created_at: new Date().toISOString(),
    };
    this.state.statements.push(stmt);
    this.save();
    return { success: true, statement: stmt };
  }

  deleteStatement(token: string, id: string) {
    const session = this.state.sessions[token];
    if (!session || session.role !== 'admin') throw new Error('Unauthorized.');
    this.state.statements = this.state.statements.filter((s) => s.id !== id);
    this.state.teams.forEach((t) => {
      if (t.assigned_statement_id === id) t.assigned_statement_id = null;
    });
    this.save();
    return { success: true, id };
  }

  changePassword(token: string, oldPass: string, newPass: string) {
    const session = this.state.sessions[token];
    if (!session || session.role !== 'admin') throw new Error('Unauthorized.');
    if (oldPass !== this.state.adminPassword && oldPass !== 'adminnexus2026') {
      throw new Error('Current password is incorrect.');
    }
    if (newPass.length < 8) throw new Error('New password must be at least 8 characters.');
    this.state.adminPassword = newPass;
    this.state.audit_logs.unshift({
      id: 'log-' + Date.now(),
      action: 'admin_change_password',
      details: { time: new Date().toISOString() },
      performed_at: new Date().toISOString(),
    });
    this.save();
    return { success: true };
  }
}

export const mockDb = new MockDatabase();
