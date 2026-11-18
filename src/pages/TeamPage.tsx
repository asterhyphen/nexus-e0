import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, CheckCircle2, Compass, FileText, Send, Sparkles, Clock } from 'lucide-react';
import { TeamSession, TeamDashboardData } from '../types';
import { apiGetTeamDashboard, apiTeamSubmitStatement, supabase } from '../lib/supabase';
import { PhaseBadge } from '../components/PhaseBadge';
import { problemStatementSchema } from '../schemas';

interface TeamPageProps {
  session: TeamSession;
  onLogout: () => void;
}

export const TeamPage: React.FC<TeamPageProps> = ({ session, onLogout }) => {
  const [data, setData] = useState<TeamDashboardData | null>(null);
  const [statementText, setStatementText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchData = useCallback(async () => {
    try {
      const res = await apiGetTeamDashboard(session.token);
      setData(res);
      if (res.own_statement) {
        setStatementText(res.own_statement.body);
      }
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes('expired')) {
        onLogout();
      }
    }
  }, [session.token, onLogout]);

  // Initial load & Realtime subscription
  useEffect(() => {
    fetchData();

    // 1. Supabase Realtime subscription on event_state
    const channel = supabase
      .channel(`team-realtime-${session.team_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_state' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // 2. Mock mode real-time update event
    const handleMockUpdate = () => {
      fetchData();
    };
    window.addEventListener('nexus0_mock_update', handleMockUpdate);

    // 3. Fallback polling every 3 seconds to guarantee instant reaction
    const interval = setInterval(fetchData, 3000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('nexus0_mock_update', handleMockUpdate);
      clearInterval(interval);
    };
  }, [fetchData, session.team_id]);

  const handleSubmitStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitSuccess(false);

    const validation = problemStatementSchema.safeParse(statementText);
    if (!validation.success) {
      setError(validation.error.errors[0]?.message || 'Invalid problem statement');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiTeamSubmitStatement(session.token, validation.data);
      setSubmitSuccess(true);
      fetchData();
      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit problem statement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubmissionsOpen = data?.phase === 'submissions_open';
  const hasSubmitted = !!data?.own_statement;

  return (
    <div className="min-h-screen pb-20 pt-8 px-4 max-w-2xl mx-auto space-y-6">
      {/* Header bar: Team identity + Logout */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between pb-6 border-b border-border"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-light tracking-tight text-text">
              {data?.team_name || session.team_name}
            </h1>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-surface-subtle border border-border text-text-muted">
              {data?.team_code || session.team_code}
            </span>
          </div>
          <p className="text-xs text-text-muted flex items-center gap-1.5 font-mono">
            <span>Nexus 0</span>
            <span>•</span>
            <span className="text-accent">{data ? <PhaseBadge phase={data.phase} size="sm" /> : 'Connecting...'}</span>
          </p>
        </div>

        <button
          onClick={onLogout}
          aria-label="Logout"
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-rose-400 px-3 py-1.5 rounded-xl bg-surface border border-border hover:border-rose-500/30 transition-all shadow-subtle"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </motion.header>

      {/* Main Single Column Card Layout */}
      <div className="space-y-6">
        {/* 1. Track Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-surface rounded-2xl border border-border p-6 shadow-subtle relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-xs font-mono text-text-muted uppercase tracking-wider">
              <Compass className="w-4 h-4 text-accent" />
              <span>Assigned Track</span>
            </div>
            {data?.track && (
              <span className="text-[10px] font-mono uppercase bg-accent/10 text-accent-light border border-accent/20 px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </div>

          <AnimatePresence mode="wait">
            {data?.track ? (
              <motion.div
                key="track-assigned"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="space-y-1.5"
              >
                <div className="text-2xl font-light text-text tracking-tight">
                  {data.track}
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  Your team is competing in this domain. Frame your problem statement according to this theme.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="track-waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-4 flex items-center gap-3 text-text-muted"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-accent/70 animate-ping flex-shrink-0" />
                <span className="text-sm font-light text-text-muted tracking-wide animate-pulse">
                  Your track will appear soon
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* 2. Problem Statement Submission Box */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-surface rounded-2xl border border-border p-6 shadow-subtle space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono text-text-muted uppercase tracking-wider">
              <FileText className="w-4 h-4 text-accent" />
              <span>Your Problem Statement</span>
            </div>

            {hasSubmitted && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                <span>Submitted ✓</span>
              </span>
            )}
          </div>

          <p className="text-xs text-text-muted leading-relaxed">
            Write a clear, ambitious problem statement (10–500 characters). During the shuffle, another team will be tasked with solving it.
          </p>

          <form onSubmit={handleSubmitStatement} className="space-y-3">
            <div className="relative">
              <textarea
                value={statementText}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    setStatementText(e.target.value);
                  }
                }}
                disabled={!isSubmissionsOpen || isSubmitting}
                rows={4}
                maxLength={500}
                placeholder={
                  isSubmissionsOpen
                    ? 'State the problem concisely, key constraints, and desired impact...'
                    : data?.phase === 'setup' || data?.phase === 'tracks_assigned'
                    ? 'Submissions have not opened yet. Check back soon.'
                    : 'Submissions are locked for this phase.'
                }
                className="w-full bg-surface-card text-text text-sm rounded-xl border border-border p-4 placeholder:text-text-dim focus:border-accent focus:ring-1 focus:ring-accent/40 outline-none transition-all resize-none disabled:opacity-50 disabled:bg-surface-subtle"
              />

              {/* Character counter */}
              <div className="absolute right-3 bottom-3 text-[11px] font-mono text-text-dim">
                <span className={statementText.length >= 480 ? 'text-amber-400 font-semibold' : ''}>
                  {statementText.length}
                </span>
                /500
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-400 font-mono flex items-center gap-1">
                <span>{error}</span>
              </p>
            )}

            {submitSuccess && (
              <p className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Problem statement saved successfully!</span>
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              <div className="text-[11px] text-text-dim font-mono flex items-center gap-1">
                {isSubmissionsOpen ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Submissions Open
                  </span>
                ) : (
                  <span className="text-text-dim flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Submissions Locked
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={!isSubmissionsOpen || isSubmitting || statementText.trim().length < 10}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-all shadow-subtle hover:shadow-accent-glow disabled:opacity-30 disabled:hover:bg-accent disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{hasSubmitted ? 'Update Statement' : 'Submit Statement'}</span>
              </button>
            </div>
          </form>
        </motion.div>

        {/* 3. Assigned Statement Card (Shuffled from another team) */}
        <AnimatePresence>
          {data?.phase === 'statements_assigned' && (
            <motion.div
              key="assigned-statement"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="bg-surface rounded-2xl border-2 border-accent/40 p-6 shadow-accent-glow space-y-4 relative"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono text-accent-light uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <span>Your Assigned Challenge</span>
                </div>
                <span className="text-[10px] font-mono uppercase bg-accent text-white px-2 py-0.5 rounded-full">
                  Assigned Live
                </span>
              </div>

              <div className="p-4 bg-surface-card rounded-xl border border-border/80">
                <p className="text-sm md:text-base font-light text-text leading-relaxed whitespace-pre-wrap">
                  {data.assigned_statement?.body || 'Statement assignment pending...'}
                </p>
              </div>

              <p className="text-[11px] text-text-dim font-mono">
                Assigned via cryptographic derangement. Author identity remains anonymous.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Waiting prompt when statements are not assigned yet */}
        {data?.phase !== 'statements_assigned' && (
          <div className="text-center py-6 text-xs text-text-dim font-mono select-none">
            {data?.phase === 'submissions_closed'
              ? 'All submissions locked. Shuffling in progress...'
              : 'Assigned challenge will appear once admin initiates the shuffle.'}
          </div>
        )}
      </div>
    </div>
  );
};
