import React, { useState, useEffect } from 'react';
import { subscribeBackendStatus } from '../lib/supabase';
import { Database, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

export const Banner: React.FC = () => {
  const [isMock, setIsMock] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    return subscribeBackendStatus((mock) => {
      setIsMock(mock);
    });
  }, []);

  if (!isMock) return null;

  const copySqlInstructions = () => {
    const text = `-- Nexus 0 Database Migration:
-- Please run the contents of 'supabase/migrations/20261118000000_nexus0_schema.sql' 
-- in your Supabase SQL Editor to enable full server-side Postgres RLS and RPCs.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-surface border-b border-border text-xs text-text-muted px-4 py-2 transition-all">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-accent flex-shrink-0" />
          <span>
            <strong className="text-text font-medium">Local Fallback Active:</strong> Remote Supabase tables not initialized yet.
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hover:text-text transition-colors flex items-center gap-1 underline underline-offset-2"
          >
            Instructions {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={copySqlInstructions}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-subtle hover:bg-surface-hover text-text border border-border transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy SQL Info'}</span>
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="max-w-4xl mx-auto mt-2 pt-2 border-t border-border/50 text-[11px] text-text-muted space-y-1">
          <p>
            To activate Supabase Postgres backend: Open your Supabase Dashboard &gt; <strong>SQL Editor</strong> &gt; paste and run <code className="text-accent font-mono">supabase/migrations/20261118000000_nexus0_schema.sql</code>.
          </p>
          <p>
            In the meantime, the app is fully functional and interactive in preview mode!
          </p>
        </div>
      )}
    </div>
  );
};
