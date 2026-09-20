import React, { useState } from 'react';
import {
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  AlignLeft,
  FileText,
  Percent,
} from 'lucide-react';
import { SummaryMode, SummaryLength, ParagraphOption, SummarySettings } from '../types';

interface ControlsBarProps {
  settings: SummarySettings;
  onUpdateSettings: (newSettings: Partial<SummarySettings>) => void;
  onSummarize: () => void;
  onConvertToParagraph: () => void;
  isProcessing: boolean;
  hasSummary: boolean;
  hasInputText: boolean;
}

const MODES: { value: SummaryMode; label: string; desc: string }[] = [
  { value: 'balanced', label: 'Balanced Summary', desc: 'Optimal balance of brevity and comprehensive coverage' },
  { value: 'quick', label: 'Quick Summary', desc: 'Fast, high-level overview of core conclusions' },
  { value: 'detailed', label: 'Detailed Summary', desc: 'In-depth breakdown preserving numerical data and arguments' },
  { value: 'key_points', label: 'Key Points', desc: 'Structured bullet-point takeaway list' },
  { value: 'academic', label: 'Academic Summary', desc: 'Focus on methodology, research results, and formal hypotheses' },
  { value: 'simple_english', label: 'Simple English', desc: 'Plain language avoiding heavy jargon' },
  { value: 'executive', label: 'Executive Summary', desc: 'Decision-maker strategic highlights and action items' },
];

const PARAGRAPH_OPTIONS: { value: ParagraphOption; label: string }[] = [
  { value: 'natural', label: 'Natural Paragraphs' },
  { value: '1', label: '1 Paragraph' },
  { value: '2', label: '2 Paragraphs' },
  { value: '3', label: '3 Paragraphs' },
];

export const ControlsBar: React.FC<ControlsBarProps> = ({
  settings,
  onUpdateSettings,
  onSummarize,
  onConvertToParagraph,
  isProcessing,
  hasSummary,
  hasInputText,
}) => {
  const [showAdvancedSlider, setShowAdvancedSlider] = useState(false);

  return (
    <div
      id="controls-bar"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Summary Mode Selector */}
        <div>
          <label
            htmlFor="select-summary-mode"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Summary Mode
          </label>
          <div className="relative">
            <select
              id="select-summary-mode"
              value={settings.mode}
              onChange={(e) => onUpdateSettings({ mode: e.target.value as SummaryMode })}
              disabled={isProcessing}
              className="w-full appearance-none text-xs sm:text-sm pl-3 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium cursor-pointer"
            >
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {MODES.find((m) => m.value === settings.mode)?.desc}
          </p>
        </div>

        {/* Summary Length Controls */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Summary Length
            </label>
            <button
              type="button"
              onClick={() => setShowAdvancedSlider((prev) => !prev)}
              className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <Percent className="w-3 h-3" />
              {showAdvancedSlider ? 'Pills' : 'Slider (10%–50%)'}
            </button>
          </div>

          {!showAdvancedSlider ? (
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
              {(['short', 'medium', 'long'] as SummaryLength[]).map((len) => (
                <button
                  key={len}
                  type="button"
                  onClick={() => onUpdateSettings({ length: len })}
                  disabled={isProcessing}
                  className={`py-1.5 text-xs font-medium rounded-lg capitalize transition-all ${
                    settings.length === len
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {len}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-1 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                <span>Target: {settings.lengthPercentage}% of original</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                step="5"
                value={settings.lengthPercentage}
                onChange={(e) =>
                  onUpdateSettings({ lengthPercentage: parseInt(e.target.value, 10) })
                }
                disabled={isProcessing}
                className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg"
              />
            </div>
          )}
        </div>

        {/* Paragraph Output Preference */}
        <div>
          <label
            htmlFor="select-paragraph-format"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Paragraph Output Format
          </label>
          <div className="relative">
            <select
              id="select-paragraph-format"
              value={settings.paragraphCount}
              onChange={(e) =>
                onUpdateSettings({ paragraphCount: e.target.value as ParagraphOption })
              }
              disabled={isProcessing}
              className="w-full appearance-none text-xs sm:text-sm pl-3 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium cursor-pointer"
            >
              {PARAGRAPH_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Structures output into natural flowing paragraphs
          </p>
        </div>
      </div>

      {/* Buttons: Primary CTA & Secondary CTA */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-end gap-3">
        {/* Secondary CTA: Convert to Paragraph (Enabled when summary exists) */}
        <button
          id="btn-convert-paragraph"
          type="button"
          onClick={onConvertToParagraph}
          disabled={!hasSummary || isProcessing}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
            hasSummary && !isProcessing
              ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 shadow-xs'
              : 'bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-60'
          }`}
          title="Convert the generated summary into cohesive paragraphs"
        >
          <AlignLeft className="w-4 h-4 text-blue-500" />
          <span>Convert to Paragraph</span>
        </button>

        {/* Primary CTA: Summarize */}
        <button
          id="btn-summarize-main"
          type="button"
          onClick={onSummarize}
          disabled={!hasInputText || isProcessing}
          className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm ${
            hasInputText && !isProcessing
              ? 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white shadow-blue-500/25'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
          }`}
          title="Analyze and summarize text locally (Ctrl/Cmd + Enter)"
        >
          <Sparkles className="w-4 h-4" />
          <span>{isProcessing ? 'Processing...' : 'Summarize'}</span>
          <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-blue-700/50 dark:bg-blue-900/40 rounded border border-blue-400/30 text-blue-100">
            ⌘↵
          </kbd>
        </button>
      </div>
    </div>
  );
};
