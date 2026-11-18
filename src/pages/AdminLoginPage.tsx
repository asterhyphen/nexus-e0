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
      if (err.message && err.message.toLowerCase().includes('rate limit')) {
        setError(err.message);
      } else {
        setError('Invalid admin credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-[92vh] flex flex-col items-center justify-center px-4">
      {/* Back button */}
      <div className="absolute top-6 left-6">
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors px-3 py-1.5 rounded-xl bg-surface border border-border"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Landing</span>
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm mx-auto text-center space-y-8"
      >
        <div className="space-y-2 select-none">
          <div className="w-12 h-12 rounded-2xl bg-surface-subtle border border-border flex items-center justify-center mx-auto text-accent mb-3">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="text-3xl font-light tracking-tight text-text">Admin Access</h1>
          <p className="text-xs text-text-muted">Enter master password to access event controls</p>
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
              placeholder="Enter admin password"
              disabled={isLoading || failedAttempts >= 5}
              autoFocus
              className="w-full h-13 pl-4 pr-12 bg-surface text-text text-sm rounded-xl border border-border focus:border-accent focus:ring-1 focus:ring-accent/40 placeholder:text-text-dim transition-all outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !password || failedAttempts >= 5}
              aria-label="Submit admin password"
              className="absolute right-2 top-2 h-9 w-9 flex items-center justify-center rounded-lg bg-surface-subtle hover:bg-accent text-text-muted hover:text-white border border-border hover:border-accent transition-all disabled:opacity-30 disabled:hover:bg-surface-subtle disabled:hover:text-text-muted"
            >
              {isLoading ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                className="flex items-center justify-center gap-1.5 text-xs text-rose-400 font-mono"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        <div className="text-[11px] text-text-dim font-mono">
          Default seed password: <span className="text-text-muted font-mono select-all">adminnexus2026</span>
        </div>
      </motion.div>
    </div>
  );
};
