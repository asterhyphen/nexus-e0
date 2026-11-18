import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Lock, AlertCircle, ShieldAlert } from 'lucide-react';
import { teamCodeSchema } from '../schemas';
import { apiTeamLogin } from '../lib/supabase';
import { TeamSession } from '../types';

interface LandingPageProps {
  onLoginSuccess: (session: TeamSession) => void;
  onNavigateToAdmin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess, onNavigateToAdmin }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side rate check
    if (failedAttempts >= 5) {
      setError('Too many failed attempts. Locked out for 15 minutes.');
      return;
    }

    const trimmed = code.trim().toUpperCase();
    const validation = teamCodeSchema.safeParse(trimmed);
    if (!validation.success) {
      setError('Invalid code');
      setFailedAttempts((prev) => prev + 1);
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiTeamLogin(trimmed);
      if (res && res.token) {
        onLoginSuccess({
          token: res.token,
          team_id: res.team_id,
          team_name: res.team_name,
          team_code: res.team_code,
        });
      } else {
        throw new Error('Invalid code');
      }
    } catch (err: any) {
      setFailedAttempts((prev) => prev + 1);
      // PRD: Generic error on failure ("Invalid code"), never reveal whether a code exists
      if (err.message && err.message.toLowerCase().includes('rate limit')) {
        setError(err.message);
      } else {
        setError('Invalid code');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.toUpperCase());
    if (error) setError(null);
  };

  return (
    <div className="relative min-h-[92vh] flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-accent/5 rounded-full blur-[140px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md mx-auto text-center space-y-10 z-10"
      >
        {/* Event name as large, light-weight typography */}
        <div className="space-y-2 select-none">
          <h1 className="text-6xl md:text-7xl font-light tracking-tight text-text">
            Nexus <span className="font-extralight text-text-muted">0</span>
          </h1>
          <p className="text-xs uppercase tracking-[0.25em] text-text-dim font-mono">
            Event Flow Platform
          </p>
        </div>

        {/* Centered single input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative group">
            <input
              type="text"
              value={code}
              onChange={handleChange}
              placeholder="Enter your team code"
              maxLength={16}
              disabled={isLoading || failedAttempts >= 5}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              className="w-full h-14 pl-5 pr-14 bg-surface text-text font-mono text-center text-sm md:text-base tracking-widest uppercase rounded-2xl border border-border focus:border-accent focus:ring-1 focus:ring-accent/40 placeholder:text-text-dim placeholder:font-sans placeholder:normal-case placeholder:tracking-normal transition-all outline-none shadow-subtle disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !code.trim() || failedAttempts >= 5}
              aria-label="Submit team code"
              className="absolute right-2 top-2 h-10 w-10 flex items-center justify-center rounded-xl bg-surface-subtle hover:bg-accent text-text-muted hover:text-white border border-border hover:border-accent/80 transition-all disabled:opacity-30 disabled:hover:bg-surface-subtle disabled:hover:text-text-muted"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              )}
            </button>
          </div>

          {/* Feedback messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center justify-center gap-1.5 text-xs text-rose-400 font-mono tracking-tight"
              >
                {failedAttempts >= 5 ? <ShieldAlert className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        {/* Subtle sample code hints for testing */}
        <div className="text-[11px] text-text-dim font-mono pt-4 select-none">
          Sample codes: <span className="text-text-muted hover:text-accent cursor-pointer transition-colors" onClick={() => setCode('NEX-1001')}>NEX-1001</span>,{' '}
          <span className="text-text-muted hover:text-accent cursor-pointer transition-colors" onClick={() => setCode('NEX-1002')}>NEX-1002</span>
        </div>
      </motion.div>

      {/* Discreet admin portal link */}
      <footer className="absolute bottom-6 left-0 right-0 flex items-center justify-center z-10">
        <button
          onClick={onNavigateToAdmin}
          className="flex items-center gap-1.5 text-[11px] text-text-dim hover:text-text-muted transition-colors py-1 px-2 rounded-lg hover:bg-surface-subtle"
        >
          <Lock className="w-3 h-3 opacity-60" />
          <span>Admin Portal</span>
        </button>
      </footer>
    </div>
  );
};
