import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  confirmVariant?: 'primary' | 'danger';
  isLoading?: boolean;
  children?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  confirmVariant = 'primary',
  isLoading = false,
  children,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/15 p-6 z-10 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-display uppercase tracking-wide text-white">{title}</h3>
                {description && <p className="text-xs text-neutral-400 mt-1 leading-relaxed font-sans">{description}</p>}
              </div>
              <button
                onClick={onClose}
                className="p-1 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {children && <div className="py-2">{children}</div>}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10 font-mono text-xs">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-neutral-400 hover:text-white border border-white/10 hover:border-white/30 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              {onConfirm && (
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={`px-4 py-2 transition-all font-medium flex items-center gap-2 ${
                    confirmVariant === 'danger'
                      ? 'bg-neutral-800 text-white hover:bg-neutral-700 border border-white/20'
                      : 'bg-white text-black hover:bg-neutral-200'
                  }`}
                >
                  {isLoading && <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
                  <span>{confirmText}</span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
