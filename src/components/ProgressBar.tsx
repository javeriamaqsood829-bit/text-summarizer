import React from 'react';
import { Loader2, XCircle, CheckCircle2 } from 'lucide-react';
import { SummarizationProgress, PipelineStage } from '../types';

interface ProgressBarProps {
  progress: SummarizationProgress;
  onCancel: () => void;
}

const STAGES: { key: PipelineStage; label: string }[] = [
  { key: 'analyzing', label: 'Analyzing text' },
  { key: 'summarizing_chunks', label: 'Summarizing chunks' },
  { key: 'combining_summaries', label: 'Combining summaries' },
  { key: 'generating_final', label: 'Generating final result' },
];

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, onCancel }) => {
  const getStageIndex = (stage: PipelineStage): number => {
    switch (stage) {
      case 'analyzing':
      case 'chunking':
        return 0;
      case 'summarizing_chunks':
        return 1;
      case 'combining_summaries':
        return 2;
      case 'generating_final':
      case 'rewriting_paragraph':
      case 'completed':
        return 3;
      default:
        return 0;
    }
  };

  const currentStageIdx = getStageIndex(progress.stage);

  return (
    <div
      id="progress-card"
      className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in duration-200"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/70 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Processing document with Local AI...
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {progress.statusMessage || 'Analyzing text on device...'}
            </p>
          </div>
        </div>

        {/* Chunk details and percentage */}
        <div className="text-right">
          <span className="text-base font-bold text-blue-600 dark:text-blue-400 font-mono">
            {progress.percentage}%
          </span>
          {progress.totalChunks > 1 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Chunk {progress.currentChunkIndex} of {progress.totalChunks}
            </p>
          )}
        </div>
      </div>

      {/* Main Bar */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
        <div
          className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.max(4, Math.min(100, progress.percentage))}%` }}
        />
      </div>

      {/* Stages Indicator */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        {STAGES.map((s, idx) => {
          const isDone = idx < currentStageIdx;
          const isCurrent = idx === currentStageIdx;

          return (
            <div
              key={s.key}
              className={`flex items-center gap-1.5 text-xs ${
                isDone
                  ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                  : isCurrent
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-400 dark:text-slate-600'
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : isCurrent ? (
                <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
              ) : (
                <div className="w-3 h-3 rounded-full border border-slate-300 dark:border-slate-700 shrink-0" />
              )}
              <span className="truncate">{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* Cancel Button */}
      <div className="flex justify-end pt-1">
        <button
          id="btn-cancel-processing"
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-colors"
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>Cancel Processing</span>
        </button>
      </div>
    </div>
  );
};
