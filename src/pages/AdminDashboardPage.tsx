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
  Check,
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

const SAMPLE_BULK_TEAMS = `Quantum Leap,NEX-1001
CyberPulse,NEX-1002
AeroDynamics,NEX-1003
Synapse Labs,NEX-1004
HyperDrive,NEX-1005
ZeroDay Hunters,NEX-1006
Vortex Minds,NEX-1007
AlgoRhythm,NEX-1008
DeepForge,NEX-1009
ByteCrafters,NEX-1010
Solaris Squad,NEX-1011
Helix Innovators,NEX-1012
OmniShield,NEX-1013
EchoLogic,NEX-1014
VectorEdge,NEX-1015
Phantom Protocol,NEX-1016
Nebula Dynamics,NEX-1017
ChronoByte,NEX-1018
Apex Intellect,NEX-1019
Horizon Matrix,NEX-1020`;

const SAMPLE_TRACKS = [
  'Artificial Intelligence & Agents',
  'Decentralized Systems & Web3',
  'Cybersecurity & Privacy Shield',
  'Fintech & Algorithmic Markets',
  'Healthcare & BioTech Solutions',
  'Climate Tech & Clean Energy',
];

const SAMPLE_STATEMENTS = [
  'Design a zero-knowledge identity verification gateway for decentralized autonomous organizations without storing biometric data.',
  'Create an offline-first mesh disaster relief coordinator using Bluetooth Low Energy and localized vector embeddings.',
  'Build an autonomous agent pipeline that detects subtle smart contract reentrancy bugs using formal symbolic execution.',
  'Develop an ultra-low latency real-time telemetry anomaly detector for electric vehicle battery cell degradation.',
];

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  token,
  onLogout,
  onNavigateHome,
}) => {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('control');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Confirmation modal
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

    const interval = setInterval(fetchOverview, 4000);

    return () => {
      supabase.removeChannel(channel);
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
      description: `Confirm permanent removal of team "${name}"? All related submissions will be pruned.`,
      confirmText: 'Delete Team',
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
      showNotification(`New code for ${name}: ${res.new_code}`);
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
      description: `Delete track "${name}"? Assigned teams will revert to unassigned.`,
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
      showNotification('Admin statement added to pool.');
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
      showNotification('Statement removed.');
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
    <div className="min-h-screen bg-black text-white pb-24 pt-8 px-6 max-w-6xl mx-auto space-y-8 selection:bg-white selection:text-black">
      {/* Top Architectural Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl md:text-4xl font-display font-medium uppercase tracking-tight text-white">
              Nexus E-0 // Admin Console
            </h1>
            <PhaseBadge phase={currentPhase} size="md" />
          </div>
          <p className="text-xs font-mono text-neutral-500 mt-1 uppercase tracking-wider">
            {teamsCount} Teams // {tracksCount} Tracks // {statementsCount} Challenge Pool // {submittedCount} Submitted
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={fetchOverview}
            className="p-2.5 bg-neutral-950 border border-white/10 hover:border-white/40 text-neutral-400 hover:text-white transition-colors"
            title="Refresh state"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-950 border border-white/10 hover:border-white/40 text-neutral-400 hover:text-white uppercase tracking-wider transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Landing</span>
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-950 border border-white/10 hover:border-white/40 text-neutral-400 hover:text-white uppercase tracking-wider transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit</span>
          </button>
        </div>
      </header>

      {/* Notification Banner */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`p-3 text-xs font-mono border flex items-center justify-between gap-2 ${
              message.type === 'error'
                ? 'bg-neutral-900 border-white/30 text-white'
                : 'bg-white text-black border-white'
            }`}
          >
            <span>[NOTIFICATION] {message.text}</span>
            <button onClick={() => setMessage(null)} className="font-bold">
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-px bg-white/10 border border-white/10 p-px overflow-x-auto font-mono text-xs uppercase tracking-wider">
        {[
          { id: 'control', label: 'Event Flow', icon: Sliders },
          { id: 'teams', label: `Teams [${teamsCount}]`, icon: Users },
          { id: 'tracks', label: `Tracks [${tracksCount}]`, icon: Compass },
          { id: 'statements', label: `Statements [${statementsCount}]`, icon: FileText },
          { id: 'settings', label: 'Settings & Security', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-5 py-3 transition-colors whitespace-nowrap ${
                isActive ? 'bg-white text-black font-semibold' : 'bg-black text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* TAB 1: EVENT CONTROL */}
      {activeTab === 'control' && (
        <div className="space-y-6">
          {/* Phase Flow Stepper */}
          <div className="border border-white/15 bg-neutral-950 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-display uppercase tracking-wide text-white">Event State Machine</h3>
              <span className="text-[11px] font-mono text-neutral-500 uppercase">Click any phase to override state</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {[
                { key: 'setup', step: '01. Setup', desc: 'Teams & tracks added' },
                { key: 'tracks_assigned', step: '02. Tracks Assigned', desc: 'Teams see their track' },
                { key: 'submissions_open', step: '03. Submissions Open', desc: 'Teams submit statement' },
                { key: 'submissions_closed', step: '04. Locked', desc: 'Frozen for derangement' },
                { key: 'statements_assigned', step: '05. Statements Live', desc: 'Challenges distributed' },
              ].map((p) => {
                const isCurrent = currentPhase === p.key;
                return (
                  <div
                    key={p.key}
                    onClick={() => handleSetPhase(p.key as Phase)}
                    className={`cursor-pointer p-4 border transition-all ${
                      isCurrent
                        ? 'border-white bg-white text-black font-medium'
                        : 'border-white/10 bg-black text-neutral-400 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-xs uppercase font-semibold">
                      <span>{p.step}</span>
                      {isCurrent && <span className="w-2 h-2 bg-black inline-block" />}
                    </div>
                    <p className={`text-[11px] mt-1 leading-snug font-sans ${isCurrent ? 'text-neutral-800' : 'text-neutral-500'}`}>
                      {p.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Primary Operations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Action 1: Generate Tracks */}
            <div className="border border-white/15 bg-neutral-950 p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 uppercase tracking-wider border-b border-white/10 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-white" />
                    Track Assignment
                  </span>
                  <span>{teamsCount}/{totalCapacity} CAP</span>
                </div>
                <h4 className="text-2xl font-display uppercase tracking-tight text-white">Generate Tracks</h4>
                <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                  Randomly and evenly distributes {teamsCount} teams across {tracksCount} tracks (max {maxTeamsInput} per track).
                </p>
              </div>

              <button
                onClick={() =>
                  setConfirmModal({
                    isOpen: true,
                    title: 'Generate Track Allocations',
                    description: `This will distribute ${teamsCount} teams evenly across ${tracksCount} tracks (capacity: ${totalCapacity}). Existing track assignments will be overwritten and phase set to 'tracks_assigned'.`,
                    confirmText: 'Execute Allocation',
                    variant: 'primary',
                    onConfirm: handleGenerateTracks,
                  })
                }
                disabled={actionLoading || teamsCount === 0 || tracksCount === 0}
                className="w-full py-3 px-4 bg-white hover:bg-neutral-200 text-black font-mono text-xs uppercase tracking-wider font-medium transition-colors disabled:opacity-20 disabled:hover:bg-white"
              >
                Generate Tracks
              </button>
            </div>

            {/* Action 2: Submission Gate */}
            <div className="border border-white/15 bg-neutral-950 p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 uppercase tracking-wider border-b border-white/10 pb-2">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-white" />
                    Submission Gate
                  </span>
                  <span>{submittedCount}/{teamsCount} READY</span>
                </div>
                <h4 className="text-2xl font-display uppercase tracking-tight text-white">Submission Lock</h4>
                <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                  {currentPhase === 'submissions_open'
                    ? 'Submissions are currently OPEN. Teams can write and edit statements.'
                    : 'Submissions are currently LOCKED.'}
                </p>
              </div>

              <div>
                {currentPhase !== 'submissions_open' ? (
                  <button
                    onClick={() => handleSetPhase('submissions_open')}
                    disabled={actionLoading}
                    className="w-full py-3 px-4 bg-white hover:bg-neutral-200 text-black font-mono text-xs uppercase tracking-wider font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Open Submissions</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSetPhase('submissions_closed')}
                    disabled={actionLoading}
                    className="w-full py-3 px-4 border border-white/30 bg-neutral-900 hover:bg-neutral-800 text-white font-mono text-xs uppercase tracking-wider font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Lock Submissions</span>
                  </button>
                )}
              </div>
            </div>

            {/* Action 3: Derangement Shuffle */}
            <div className="border border-white/15 bg-neutral-950 p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 uppercase tracking-wider border-b border-white/10 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Shuffle className="w-3.5 h-3.5 text-white" />
                    Derangement
                  </span>
                  <span>{statementsCount} IN POOL</span>
                </div>
                <h4 className="text-2xl font-display uppercase tracking-tight text-white">Shuffle &amp; Assign</h4>
                <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                  Runs transactional cryptographic derangement ensuring strictly that <strong>no team receives its own statement</strong>.
                </p>
              </div>

              <button
                onClick={() =>
                  setConfirmModal({
                    isOpen: true,
                    title: 'Trigger Derangement Shuffle',
                    description: `Shuffle ${statementsCount} statements to ${teamsCount} teams. Strict derangement algorithm guarantees no team gets its own statement. Teams will immediately see their assigned challenge live!`,
                    confirmText: 'Trigger Live Shuffle',
                    variant: 'primary',
                    onConfirm: handleShuffleStatements,
                  })
                }
                disabled={actionLoading || statementsCount < teamsCount || teamsCount === 0}
                className="w-full py-3 px-4 bg-white hover:bg-neutral-200 text-black font-mono text-xs uppercase tracking-wider font-medium transition-colors disabled:opacity-20 disabled:hover:bg-white"
              >
                Shuffle &amp; Assign Statements
              </button>
            </div>
          </div>

          {/* Config & Reset */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-white/15 bg-neutral-950 p-6 space-y-4">
              <h4 className="text-base font-display uppercase tracking-wide text-white">Track Density Config</h4>
              <div className="flex items-center gap-3">
                <label className="text-xs font-mono text-neutral-400 uppercase">
                  Max teams per track:
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={maxTeamsInput}
                  onChange={(e) => setMaxTeamsInput(parseInt(e.target.value) || 1)}
                  className="w-20 bg-black text-white text-xs border border-white/20 px-3 py-2 outline-none focus:border-white font-mono"
                />
                <button
                  onClick={handleSaveConfig}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-mono uppercase tracking-wider border border-white/20 transition-colors"
                >
                  Save
                </button>
              </div>
              <p className="text-[11px] text-neutral-500 font-mono">
                Capacity calculation: {tracksCount} tracks × {maxTeamsInput} max/track = {tracksCount * maxTeamsInput} total slots. Currently {teamsCount} registered teams.
              </p>
            </div>

            <div className="border border-white/15 bg-neutral-950 p-6 space-y-4">
              <h4 className="text-base font-display uppercase tracking-wide text-white">Assignment Reset Operations</h4>
              <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
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
                  className="px-3.5 py-2 border border-white/15 hover:border-white/40 text-neutral-300 hover:text-white uppercase tracking-wider transition-colors"
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
                  className="px-3.5 py-2 border border-white/15 hover:border-white/40 text-neutral-300 hover:text-white uppercase tracking-wider transition-colors"
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
                  className="px-3.5 py-2 border border-white/25 hover:border-white text-white uppercase tracking-wider transition-colors"
                >
                  Reset All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TEAMS */}
      {activeTab === 'teams' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-display uppercase tracking-wide text-white">Registered Teams [{teamsCount}]</h3>
            <div className="flex items-center gap-2 font-mono text-xs">
              <button
                onClick={() => {
                  setBulkInput(SAMPLE_BULK_TEAMS);
                  setIsBulkAddOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 border border-white/15 hover:border-white/40 bg-neutral-950 text-neutral-300 hover:text-white uppercase tracking-wider transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Bulk Add (CSV)</span>
              </button>
              <button
                onClick={() => setIsAddTeamOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-neutral-200 text-black font-semibold uppercase tracking-wider transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Team</span>
              </button>
            </div>
          </div>

          <div className="border border-white/15 bg-neutral-950 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-black border-b border-white/10 text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 font-medium">Team Name</th>
                    <th className="py-3 px-4 font-medium">Code</th>
                    <th className="py-3 px-4 font-medium">Assigned Track</th>
                    <th className="py-3 px-4 font-medium">Submission Status</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 font-mono text-xs">
                  {data?.teams.map((team) => (
                    <tr key={team.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-sans font-medium text-white">{team.name}</td>
                      <td className="py-3 px-4 text-white font-bold tracking-wider">{team.code}</td>
                      <td className="py-3 px-4 text-neutral-400 font-sans">
                        {team.track_name ? (
                          <span className="px-2 py-0.5 border border-white/10 bg-white/5 text-[11px] font-mono">
                            {team.track_name}
                          </span>
                        ) : (
                          <span className="text-neutral-600 font-mono text-[11px]">// UNASSIGNED</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {team.has_submitted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-white bg-white/10 px-2 py-0.5 border border-white/20">
                            <Check className="w-3 h-3 text-white" />
                            <span>SUBMITTED</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-neutral-600">// PENDING</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleRegenerateCode(team.id, team.name)}
                            title="Regenerate team code"
                            className="p-1 text-neutral-400 hover:text-white transition-colors"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTeam(team.id, team.name)}
                            title="Delete team"
                            className="p-1 text-neutral-400 hover:text-white transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data?.teams.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-xs text-neutral-500 font-mono uppercase tracking-widest">
                        No teams registered. Click &quot;Add Team&quot; or &quot;Bulk Add&quot; to populate roster.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TRACKS */}
      {activeTab === 'tracks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-display uppercase tracking-wide text-white">Tracks [{tracksCount}]</h3>
            <button
              onClick={() => {
                setEditingTrack(null);
                setTrackNameInput('');
                setIsTrackModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-neutral-200 text-black font-semibold text-xs font-mono uppercase tracking-wider transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Track</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.tracks.map((tr) => (
              <div
                key={tr.id}
                className="border border-white/15 bg-neutral-950 p-5 space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase text-neutral-500 border-b border-white/10 pb-2 mb-2">
                    <span>TRACK DOMAIN</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingTrack(tr);
                          setTrackNameInput(tr.name);
                          setIsTrackModalOpen(true);
                        }}
                        className="p-1 text-neutral-400 hover:text-white"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteTrack(tr.id, tr.name)}
                        className="p-1 text-neutral-400 hover:text-white"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <h4 className="text-xl font-display uppercase tracking-tight text-white">{tr.name}</h4>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 uppercase">
                    <span>Teams Enrolled:</span>
                    <span className="text-white font-bold">
                      {tr.team_count} / {maxTeamsInput}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-neutral-900 border border-white/10">
                    <div
                      className="h-full bg-white transition-all"
                      style={{
                        width: `${Math.min(100, (tr.team_count / maxTeamsInput) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: STATEMENTS */}
      {activeTab === 'statements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-display uppercase tracking-wide text-white">Problem Statement Pool [{statementsCount}]</h3>
            <button
              onClick={() => {
                setNewStatementBody('');
                setIsStatementModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-neutral-200 text-black font-semibold text-xs font-mono uppercase tracking-wider transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Pool Statement</span>
            </button>
          </div>

          <div className="border border-white/15 bg-neutral-950 divide-y divide-white/10">
            {data?.statements.map((stmt) => (
              <div key={stmt.id} className="p-4 hover:bg-white/5 transition-colors space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-[10px] px-2 py-0.5 border border-white/20 bg-white/5 text-neutral-300 uppercase">
                      {stmt.source === 'admin' ? 'ADMIN CURATED' : 'TEAM SUBMISSION'}
                    </span>
                    <span className="text-xs text-white uppercase font-sans font-medium">{stmt.author_name}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteStatement(stmt.id)}
                    className="p-1 text-neutral-400 hover:text-white transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed font-sans whitespace-pre-wrap">{stmt.body}</p>
              </div>
            ))}
            {data?.statements.length === 0 && (
              <div className="p-10 text-center text-xs text-neutral-500 font-mono uppercase tracking-widest">
                No problem statements in pool. Add admin statements or unlock submissions.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: SETTINGS & SECURITY */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Password Management */}
            <div className="border border-white/15 bg-neutral-950 p-6 space-y-4">
              <h3 className="text-lg font-display uppercase tracking-wide text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-white" />
                <span>Change Root Admin Password</span>
              </h3>
              <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                Stored strictly as a salted bcrypt hash (`crypt(..., gen_salt('bf', 10))`) in Postgres.
              </p>

              <form onSubmit={handleChangePasswordSubmit} className="space-y-3 font-mono text-xs">
                <input
                  type="password"
                  placeholder="CURRENT PASSWORD"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full bg-black text-white p-3 border border-white/20 focus:border-white focus:outline-none uppercase placeholder:text-neutral-700"
                />
                <input
                  type="password"
                  placeholder="NEW PASSWORD (MIN 8 CHARS)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-black text-white p-3 border border-white/20 focus:border-white focus:outline-none uppercase placeholder:text-neutral-700"
                />
                <button
                  type="submit"
                  disabled={!oldPassword || newPassword.length < 8}
                  className="px-5 py-2.5 bg-white hover:bg-neutral-200 text-black font-semibold uppercase tracking-wider transition-colors disabled:opacity-20"
                >
                  Update Credentials
                </button>
              </form>
            </div>

            {/* Security Audit Telemetry */}
            <div className="border border-white/15 bg-neutral-950 p-6 space-y-3">
              <h3 className="text-lg font-display uppercase tracking-wide text-white">System Security Architecture</h3>
              <ul className="text-xs text-neutral-400 space-y-2 list-disc pl-4 font-mono leading-relaxed">
                <li>Row Level Security (RLS) active on all PostgreSQL tables.</li>
                <li>Zero direct client anon table access; all actions execute through SECURITY DEFINER stored procedures.</li>
                <li>Brute-force protection: 5 failures log a 15-minute lockout in `auth_attempts`.</li>
                <li>Cryptographic derangement guarantees zero author leakage on shuffle.</li>
              </ul>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="border border-white/15 bg-neutral-950 p-6 space-y-4">
            <h3 className="text-lg font-display uppercase tracking-wide text-white">Audit Log [Recent 20 Operations]</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-black border-b border-white/10 text-neutral-400 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 font-medium">Timestamp</th>
                    <th className="py-2.5 px-3 font-medium">Action</th>
                    <th className="py-2.5 px-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-[11px]">
                  {data?.audit_logs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5">
                      <td className="py-2.5 px-3 text-neutral-500">
                        {new Date(log.performed_at).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-3 text-white font-semibold uppercase">{log.action}</td>
                      <td className="py-2.5 px-3 text-neutral-400 truncate max-w-xs font-mono">
                        {JSON.stringify(log.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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
        title="Add Single Team"
        description="Register a team. Leave code blank to auto-generate unique code."
      >
        <form onSubmit={handleAddTeamSubmit} className="space-y-3 font-mono text-xs">
          <input
            type="text"
            placeholder="TEAM NAME (E.G. QUANTUM LEAP)"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            required
            className="w-full bg-black text-white p-3 border border-white/20 focus:border-white focus:outline-none uppercase placeholder:text-neutral-700"
          />
          <input
            type="text"
            placeholder="CUSTOM CODE (OPTIONAL, E.G. NEX-4091)"
            value={newTeamCode}
            onChange={(e) => setNewTeamCode(e.target.value.toUpperCase())}
            className="w-full bg-black text-white p-3 border border-white/20 focus:border-white focus:outline-none uppercase placeholder:text-neutral-700"
          />
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!newTeamName.trim()}
              className="px-5 py-2.5 bg-white hover:bg-neutral-200 text-black font-semibold uppercase tracking-wider transition-colors disabled:opacity-20"
            >
              Register Team
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Add Teams Modal */}
      <Modal
        isOpen={isBulkAddOpen}
        onClose={() => setIsBulkAddOpen(false)}
        title="Bulk Roster Ingestion"
        description="Paste team list (Name,Code format or Name only). Codes will be generated if omitted."
      >
        <form onSubmit={handleBulkAddSubmit} className="space-y-3 font-mono text-xs">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setBulkInput(SAMPLE_BULK_TEAMS)}
              className="text-[11px] text-neutral-400 hover:text-white underline underline-offset-4"
            >
              Load 20 Sample Teams
            </button>
          </div>
          <textarea
            rows={7}
            placeholder={`Quantum Leap,NEX-1001\nCyberPulse,NEX-1002\nAeroDynamics,NEX-1003`}
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            className="w-full bg-black text-white p-3 border border-white/20 focus:border-white focus:outline-none font-mono"
          />
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!bulkInput.trim()}
              className="px-5 py-2.5 bg-white hover:bg-neutral-200 text-black font-semibold uppercase tracking-wider transition-colors disabled:opacity-20"
            >
              Ingest Roster
            </button>
          </div>
        </form>
      </Modal>

      {/* Track Modal */}
      <Modal
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
        title={editingTrack ? 'Edit Track Domain' : 'Add Track Domain'}
      >
        <form onSubmit={handleSaveTrack} className="space-y-3 font-mono text-xs">
          <div className="flex justify-end">
            {!editingTrack && (
              <button
                type="button"
                onClick={() => setTrackNameInput(SAMPLE_TRACKS[Math.floor(Math.random() * SAMPLE_TRACKS.length)])}
                className="text-[11px] text-neutral-400 hover:text-white underline underline-offset-4"
              >
                Sample Track
              </button>
            )}
          </div>
          <input
            type="text"
            placeholder="TRACK NAME (E.G. AI & AGENTS)"
            value={trackNameInput}
            onChange={(e) => setTrackNameInput(e.target.value)}
            required
            className="w-full bg-black text-white p-3 border border-white/20 focus:border-white focus:outline-none uppercase placeholder:text-neutral-700"
          />
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!trackNameInput.trim()}
              className="px-5 py-2.5 bg-white hover:bg-neutral-200 text-black font-semibold uppercase tracking-wider transition-colors disabled:opacity-20"
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
        title="Add Curated Pool Statement"
        description="Insert an admin problem statement directly into the derangement pool."
      >
        <form onSubmit={handleAddStatementSubmit} className="space-y-3 text-xs">
          <div className="flex justify-end font-mono">
            <button
              type="button"
              onClick={() => setNewStatementBody(SAMPLE_STATEMENTS[Math.floor(Math.random() * SAMPLE_STATEMENTS.length)])}
              className="text-[11px] text-neutral-400 hover:text-white underline underline-offset-4"
            >
              Load Sample Statement
            </button>
          </div>
          <textarea
            rows={5}
            maxLength={500}
            placeholder="Write challenge statement (10–500 chars)..."
            value={newStatementBody}
            onChange={(e) => setNewStatementBody(e.target.value)}
            className="w-full bg-black text-white p-3 border border-white/20 focus:border-white focus:outline-none font-sans"
          />
          <div className="flex justify-between items-center font-mono text-[11px] text-neutral-500 pt-1">
            <span>{newStatementBody.length}/500</span>
            <button
              type="submit"
              disabled={newStatementBody.trim().length < 10}
              className="px-5 py-2.5 bg-white hover:bg-neutral-200 text-black font-semibold uppercase tracking-wider transition-colors disabled:opacity-20"
            >
              Add to Pool
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
