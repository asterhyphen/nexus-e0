export type Phase = 
  | 'setup' 
  | 'tracks_assigned' 
  | 'submissions_open' 
  | 'submissions_closed' 
  | 'statements_assigned';

export interface EventState {
  phase: Phase;
  max_teams_per_track: number;
  updated_at?: string;
}

export interface TeamSession {
  token: string;
  team_id: string;
  team_name: string;
  team_code: string;
}

export interface TeamDashboardData {
  team_id: string;
  team_name: string;
  team_code: string;
  phase: Phase;
  track: string | null;
  own_statement: {
    id: string;
    body: string;
    updated_at: string;
  } | null;
  assigned_statement: {
    id: string;
    body: string;
  } | null;
}

export interface AdminTeamItem {
  id: string;
  name: string;
  code: string;
  track_id: string | null;
  track_name: string | null;
  assigned_statement_id: string | null;
  has_submitted: boolean;
  submitted_statement_body?: string;
}

export interface AdminTrackItem {
  id: string;
  name: string;
  team_count: number;
}

export interface AdminStatementItem {
  id: string;
  team_id: string | null;
  author_name: string;
  body: string;
  source: 'team' | 'admin';
  created_at: string;
  assigned_team_names?: string | null;
  assigned_teams_count?: number;
}

export interface AuditLogItem {
  id: string;
  action: string;
  details: Record<string, any>;
  performed_at: string;
}

export interface AdminOverviewData {
  state: EventState;
  teams: AdminTeamItem[];
  tracks: AdminTrackItem[];
  statements: AdminStatementItem[];
  audit_logs: AuditLogItem[];
}
