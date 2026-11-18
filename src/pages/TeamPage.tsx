import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Check, Compass, FileText, Send, Sparkles, Clock, Copy, RefreshCw } from 'lucide-react';
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
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInitializedRef = useRef(false);
  const hadSubmittedRef = useRef(false);

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const res = await apiGetTeamDashboard(session.token);
      setData(res);

      if (!isInitializedRef.current) {
        // Initial load: populate only if a submitted statement exists in DB
        if (res.own_statement?.body) {
          setStatementText(res.own_statement.body);
          hadSubmittedRef.current = true;
        } else {
          setStatementText('');
          hadSubmittedRef.current = false;
        }
        isInitializedRef.current = true;
      } else {
        // Background sync:
        // If team previously submitted, but now res.own_statement is NULL (ADMIN HAS RESET!),
        // immediately clear the textarea and reset submitted status!
        if (hadSubmittedRef.current && !res.own_statement) {
          setStatementText('');
          hadSubmittedRef.current = false;
        } else if (res.own_statement) {
          hadSubmittedRef.current = true;
        }
      }
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes('expired')) {
        onLogout();
      }
    } finally {
      if (manual) {
        setTimeout(() => setIsRefreshing(false), 500);
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

    // Regular polling interval
    const interval = setInterval(() => {
      fetchData();
    }, 3000);

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
      hadSubmittedRef.current = true;
      await fetchData();
      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit problem statement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyChallenge = () => {
    const textToCopy = data?.assigned_statement?.body;
    if (!textToCopy) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isSubmissionsOpen = data?.phase === 'submissions_open';
  const hasSubmitted = !!data?.own_statement;
  const isStatementsAssigned = data?.phase === 'statements_assigned';

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
            <button
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              title="Refresh live data"
              className="ml-2 inline-flex items-center gap-1 text-[11px] font-mono text-neutral-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-white' : ''}`} />
              <span>{isRefreshing ? 'SYNCING...' : 'SYNC'}</span>
            </button>
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
        {/* 1. ASSIGNED CHALLENGE (TOP PRIORITY IN FINAL ROUND) */}
        <AnimatePresence>
          {isStatementsAssigned && (
            <motion.div
              key="assigned-statement-top"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="border-2 border-white bg-black p-6 space-y-4 shadow-[0_0_30px_rgba(255,255,255,0.05)]"
            >
              <div className="flex items-center justify-between border-b border-white/20 pb-3">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white">
                  <Sparkles className="w-4 h-4 text-white" />
                  <span className="font-bold">Assigned Problem Statement // Live Target</span>
                </div>
                <span className="text-[10px] font-mono uppercase bg-white text-black px-2 py-0.5 font-bold tracking-wider">
                  FINAL ROUND CHALLENGE
                </span>
              </div>

              <div className="p-5 bg-neutral-950 border border-white/20 space-y-3">
                <p className="text-base md:text-lg font-sans text-white leading-relaxed whitespace-pre-wrap selection:bg-white selection:text-black">
                  {data?.assigned_statement?.body || 'Statement assignment pending...'}
                </p>

                {data?.assigned_statement?.body && (
                  <div className="pt-2 border-t border-white/10 flex items-center justify-end">
                    <button
                      onClick={handleCopyChallenge}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase border border-white/20 hover:border-white text-neutral-300 hover:text-white bg-black transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>COPIED TO CLIPBOARD</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>COPY STATEMENT</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] font-mono text-neutral-400 pt-1 gap-2">
                <span className="flex items-center gap-1.5 text-neutral-300">
                  <Check className="w-3.5 h-3.5 text-white" />
                  Cryptographic Derangement Verified (Non-Self Assignment)
                </span>
                <span className="text-neutral-500">Author: Anonymous</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2. Track Assignment Card */}
        <div className="border border-white/15 bg-neutral-950 p-6 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-neutral-500 uppercase tracking-widest border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Compass className="w-3.5 h-3.5 text-white" />
              <span>Assigned Track</span>
            </div>
            {data?.track && (
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 border border-white/20 bg-white/10 text-white font-semibold">
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
                <span className="w-1.5 h-1.5 bg-white inline-block animate-pulse" />
                <span className="text-xs font-mono uppercase tracking-widest text-neutral-400">
                  Track assignment will appear once coordinator initiates phase
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 3. Problem Statement Drafting Box */}
        <div className="border border-white/15 bg-neutral-950 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 uppercase tracking-widest">
              <FileText className="w-3.5 h-3.5 text-white" />
              <span>{isStatementsAssigned ? 'Your Submitted Statement' : 'Problem Statement Drafting'}</span>
            </div>

            {hasSubmitted && (
              <span className="flex items-center gap-1.5 text-xs font-mono text-white bg-white/10 border border-white/30 px-2.5 py-0.5">
                <Check className="w-3 h-3 text-white" />
                <span>SUBMITTED ✓</span>
              </span>
            )}
          </div>

          <p className="text-xs text-neutral-400 font-sans leading-relaxed">
            {isStatementsAssigned
              ? 'This is the challenge your team authored. It has been anonymously distributed to another team in the event pool.'
              : 'Formulate a rigorous technical problem statement (10 to 500 characters). Following the admin shuffle, another team will be tasked with architecting a solution for your challenge.'}
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
                    ? 'State the problem concisely: core objective, constraints, and success criteria...'
                    : data?.phase === 'setup' || data?.phase === 'tracks_assigned'
                    ? 'Submissions are currently locked. The drafting phase has not been initiated.'
                    : 'Submissions are permanently locked for derangement shuffle.'
                }
                className="w-full bg-black text-white text-xs md:text-sm font-sans p-4 border border-white/20 focus:border-white focus:outline-none transition-colors resize-none disabled:opacity-50 disabled:bg-neutral-950 placeholder:text-neutral-700"
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

              {isSubmissionsOpen && (
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
              )}
            </div>
          </form>
        </div>

        {/* Status prompt when statements are not assigned yet */}
        {!isStatementsAssigned && (
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
