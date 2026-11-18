import React from 'react';
import { Phase } from '../types';

interface PhaseBadgeProps {
  phase: Phase;
  size?: 'sm' | 'md' | 'lg';
}

const PHASE_LABELS: Record<Phase, { label: string; desc: string }> = {
  setup: { label: 'SETUP', desc: 'Teams and tracks registration in progress' },
  tracks_assigned: { label: 'TRACKS ASSIGNED', desc: 'Teams assigned to designated tracks' },
  submissions_open: { label: 'SUBMISSIONS OPEN', desc: 'Problem statements unlocked for drafting' },
  submissions_closed: { label: 'SUBMISSIONS LOCKED', desc: 'Statements locked for derangement shuffle' },
  statements_assigned: { label: 'STATEMENTS ASSIGNED', desc: 'Challenges distributed live to teams' },
};

export const PhaseBadge: React.FC<PhaseBadgeProps> = ({ phase, size = 'md' }) => {
  const info = PHASE_LABELS[phase] || { label: phase, desc: '' };

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 tracking-wider',
    md: 'text-xs px-2.5 py-1 tracking-widest',
    lg: 'text-sm px-3.5 py-1.5 tracking-widest',
  };

  return (
    <span
      className={`inline-flex items-center gap-2 font-mono font-medium border border-white/20 bg-white/5 text-white uppercase ${sizeClasses[size]}`}
      title={info.desc}
    >
      <span className="w-1.5 h-1.5 bg-white" />
      <span>{info.label}</span>
    </span>
  );
};
