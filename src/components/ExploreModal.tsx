import React from 'react';
import { X, Sparkles, Compass, Cpu, Layers, FileCheck, ArrowRight } from 'lucide-react';
import { SAMPLE_LONG_DOCUMENT } from '../data/sampleDocument';

interface ExploreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad500Lines: () => void;
}

export const ExploreModal: React.FC<ExploreModalProps> = ({
  isOpen,
  onClose,
  onLoad500Lines,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-xl bg-white dark:bg-[#121620] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Compass className="w-5 h-5 text-blue-500" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Explore Javeria AI Capabilities
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Benchmark and test long-document AI summarization
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Explore Cards */}
        <div className="p-5 space-y-3 overflow-y-auto">
          {/* Card 1: 500+ Lines Benchmark */}
          <div
            onClick={() => {
              onLoad500Lines();
              onClose();
            }}
            className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 hover:border-blue-500 cursor-pointer transition-all hover:scale-[1.01] group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Featured 500+ Lines Dataset
              </span>
              <ArrowRight className="w-4 h-4 text-blue-500 group-hover:translate-x-1 transition-transform" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
              Load 600+ Line Scientific Research Report
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Test how the local Map-Reduce engine chunks, analyzes, and synthesizes large documents in real time.
            </p>
          </div>

          {/* Card 2: Privacy Guarantee */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-500" />
              Local Device Architecture
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              No API keys required. All text processing and algorithms are computed directly in your browser without transmitting private data to remote servers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
