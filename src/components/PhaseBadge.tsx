import React from 'react';
import { Phase } from '../types';

interface PhaseBadgeProps {
  phase: Phase;
  size?: 'sm' | 'md' | 'lg';
}

const PHASE_LABELS: Record<Phase, { label: string; desc: string }> = {
  setup: { label: 'SETUP', desc: 'Adding teams, tracks, and pool statements' },
  tracks_assigned: { label: 'TRACKS ASSIGNED', desc: 'Teams receive their assigned tracks' },
  submissions_open: { label: 'SUBMISSIONS OPEN', desc: 'Teams can submit/edit one problem statement' },
  submissions_closed: { label: 'SUBMISSIONS LOCKED', desc: 'Submissions are frozen for shuffling' },
  statements_assigned: { label: 'STATEMENTS ASSIGNED', desc: 'Teams receive their shuffled problem statement' },
};

export const PhaseBadge: React.FC<PhaseBadgeProps> = ({ phase, size = 'md' }) => {
  const info = PHASE_LABELS[phase] || { label: phase, desc: '' };

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3.5 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-medium rounded-full border border-border bg-surface-subtle text-text ${sizeClasses[size]}`}
      title={info.desc}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
      <span>{info.label}</span>
    </span>
  );
};
