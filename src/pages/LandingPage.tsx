import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Lock, AlertCircle, ShieldAlert, Check } from 'lucide-react';
import { teamCodeSchema } from '../schemas';
import { apiTeamLogin } from '../lib/supabase';
import { TeamSession } from '../types';

interface LandingPageProps {
  onLoginSuccess: (session: TeamSession) => void;
  onNavigateToAdmin: () => void;
}

const SAMPLE_TEAMS = [
  { code: 'NEX-1001', name: 'Quantum Leap', track: 'AI & Autonomous Agents' },
  { code: 'NEX-1002', name: 'CyberPulse', track: 'Decentralized Systems' },
  { code: 'NEX-1003', name: 'AeroDynamics', track: 'Cybersecurity Shield' },
  { code: 'NEX-1004', name: 'Synapse Labs', track: 'Fintech Markets' },
];

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
      if (msg.includes('Invalid code') || msg.includes('team code format')) {
        setError('Invalid team code');
      } else if (msg.toLowerCase().includes('rate limit')) {
        setError(msg);
      } else {
        setError(msg || 'Invalid code');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSample = (sampleCode: string) => {
    setCode(sampleCode);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between px-6 py-10 selection:bg-white selection:text-black">
      {/* Top Telemetry Bar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 bg-white inline-block" />
          <span className="font-mono text-xs uppercase tracking-widest text-neutral-400">
            Nexus E-0 // System Online
          </span>
        </div>
        <div className="flex items-center gap-6 font-mono text-xs text-neutral-400">
          <span>30 Teams</span>
          <span className="text-neutral-700">/</span>
          <span>6 Tracks</span>
          <span className="text-neutral-700">/</span>
          <span>Derangement Engine Active</span>
        </div>
      </header>

      {/* Main Hero Container */}
      <main className="max-w-4xl mx-auto w-full my-auto py-12 space-y-12">
        {/* Tall Display Title */}
        <div className="space-y-4 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-500">
            Realtime Collegiate Event Flow
          </p>
          <h1 className="text-7xl sm:text-8xl md:text-9xl font-display font-medium tracking-tight uppercase leading-none text-white select-none">
            Nexus E-0
          </h1>
          <p className="text-xs md:text-sm text-neutral-400 font-sans max-w-lg mx-auto leading-relaxed">
            Enter your team code to access your track assignment, submit your problem statement, and receive your assigned challenge.
          </p>
        </div>

        {/* Input Terminal */}
        <div className="max-w-md mx-auto w-full space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative group">
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  if (error) setError(null);
                }}
                placeholder="ENTER TEAM CODE"
                maxLength={16}
                disabled={isLoading || failedAttempts >= 5}
                autoFocus
                spellCheck={false}
                autoComplete="off"
                className="w-full h-14 pl-5 pr-14 bg-black text-white font-mono text-center text-base tracking-widest uppercase border border-white/20 focus:border-white focus:outline-none transition-colors placeholder:text-neutral-700 disabled:opacity-40"
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

          {/* Sample Content Roster */}
          <div className="pt-6 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 uppercase tracking-wider">
              <span>Sample Team Roster</span>
              <span>Click to load</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SAMPLE_TEAMS.map((st) => (
                <button
                  key={st.code}
                  type="button"
                  onClick={() => handleSelectSample(st.code)}
                  className={`text-left p-2.5 border transition-all ${
                    code === st.code
                      ? 'border-white bg-white/10 text-white'
                      : 'border-white/10 bg-neutral-950 text-neutral-400 hover:border-white/30 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-xs font-semibold text-white">
                    <span>{st.code}</span>
                    {code === st.code && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="text-[11px] truncate text-neutral-300 font-sans mt-0.5">{st.name}</div>
                  <div className="text-[10px] text-neutral-500 truncate font-mono">{st.track}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 5-Step Protocol Architecture Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-px bg-white/10 border border-white/10 p-px">
          {[
            { num: '01', title: 'Setup', desc: 'Roster & tracks initialized' },
            { num: '02', title: 'Track Reveal', desc: 'Even track distribution' },
            { num: '03', title: 'Drafting', desc: 'Team problem formulation' },
            { num: '04', title: 'Lockdown', desc: 'Freeze pool for derangement' },
            { num: '05', title: 'Live Swap', desc: 'Zero-knowledge assignment' },
          ].map((step) => (
            <div key={step.num} className="bg-black p-4 space-y-1">
              <span className="font-mono text-[10px] text-neutral-500">{step.num}</span>
              <h4 className="font-display uppercase text-sm text-white tracking-wide">{step.title}</h4>
              <p className="text-[11px] text-neutral-400 leading-snug font-sans">{step.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-white/10 pt-6 max-w-6xl mx-auto w-full text-xs font-mono text-neutral-500">
        <div>
          <span>Nexus E-0 // College Tech Symposium</span>
        </div>
        <div>
          <button
            onClick={onNavigateToAdmin}
            className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors uppercase tracking-wider"
          >
            <Lock className="w-3 h-3" />
            <span>Admin Control</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
