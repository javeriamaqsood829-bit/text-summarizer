import React from 'react';
import {
  Scissors,
  Maximize2,
  AlignLeft,
  Sparkles,
  ListOrdered,
  Key,
  Briefcase,
  RotateCw,
  Copy,
  Download,
} from 'lucide-react';

interface FollowUpActionsProps {
  onFollowUp: (
    operation: 'shorter' | 'detailed' | 'simpler' | 'key_points' | 'terms' | 'executive',
    label: string
  ) => void;
  onConvertToParagraph: () => void;
  onRegenerate: () => void;
  onCopy: () => void;
  onDownload: () => void;
  isProcessing: boolean;
  disabled?: boolean;
}

export const FollowUpActions: React.FC<FollowUpActionsProps> = ({
  onFollowUp,
  onConvertToParagraph,
  onRegenerate,
  onCopy,
  onDownload,
  isProcessing,
  disabled = false,
}) => {
  const actions: {
    label: string;
    icon: React.ReactNode;
    handler: () => void;
  }[] = [
    {
      label: 'Make Shorter',
      icon: <Scissors className="w-3.5 h-3.5" />,
      handler: () => onFollowUp('shorter', 'Make it shorter'),
    },
    {
      label: 'Make More Detailed',
      icon: <Maximize2 className="w-3.5 h-3.5" />,
      handler: () => onFollowUp('detailed', 'Make it more detailed'),
    },
    {
      label: 'Convert to Paragraph',
      icon: <AlignLeft className="w-3.5 h-3.5" />,
      handler: onConvertToParagraph,
    },
    {
      label: 'Make Simpler',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      handler: () => onFollowUp('simpler', 'Explain in simpler terms'),
    },
    {
      label: 'Extract Key Points',
      icon: <ListOrdered className="w-3.5 h-3.5" />,
      handler: () => onFollowUp('key_points', 'Extract key points'),
    },
    {
      label: 'Extract Important Terms',
      icon: <Key className="w-3.5 h-3.5" />,
      handler: () => onFollowUp('terms', 'Extract key technical terms and definitions'),
    },
    {
      label: 'Generate Executive Summary',
      icon: <Briefcase className="w-3.5 h-3.5" />,
      handler: () => onFollowUp('executive', 'Generate an executive summary'),
    },
    {
      label: 'Regenerate',
      icon: <RotateCw className="w-3.5 h-3.5" />,
      handler: onRegenerate,
    },
    {
      label: 'Copy',
      icon: <Copy className="w-3.5 h-3.5" />,
      handler: onCopy,
    },
    {
      label: 'Download',
      icon: <Download className="w-3.5 h-3.5" />,
      handler: onDownload,
    },
  ];

  return (
    <div id="follow-up-actions-container" className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Follow-up Transformations
        </span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          (Refine current summary without re-uploading text)
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.handler}
            disabled={disabled || isProcessing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-400 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
