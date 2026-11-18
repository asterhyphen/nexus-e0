import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Compass,
  FileText,
  Sliders,
  Settings,
  LogOut,
  Plus,
  RefreshCw,
  Shuffle,
  Lock,
  Unlock,
  Trash2,
  Edit2,
  Upload,
  Key,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import {
  AdminOverviewData,
  Phase,
  AdminTrackItem,
} from '../types';
import {
  apiAdminGetOverview,
  apiAdminSetPhase,
  apiAdminSetConfig,
  apiAdminGenerateTracks,
  apiAdminShuffleStatements,
  apiAdminResetAssignments,
  apiAdminAddTeam,
  apiAdminBulkAddTeams,
  apiAdminDeleteTeam,
  apiAdminRegenerateCode,
  apiAdminAddTrack,
  apiAdminEditTrack,
  apiAdminDeleteTrack,
  apiAdminAddStatement,
  apiAdminDeleteStatement,
  apiAdminChangePassword,
  supabase,
} from '../lib/supabase';
import { PhaseBadge } from '../components/PhaseBadge';
import { Modal } from '../components/Modal';

interface AdminDashboardPageProps {
  token: string;
  onLogout: () => void;
  onNavigateHome: () => void;
}

type TabType = 'control' | 'teams' | 'tracks' | 'statements' | 'settings';

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  token,
  onLogout,
  onNavigateHome,
}) => {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('control');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    variant?: 'primary' | 'danger';
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: async () => {},
  });

  // Team modals
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCode, setNewTeamCode] = useState('');

  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState('');

  // Track modals
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<AdminTrackItem | null>(null);
  const [trackNameInput, setTrackNameInput] = useState('');

  // Statement modal
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [newStatementBody, setNewStatementBody] = useState('');

  // Password change
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Config
  const [maxTeamsInput, setMaxTeamsInput] = useState<number>(2);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await apiAdminGetOverview(token);
      setData(res);
      setMaxTeamsInput(res.state.max_teams_per_track);
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes('unauthorized')) {
        onLogout();
      }
    }
  }, [token, onLogout]);

  useEffect(() => {
    fetchOverview();

    // Supabase Realtime channel subscription for event_state
    const channel = supabase
      .channel('admin-overview-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_state' }, () => {
        fetchOverview();
      })
      .subscribe();

    // Mock store update listener
    const handleMockUpdate = () => {
      fetchOverview();
    };
    window.addEventListener('nexus0_mock_update', handleMockUpdate);

    // Refresh interval
    const interval = setInterval(fetchOverview, 4000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('nexus0_mock_update', handleMockUpdate);
      clearInterval(interval);
    };
  }, [fetchOverview]);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // --- ACTIONS ---

  const handleGenerateTracks = async () => {
    setActionLoading(true);
    try {
      await apiAdminGenerateTracks(token, maxTeamsInput);
      showNotification('Tracks generated and assigned evenly across teams.');
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      fetchOverview();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShuffleStatements = async () => {
    setActionLoading(true);
    try {
      await apiAdminShuffleStatements(token);
      showNotification('Statements shuffled and assigned (Derangement guaranteed: no team receives its own statement).');
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      fetchOverview();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetPhase = async (phase: Phase) => {
    setActionLoading(true);
    try {
      await apiAdminSetPhase(token, phase);
      showNotification(`Event phase moved to ${phase.toUpperCase()}`);
      fetchOverview();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async (target: 'tracks' | 'statements' | 'all') => {
    setActionLoading(true);
    try {
      await apiAdminResetAssignments(token, target);
      showNotification(`Reset completed for ${target}.`);
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      fetchOverview();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await apiAdminSetConfig(token, maxTeamsInput);
      showNotification('Configuration updated.');
      fetchOverview();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleAddTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      await apiAdminAddTeam(token, newTeamName.trim(), newTeamCode.trim() || undefined);
      showNotification('Team added successfully.');
      setNewTeamName('');
      setNewTeamCode('');
      setIsAddTeamOpen(false);
      fetchOverview();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleBulkAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = bulkInput.split('\n').filter((l) => l.trim().length > 0);
    const teams = lines.map((line) => {
      const parts = line.split(',');
      return {
        name: parts[0]?.trim() || '',
        code: parts[1]?.trim() || undefined,
      };
    });

    try {
      const res = await apiAdminBulkAddTeams(token, teams);
      showNotification(`Bulk add completed: ${res.added_count || teams.length} teams added.`);
      setBulkInput('');
      setIsBulkAddOpen(false);
      fetchOverview();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteTeam = async (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Team',
      description: `Are you sure you want to delete team "${name}"? This will remove all their submissions and assignments.`,
      confirmText: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await apiAdminDeleteTeam(token, id);
          showNotification(`Team "${name}" deleted.`);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          fetchOverview();
        } catch (err: any) {
          showNotification(err.message, 'error');
        }
      },
    });
  };

  const handleRegenerateCode = async (id: string, name: string) => {
    try {
      const res = await apiAdminRegenerateCode(token, id);
      showNotification(`New code generated for ${name}: ${res.new_code}`);
      fetchOverview();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleSaveTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackNameInput.trim()) return;
    try {
      if (editingTrack) {
        await apiAdminEditTrack(token, editingTrack.id, trackNameInput.trim());
        showNotification('Track updated.');
      } else {
        await apiAdminAddTrack(token, trackNameInput.trim());
        showNotification('Track added.');
      }
      setIsTrackModalOpen(false);
      setEditingTrack(null);
      setTrackNameInput('');
      fetchOverview();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteTrack = async (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Track',
      description: `Delete track "${name}"? Any teams assigned to this track will become unassigned.`,
      confirmText: 'Delete Track',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await apiAdminDeleteTrack(token, id);
          showNotification(`Track "${name}" deleted.`);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          fetchOverview();
        } catch (err: any) {
          showNotification(err.message, 'error');
        }
      },
    });
  };

  const handleAddStatementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newStatementBody.trim().length < 10) return;
    try {
      await apiAdminAddStatement(token, newStatementBody.trim());
      showNotification('Admin statement added to the pool.');
      setNewStatementBody('');
      setIsStatementModalOpen(false);
      fetchOverview();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteStatement = async (id: string) => {
    try {
      await apiAdminDeleteStatement(token, id);
      showNotification('Statement deleted.');
      fetchOverview();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiAdminChangePassword(token, oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      showNotification('Admin password updated successfully.');
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const currentPhase = data?.state.phase || 'setup';
  const teamsCount = data?.teams.length || 0;
  const tracksCount = data?.tracks.length || 0;
  const statementsCount = data?.statements.length || 0;
  const submittedCount = data?.teams.filter((t) => t.has_submitted).length || 0;
  const totalCapacity = tracksCount * maxTeamsInput;

  return (
    <div className="min-h-screen pb-20 pt-6 px-4 md:px-8 max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-light text-text tracking-tight">Nexus 0 Dashboard</h1>
            <PhaseBadge phase={currentPhase} size="md" />
          </div>
          <p className="text-xs text-text-muted mt-1 font-mono">
            {teamsCount} Teams • {tracksCount} Tracks • {statementsCount} Statements in pool
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchOverview}
            className="p-2 rounded-xl bg-surface hover:bg-surface-hover border border-border text-text-muted hover:text-text transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-hover border border-border text-xs text-text-muted hover:text-text transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Landing</span>
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface hover:bg-rose-500/10 border border-border hover:border-rose-500/30 text-xs text-rose-400 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Toast Notification */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`px-4 py-2.5 rounded-xl text-xs font-mono border flex items-center justify-between gap-2 shadow-subtle ${
              message.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="hover:opacity-75">
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs Navigation */}
      <nav className="flex items-center gap-1 overflow-x-auto border-b border-border pb-1">
        {[
          { id: 'control', label: 'Event Control', icon: Sliders },
          { id: 'teams', label: `Teams (${teamsCount})`, icon: Users },
          { id: 'tracks', label: `Tracks (${tracksCount})`, icon: Compass },
          { id: 'statements', label: `Statements (${statementsCount})`, icon: FileText },
          { id: 'settings', label: 'Settings & Logs', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-xl transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-surface-subtle text-text border border-border shadow-subtle'
                  : 'text-text-muted hover:text-text hover:bg-surface/50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-accent' : 'opacity-60'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* TAB 1: EVENT CONTROL */}
      {activeTab === 'control' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Phase Flow Stepper */}
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-subtle space-y-4">
            <h3 className="text-sm font-medium text-text">Event Flow State Machine</h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {[
                { key: 'setup', step: '1. Setup', desc: 'Teams & tracks added' },
                { key: 'tracks_assigned', step: '2. Tracks Assigned', desc: 'Teams see their track' },
                { key: 'submissions_open', step: '3. Submissions Open', desc: 'Teams submit statement' },
                { key: 'submissions_closed', step: '4. Submissions Locked', desc: 'Locked for shuffle' },
                { key: 'statements_assigned', step: '5. Statements Assigned', desc: 'Teams see challenge' },
              ].map((p) => {
                const isCurrent = currentPhase === p.key;
                return (
                  <div
                    key={p.key}
                    onClick={() => handleSetPhase(p.key as Phase)}
                    className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                      isCurrent
                        ? 'border-accent bg-accent/10 shadow-accent-glow'
                        : 'border-border bg-surface-card hover:bg-surface-hover text-text-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono font-medium">
                      <span className={isCurrent ? 'text-accent' : ''}>{p.step}</span>
                      {isCurrent && <span className="w-2 h-2 rounded-full bg-accent animate-ping" />}
                    </div>
                    <p className="text-[11px] text-text-dim mt-1.5 leading-snug">{p.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Action 1: Generate Tracks */}
            <div className="bg-surface rounded-2xl border border-border p-6 shadow-subtle space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
                    <Compass className="w-4 h-4 text-accent" />
                    <span>TRACK ASSIGNMENT</span>
                  </div>
                  <span className="text-[11px] font-mono text-text-dim">
                    {teamsCount}/{totalCapacity} cap
                  </span>
                </div>
                <h4 className="text-base font-medium text-text">Generate Tracks</h4>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  Randomly and evenly distribute {teamsCount} teams across {tracksCount} tracks (max {maxTeamsInput} per track).
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() =>
                    setConfirmModal({
                      isOpen: true,
                      title: 'Confirm Track Generation',
                      description: `This will distribute all ${teamsCount} teams across ${tracksCount} tracks (max ${maxTeamsInput} per track). Any existing track assignments will be overwritten and phase set to 'tracks_assigned'.`,
                      confirmText: 'Generate Tracks Now',
                      variant: 'primary',
                      onConfirm: handleGenerateTracks,
                    })
                  }
                  disabled={actionLoading || teamsCount === 0 || tracksCount === 0}
                  className="w-full py-2.5 px-4 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-all shadow-subtle hover:shadow-accent-glow disabled:opacity-40"
                >
                  Generate Tracks
                </button>
              </div>
            </div>

            {/* Action 2: Submissions Lock/Unlock */}
            <div className="bg-surface rounded-2xl border border-border p-6 shadow-subtle space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
                    <FileText className="w-4 h-4 text-accent" />
                    <span>SUBMISSION GATE</span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400">
                    {submittedCount}/{teamsCount} submitted
                  </span>
                </div>
                <h4 className="text-base font-medium text-text">Submission Access</h4>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  {currentPhase === 'submissions_open'
                    ? 'Submissions are currently OPEN. Teams can write and edit statements.'
                    : 'Submissions are currently LOCKED.'}
                </p>
              </div>

              <div className="pt-2 flex gap-2">
                {currentPhase !== 'submissions_open' ? (
                  <button
                    onClick={() => handleSetPhase('submissions_open')}
                    disabled={actionLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-all shadow-subtle flex items-center justify-center gap-1.5"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Open Submissions</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSetPhase('submissions_closed')}
                    disabled={actionLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-all shadow-subtle flex items-center justify-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Close Submissions</span>
                  </button>
                )}
              </div>
            </div>

            {/* Action 3: Shuffle & Assign Statements */}
            <div className="bg-surface rounded-2xl border border-border p-6 shadow-subtle space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-mono text-accent">
                    <Shuffle className="w-4 h-4" />
                    <span>DERANGEMENT SHUFFLE</span>
                  </div>
                  <span className="text-[11px] font-mono text-text-dim">
                    {statementsCount} in pool
                  </span>
                </div>
                <h4 className="text-base font-medium text-text">Shuffle & Assign</h4>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  Shuffles statement pool to teams ensuring strictly that <strong>no team receives its own statement</strong>.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() =>
                    setConfirmModal({
                      isOpen: true,
                      title: 'Confirm Statement Shuffle',
                      description: `Shuffle ${statementsCount} statements to ${teamsCount} teams. Strict derangement algorithm guarantees no team gets its own statement. Teams will immediately see their assigned challenge live!`,
                      confirmText: 'Shuffle & Assign Live',
                      variant: 'primary',
                      onConfirm: handleShuffleStatements,
                    })
                  }
                  disabled={actionLoading || statementsCount < teamsCount || teamsCount === 0}
                  className="w-full py-2.5 px-4 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-all shadow-subtle hover:shadow-accent-glow disabled:opacity-40"
                >
                  Shuffle & Assign Statements
                </button>
              </div>
            </div>
          </div>

          {/* Configuration & Reset Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface rounded-2xl border border-border p-6 shadow-subtle space-y-4">
              <h4 className="text-sm font-medium text-text">Capacity Settings</h4>
              <div className="flex items-center gap-3">
                <label className="text-xs text-text-muted flex-shrink-0">
                  Max teams per track:
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={maxTeamsInput}
                  onChange={(e) => setMaxTeamsInput(parseInt(e.target.value) || 1)}
                  className="w-20 bg-surface-card text-text text-xs rounded-xl border border-border px-3 py-2 outline-none focus:border-accent font-mono"
                />
                <button
                  onClick={handleSaveConfig}
                  className="px-3 py-2 rounded-xl bg-surface-subtle hover:bg-surface-hover text-text text-xs border border-border transition-colors"
                >
                  Save
                </button>
              </div>
              <p className="text-[11px] text-text-dim">
                Total capacity: {tracksCount} tracks × {maxTeamsInput} = {tracksCount * maxTeamsInput} teams capacity. Currently {teamsCount} registered.
              </p>
            </div>

            <div className="bg-surface rounded-2xl border border-border p-6 shadow-subtle space-y-4">
              <h4 className="text-sm font-medium text-text text-rose-400">Reset Assignments</h4>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setConfirmModal({
                      isOpen: true,
                      title: 'Reset Tracks',
                      description: 'Reset all team track assignments and revert phase to setup?',
                      confirmText: 'Reset Tracks',
                      variant: 'danger',
                      onConfirm: () => handleReset('tracks'),
                    })
                  }
                  className="px-3 py-2 rounded-xl bg-surface-subtle hover:bg-rose-500/10 text-rose-400 text-xs border border-border hover:border-rose-500/30 transition-colors"
                >
                  Reset Tracks
                </button>

                <button
                  onClick={() =>
                    setConfirmModal({
                      isOpen: true,
                      title: 'Reset Statements',
                      description: 'Reset all team assigned problem statements?',
                      confirmText: 'Reset Statements',
                      variant: 'danger',
                      onConfirm: () => handleReset('statements'),
                    })
                  }
                  className="px-3 py-2 rounded-xl bg-surface-subtle hover:bg-rose-500/10 text-rose-400 text-xs border border-border hover:border-rose-500/30 transition-colors"
                >
                  Reset Statements
                </button>

                <button
                  onClick={() =>
                    setConfirmModal({
                      isOpen: true,
                      title: 'Reset All Assignments',
                      description: 'Reset both tracks and assigned statements and revert to setup phase?',
                      confirmText: 'Reset All',
                      variant: 'danger',
                      onConfirm: () => handleReset('all'),
                    })
                  }
                  className="px-3 py-2 rounded-xl bg-surface-subtle hover:bg-rose-500/10 text-rose-400 text-xs border border-border hover:border-rose-500/30 transition-colors"
                >
                  Reset All
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* TAB 2: TEAMS */}
      {activeTab === 'teams' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text">Registered Teams ({teamsCount})</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsBulkAddOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Bulk Add (CSV)</span>
              </button>
              <button
                onClick={() => setIsAddTeamOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-all shadow-subtle"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Team</span>
              </button>
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-subtle border-b border-border text-text-muted font-mono text-[11px] uppercase">
                  <tr>
                    <th className="py-3 px-4 font-medium">Team Name</th>
                    <th className="py-3 px-4 font-medium">Code</th>
                    <th className="py-3 px-4 font-medium">Assigned Track</th>
                    <th className="py-3 px-4 font-medium">Submission Status</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.teams.map((team) => (
                    <tr key={team.id} className="hover:bg-surface-card transition-colors">
                      <td className="py-3 px-4 font-medium text-text">{team.name}</td>
                      <td className="py-3 px-4 font-mono text-accent-light">{team.code}</td>
                      <td className="py-3 px-4 text-text-muted">
                        {team.track_name ? (
                          <span className="px-2 py-0.5 rounded-md bg-surface-subtle border border-border font-mono text-[11px]">
                            {team.track_name}
                          </span>
                        ) : (
                          <span className="text-text-dim font-mono text-[11px]">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {team.has_submitted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Submitted</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-text-dim">Pending</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleRegenerateCode(team.id, team.name)}
                            title="Regenerate team code"
                            className="p-1 rounded-lg text-text-muted hover:text-accent hover:bg-surface-subtle transition-colors"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTeam(team.id, team.name)}
                            title="Delete team"
                            className="p-1 rounded-lg text-text-muted hover:text-rose-400 hover:bg-surface-subtle transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data?.teams.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-text-dim font-mono">
                        No teams added yet. Click &quot;Add Team&quot; or &quot;Bulk Add&quot; to begin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* TAB 3: TRACKS */}
      {activeTab === 'tracks' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text">Tracks ({tracksCount})</h3>
            <button
              onClick={() => {
                setEditingTrack(null);
                setTrackNameInput('');
                setIsTrackModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-all shadow-subtle"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Track</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.tracks.map((tr) => (
              <div
                key={tr.id}
                className="bg-surface rounded-2xl border border-border p-5 shadow-subtle space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-accent uppercase tracking-wider">
                      Domain
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingTrack(tr);
                          setTrackNameInput(tr.name);
                          setIsTrackModalOpen(true);
                        }}
                        className="p-1 rounded text-text-muted hover:text-text"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteTrack(tr.id, tr.name)}
                        className="p-1 rounded text-text-muted hover:text-rose-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <h4 className="text-base font-light text-text">{tr.name}</h4>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between text-[11px] font-mono text-text-muted">
                    <span>Teams assigned:</span>
                    <span className="text-text font-medium">
                      {tr.team_count} / {maxTeamsInput}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-subtle rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (tr.team_count / maxTeamsInput) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* TAB 4: STATEMENTS */}
      {activeTab === 'statements' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text">Problem Statements Pool ({statementsCount})</h3>
            <button
              onClick={() => setIsStatementModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-all shadow-subtle"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Admin Statement</span>
            </button>
          </div>

          <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden shadow-subtle">
            {data?.statements.map((stmt) => (
              <div key={stmt.id} className="p-4 hover:bg-surface-card transition-colors space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                        stmt.source === 'admin'
                          ? 'bg-accent/10 border-accent/20 text-accent-light'
                          : 'bg-surface-subtle border-border text-text-muted'
                      }`}
                    >
                      {stmt.source === 'admin' ? 'ADMIN POOL' : 'TEAM SUBMISSION'}
                    </span>
                    <span className="text-xs font-medium text-text">{stmt.author_name}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteStatement(stmt.id)}
                    className="p-1 rounded text-text-muted hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-text-muted leading-relaxed whitespace-pre-wrap">{stmt.body}</p>
              </div>
            ))}
            {data?.statements.length === 0 && (
              <div className="p-8 text-center text-xs text-text-dim font-mono">
                No problem statements yet. Add admin statements or open submissions for teams.
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* TAB 5: SETTINGS & LOGS */}
      {activeTab === 'settings' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Password Change Form */}
            <div className="bg-surface rounded-2xl border border-border p-6 shadow-subtle space-y-4">
              <h3 className="text-sm font-medium text-text flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-accent" />
                <span>Change Admin Password</span>
              </h3>
              <p className="text-xs text-text-muted">
                Admin password is saved strictly as a salted bcrypt hash in PostgreSQL.
              </p>

              <form onSubmit={handleChangePasswordSubmit} className="space-y-3">
                <input
                  type="password"
                  placeholder="Current Password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full bg-surface-card text-text text-xs rounded-xl border border-border p-3 outline-none focus:border-accent"
                />
                <input
                  type="password"
                  placeholder="New Password (min 8 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-surface-card text-text text-xs rounded-xl border border-border p-3 outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={!oldPassword || newPassword.length < 8}
                  className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-all disabled:opacity-40"
                >
                  Update Password
                </button>
              </form>
            </div>

            {/* Security & System Info */}
            <div className="bg-surface rounded-2xl border border-border p-6 shadow-subtle space-y-3">
              <h3 className="text-sm font-medium text-text">Security Architecture</h3>
              <ul className="text-xs text-text-muted space-y-2 list-disc pl-4 leading-relaxed">
                <li>Row Level Security (RLS) active on all sensitive database tables.</li>
                <li>Zero direct client access with anon key; strictly managed via SECURITY DEFINER stored procedures.</li>
                <li>Throttling &amp; 15-minute lockouts logged in <code className="text-accent font-mono">auth_attempts</code>.</li>
                <li>Cryptographic derangement protects statement anonymity.</li>
              </ul>
            </div>
          </div>

          {/* Realtime Audit Logs */}
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-subtle space-y-4">
            <h3 className="text-sm font-medium text-text">Audit Log (Recent 20 actions)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-subtle border-b border-border text-text-muted font-mono text-[11px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3 font-medium">Timestamp</th>
                    <th className="py-2.5 px-3 font-medium">Action</th>
                    <th className="py-2.5 px-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono text-[11px]">
                  {data?.audit_logs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-card">
                      <td className="py-2 px-3 text-text-dim">
                        {new Date(log.performed_at).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3 text-accent-light">{log.action}</td>
                      <td className="py-2 px-3 text-text-muted truncate max-w-xs">
                        {JSON.stringify(log.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmText={confirmModal.confirmText}
        confirmVariant={confirmModal.variant}
        isLoading={actionLoading}
      />

      {/* Add Team Modal */}
      <Modal
        isOpen={isAddTeamOpen}
        onClose={() => setIsAddTeamOpen(false)}
        title="Add Team"
        description="Create a single team. If code is left empty, a unique random code will be generated."
      >
        <form onSubmit={handleAddTeamSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Team Name (e.g. Quantum Leap)"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            required
            className="w-full bg-surface-card text-text text-xs rounded-xl border border-border p-3 outline-none focus:border-accent"
          />
          <input
            type="text"
            placeholder="Custom Code (Optional, e.g. NEX-4091)"
            value={newTeamCode}
            onChange={(e) => setNewTeamCode(e.target.value.toUpperCase())}
            className="w-full bg-surface-card text-text text-xs rounded-xl border border-border p-3 outline-none focus:border-accent uppercase font-mono"
          />
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!newTeamName.trim()}
              className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-all"
            >
              Add Team
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Add Teams Modal */}
      <Modal
        isOpen={isBulkAddOpen}
        onClose={() => setIsBulkAddOpen(false)}
        title="Bulk Add Teams (CSV / List)"
        description="Paste team names (one per line, or Name,Code format). Codes will be auto-generated if omitted."
      >
        <form onSubmit={handleBulkAddSubmit} className="space-y-3">
          <textarea
            rows={6}
            placeholder={`Quantum Leap\nCyberPulse,CYBER-01\nAeroDynamics\nSynapse Labs`}
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            className="w-full bg-surface-card text-text text-xs rounded-xl border border-border p-3 outline-none focus:border-accent font-mono"
          />
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!bulkInput.trim()}
              className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-all"
            >
              Process Bulk Upload
            </button>
          </div>
        </form>
      </Modal>

      {/* Track Modal */}
      <Modal
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
        title={editingTrack ? 'Edit Track' : 'Add Track'}
      >
        <form onSubmit={handleSaveTrack} className="space-y-3">
          <input
            type="text"
            placeholder="Track Name (e.g. AI & Machine Learning)"
            value={trackNameInput}
            onChange={(e) => setTrackNameInput(e.target.value)}
            required
            className="w-full bg-surface-card text-text text-xs rounded-xl border border-border p-3 outline-none focus:border-accent"
          />
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!trackNameInput.trim()}
              className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-all"
            >
              {editingTrack ? 'Save Changes' : 'Create Track'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Statement Modal */}
      <Modal
        isOpen={isStatementModalOpen}
        onClose={() => setIsStatementModalOpen(false)}
        title="Add Statement to Pool"
        description="Add a pre-curated problem statement directly to the shuffle pool."
      >
        <form onSubmit={handleAddStatementSubmit} className="space-y-3">
          <textarea
            rows={4}
            maxLength={500}
            placeholder="Write problem statement (10–500 chars)..."
            value={newStatementBody}
            onChange={(e) => setNewStatementBody(e.target.value)}
            className="w-full bg-surface-card text-text text-xs rounded-xl border border-border p-3 outline-none focus:border-accent"
          />
          <div className="flex justify-between items-center text-[11px] font-mono text-text-dim pt-1">
            <span>{newStatementBody.length}/500</span>
            <button
              type="submit"
              disabled={newStatementBody.trim().length < 10}
              className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-all disabled:opacity-40"
            >
              Add to Pool
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
