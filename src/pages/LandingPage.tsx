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
      const msg = err.message || '';
      if (msg.toLowerCase().includes('rate limit')) {
        setError(msg);
      } else {
        // PRD: Generic error on failure ("Invalid code"), never reveal whether a code exists
        setError('Invalid code');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between p-6 sm:p-10 selection:bg-white selection:text-black">
      {/* Top Header */}
      <header className="flex items-center justify-between max-w-5xl mx-auto w-full">
        <div className="font-mono text-xs uppercase tracking-widest text-neutral-500">
          Nexus 0
        </div>
      </header>

      {/* Main Centered Content */}
      <main className="max-w-md mx-auto w-full my-auto space-y-8 text-center">
        <div className="space-y-2 select-none">
          <h1 className="text-6xl sm:text-7xl md:text-8xl font-display font-light tracking-tight uppercase text-white">
            Nexus 0
          </h1>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-500">
            Event Flow Platform
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative group">
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (error) setError(null);
              }}
              placeholder="Enter your team code"
              maxLength={16}
              disabled={isLoading || failedAttempts >= 5}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              className="w-full h-14 pl-5 pr-14 bg-black text-white font-mono text-center text-sm md:text-base tracking-widest uppercase border border-white/20 focus:border-white focus:outline-none transition-colors placeholder:text-neutral-700 placeholder:font-sans placeholder:normal-case placeholder:tracking-normal disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={isLoading || !code.trim() || failedAttempts >= 5}
              aria-label="Submit team code"
              className="absolute right-2 top-2 h-10 w-10 flex items-center justify-center bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-20 disabled:hover:bg-white"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </button>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center justify-center gap-1.5 text-xs text-neutral-300 font-mono"
              >
                {failedAttempts >= 5 ? <ShieldAlert className="w-3.5 h-3.5 text-white" /> : <AlertCircle className="w-3.5 h-3.5 text-white" />}
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center max-w-5xl mx-auto w-full text-xs font-mono text-neutral-600">
        <button
          onClick={onNavigateToAdmin}
          className="flex items-center gap-1.5 text-neutral-500 hover:text-white transition-colors"
        >
          <Lock className="w-3 h-3" />
          <span>Admin</span>
        </button>
      </footer>
    </div>
  );
};
