import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { adminPasswordSchema } from '../schemas';
import { apiAdminLogin } from '../lib/supabase';

interface AdminLoginPageProps {
  onLoginSuccess: (token: string) => void;
  onNavigateHome: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onLoginSuccess, onNavigateHome }) => {
  const [password, setPassword] = useState('');
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

    const validation = adminPasswordSchema.safeParse(password);
    if (!validation.success) {
      setError('Invalid admin credentials.');
      setFailedAttempts((prev) => prev + 1);
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiAdminLogin(password);
      if (res && res.token) {
        onLoginSuccess(res.token);
      } else {
        throw new Error('Authentication failed');
      }
    } catch (err: any) {
      setFailedAttempts((prev) => prev + 1);
      const msg = err.message || '';
      if (msg.toLowerCase().includes('rate limit')) {
        setError(msg);
      } else {
        setError('Invalid admin credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between p-6 sm:p-10 selection:bg-white selection:text-black">
      {/* Top Header */}
      <header className="flex items-center justify-between max-w-4xl mx-auto w-full">
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Landing</span>
        </button>
        <span className="font-mono text-xs text-neutral-600 uppercase tracking-widest">
          Admin Portal
        </span>
      </header>

      {/* Main Container */}
      <main className="max-w-md mx-auto w-full my-auto space-y-8 text-center">
        <div className="space-y-3">
          <div className="w-12 h-12 border border-white/20 bg-neutral-950 flex items-center justify-center mx-auto text-white">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-light uppercase tracking-tight text-white">
            Admin Access
          </h1>
          <p className="text-xs text-neutral-500 font-sans leading-relaxed">
            Enter administrator password
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative group">
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter password"
              disabled={isLoading || failedAttempts >= 5}
              autoFocus
              className="w-full h-14 pl-5 pr-14 bg-black text-white font-mono text-sm tracking-widest border border-white/20 focus:border-white focus:outline-none transition-colors placeholder:text-neutral-700 disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={isLoading || !password || failedAttempts >= 5}
              aria-label="Submit admin password"
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
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs font-mono text-neutral-700 uppercase tracking-widest">
        Nexus 0
      </footer>
    </div>
  );
};
