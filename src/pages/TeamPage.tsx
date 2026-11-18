import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Check, Compass, FileText, Send, Sparkles, Clock } from 'lucide-react';
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

  useEffect(() => {
    fetchData();

    // Supabase Realtime subscription on event_state
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

    // Fallback polling interval
    const interval = setInterval(fetchData, 3000);

    return () => {
      supabase.removeChannel(channel);
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
    <div className="min-h-screen bg-black text-white pb-24 pt-8 px-6 max-w-3xl mx-auto space-y-8 selection:bg-white selection:text-black">
      {/* Top Header: Monochromatic Architectural Bar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-display font-medium uppercase tracking-tight text-white">
              {data?.team_name || session.team_name}
            </h1>
            <span className="font-mono text-xs px-2.5 py-1 border border-white/20 bg-white/5 text-neutral-300">
              {data?.team_code || session.team_code}
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-neutral-500 pt-1">
            <span>EVENT STATUS:</span>
            {data ? <PhaseBadge phase={data.phase} size="sm" /> : <span>CONNECTING...</span>}
          </div>
        </div>

        <button
          onClick={onLogout}
          aria-label="Logout"
          className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400 hover:text-white border border-white/10 hover:border-white/40 px-3.5 py-2 bg-neutral-950 transition-colors self-start sm:self-auto"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit Session</span>
        </button>
      </header>

      {/* Main Single-Column Stack */}
      <div className="space-y-6">
        {/* 1. Track Assignment Card */}
        <div className="border border-white/15 bg-neutral-950 p-6 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-neutral-500 uppercase tracking-widest border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Compass className="w-3.5 h-3.5 text-white" />
              <span>Assigned Track</span>
            </div>
            {data?.track && (
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 border border-white/20 bg-white/10 text-white">
                Active Assignment
              </span>
            )}
          </div>

          <AnimatePresence mode="wait">
            {data?.track ? (
              <motion.div
                key="track-assigned"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-2 pt-2"
              >
                <div className="text-3xl md:text-4xl font-display uppercase tracking-tight text-white">
                  {data.track}
                </div>
                <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                  Your team is designated to compete in this technical domain. Your submitted problem statement should address challenges within this sphere.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="track-waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-6 flex items-center gap-3 text-neutral-500"
              >
                <span className="w-1.5 h-1.5 bg-white inline-block" />
                <span className="text-xs font-mono uppercase tracking-widest text-neutral-400">
                  Track assignment will appear once coordinator initiates phase
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 2. Problem Statement Drafting Box */}
        <div className="border border-white/15 bg-neutral-950 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 uppercase tracking-widest">
              <FileText className="w-3.5 h-3.5 text-white" />
              <span>Your Problem Statement</span>
            </div>

            {hasSubmitted && (
              <span className="flex items-center gap-1.5 text-xs font-mono text-white bg-white/10 border border-white/30 px-2.5 py-0.5">
                <Check className="w-3 h-3 text-white" />
                <span>SUBMITTED ✓</span>
              </span>
            )}
          </div>

          <p className="text-xs text-neutral-400 font-sans leading-relaxed">
            Formulate a rigorous technical problem statement (10 to 500 characters). Following the admin shuffle, another team will be tasked with architecting a solution for your challenge.
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
                rows={5}
                maxLength={500}
                placeholder={
                  isSubmissionsOpen
                    ? 'State the problem concisely: core objective, constraints, and success criteria...'
                    : data?.phase === 'setup' || data?.phase === 'tracks_assigned'
                    ? 'Submissions are currently locked. The drafting phase has not been initiated.'
                    : 'Submissions are permanently locked for derangement shuffle.'
                }
                className="w-full bg-black text-white text-xs md:text-sm font-sans p-4 border border-white/20 focus:border-white focus:outline-none transition-colors resize-none disabled:opacity-40 disabled:bg-neutral-950 placeholder:text-neutral-700"
              />

              {/* Character Counter */}
              <div className="absolute right-3 bottom-3 text-[11px] font-mono text-neutral-500">
                <span className="text-white">{statementText.length}</span>
                <span>/500</span>
              </div>
            </div>

            {error && (
              <p className="text-xs text-neutral-300 font-mono">
                [ERROR] {error}
              </p>
            )}

            {submitSuccess && (
              <p className="text-xs text-white font-mono flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Problem statement synchronized with event database.</span>
              </p>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div className="text-[11px] font-mono text-neutral-500 flex items-center gap-2">
                {isSubmissionsOpen ? (
                  <span className="text-white flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-white" />
                    SUBMISSIONS UNLOCKED
                  </span>
                ) : (
                  <span className="text-neutral-500 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    GATE LOCKED
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={!isSubmissionsOpen || isSubmitting || statementText.trim().length < 10}
                className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-neutral-200 text-black text-xs font-mono font-medium uppercase tracking-wider transition-colors disabled:opacity-20 disabled:hover:bg-white"
              >
                {isSubmitting ? (
                  <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{hasSubmitted ? 'Update Statement' : 'Submit Statement'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* 3. Assigned Problem Statement Card (Revealed live on derangement) */}
        <AnimatePresence>
          {data?.phase === 'statements_assigned' && (
            <motion.div
              key="assigned-statement"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3 }}
              className="border-2 border-white bg-black p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/20 pb-3">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white">
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>Assigned Challenge // Live Assignment</span>
                </div>
                <span className="text-[10px] font-mono uppercase bg-white text-black px-2 py-0.5 font-bold">
                  Target Challenge
                </span>
              </div>

              <div className="p-5 bg-neutral-950 border border-white/20">
                <p className="text-sm md:text-base font-sans text-white leading-relaxed whitespace-pre-wrap">
                  {data.assigned_statement?.body || 'Statement assignment pending...'}
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 pt-1">
                <span>Cryptographic derangement verified.</span>
                <span>Author: Anonymous</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status prompt when statements are not assigned yet */}
        {data?.phase !== 'statements_assigned' && (
          <div className="text-center py-6 text-xs text-neutral-600 font-mono uppercase tracking-widest">
            {data?.phase === 'submissions_closed'
              ? '// All team submissions locked. Awaiting derangement shuffle //'
              : '// Assigned challenge will be revealed upon event shuffle //'}
          </div>
        )}
      </div>
    </div>
  );
};
