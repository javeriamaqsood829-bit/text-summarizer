import React, { useState } from 'react';
import {
  Copy,
  Download,
  Printer,
  RotateCw,
  Check,
  FileText,
  AlignLeft,
  FileCode,
  Layers,
  Sparkles,
  Bookmark,
} from 'lucide-react';
import { Conversation, QualityMetrics } from '../types';
import { ExportService } from '../services/ExportService';
import { calculateTextStatistics, calculateCompressionRatio } from '../utils/textStatistics';

interface ResultTabsProps {
  conversation: Conversation;
  onRegenerate: () => void;
  onConvertToParagraph: () => void;
  isProcessing: boolean;
}

export type ResultTabType = 'summary' | 'paragraph' | 'original';

export const ResultTabs: React.FC<ResultTabsProps> = ({
  conversation,
  onRegenerate,
  onConvertToParagraph,
  isProcessing,
}) => {
  const [activeTab, setActiveTab] = useState<ResultTabType>('summary');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const origStats = calculateTextStatistics(conversation.originalText);
  const sumStats = calculateTextStatistics(conversation.currentSummary);
  const paraStats = calculateTextStatistics(conversation.currentParagraph);
  const comp = calculateCompressionRatio(origStats.words, sumStats.words);

  const getCurrentText = () => {
    switch (activeTab) {
      case 'paragraph':
        return conversation.currentParagraph || conversation.currentSummary;
      case 'original':
        return conversation.originalText;
      case 'summary':
      default:
        return conversation.currentSummary;
    }
  };

  const handleCopy = async () => {
    const text = getCurrentText();
    if (!text) return;
    const ok = await ExportService.copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadTxt = () => {
    const text = getCurrentText();
    ExportService.downloadTxt(conversation.title, text, activeTab);
  };

  const handleDownloadMarkdown = () => {
    ExportService.downloadMarkdown(
      conversation.title,
      conversation.currentSummary,
      conversation.currentParagraph,
      {
        sourceWords: origStats.words,
        summaryWords: sumStats.words,
        compressionRatio: comp.ratio,
        mode: conversation.settings.mode,
      }
    );
  };

  const handlePrint = () => {
    ExportService.printSummary(
      conversation.title,
      conversation.currentSummary,
      conversation.currentParagraph
    );
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div
      id="result-tabs-container"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-all space-y-0"
    >
      {/* Header bar: Tabs & Action Buttons */}
      <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* The 3 Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <button
            id="tab-btn-summary"
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'summary'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Summary</span>
            {sumStats.words > 0 && (
              <span className="text-[10px] opacity-70 font-mono">({sumStats.words}w)</span>
            )}
          </button>

          <button
            id="tab-btn-paragraph"
            type="button"
            onClick={() => setActiveTab('paragraph')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'paragraph'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span>Paragraph</span>
            {paraStats.words > 0 && (
              <span className="text-[10px] opacity-70 font-mono">({paraStats.words}w)</span>
            )}
          </button>

          <button
            id="tab-btn-original"
            type="button"
            onClick={() => setActiveTab('original')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'original'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Original</span>
            {origStats.words > 0 && (
              <span className="text-[10px] opacity-70 font-mono">({origStats.words}w)</span>
            )}
          </button>
        </div>

        {/* Action Buttons: Copy, Download TXT/MD, Print, Regenerate */}
        <div className="flex items-center gap-1.5">
          <button
            id="btn-copy-result"
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            title="Copy to clipboard (Ctrl+Shift+C)"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          <button
            id="btn-download-txt"
            type="button"
            onClick={handleDownloadTxt}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            title="Download as .TXT"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">TXT</span>
          </button>

          <button
            id="btn-download-md"
            type="button"
            onClick={handleDownloadMarkdown}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            title="Download as Markdown (.md)"
          >
            <FileCode className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">MD</span>
          </button>

          <button
            id="btn-print-summary"
            type="button"
            onClick={handlePrint}
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            title="Print summary"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
          </button>

          <button
            id="btn-save-summary"
            type="button"
            onClick={handleSave}
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            title="Save to local history"
          >
            {saved ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Bookmark className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>

          <button
            id="btn-regenerate-summary"
            type="button"
            onClick={onRegenerate}
            disabled={isProcessing}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/60 transition-colors ml-1"
            title="Regenerate summary with current settings"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Regenerate</span>
          </button>
        </div>
      </div>

      {/* Source vs Summary Length Metric Banner */}
      <div className="px-4 py-2 bg-blue-50/50 dark:bg-blue-950/20 border-b border-slate-200/60 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <Layers className="w-3.5 h-3.5 text-blue-500" />
          <span>
            <strong>Source:</strong> {origStats.words} words ({origStats.lines} lines)
          </span>
          <span className="text-slate-400">→</span>
          <span>
            <strong>Summary:</strong> {sumStats.words} words
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono font-semibold text-[11px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            {comp.percentReduction}% reduction
          </span>
          {conversation.metrics && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
              ROUGE-1: {conversation.metrics.rouge1} • Faithfulness: {Math.round(conversation.metrics.faithfulness * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* Tab Content Display */}
      <div className="p-5 sm:p-6 min-h-[260px] text-slate-900 dark:text-slate-100 leading-relaxed text-sm sm:text-base font-normal">
        {activeTab === 'summary' && (
          <div className="space-y-4">
            {conversation.currentSummary ? (
              <div className="whitespace-pre-wrap selection:bg-blue-100 dark:selection:bg-blue-900/50">
                {conversation.currentSummary}
              </div>
            ) : (
              <div className="text-slate-400 dark:text-slate-500 italic">
                No summary generated yet.
              </div>
            )}
          </div>
        )}

        {activeTab === 'paragraph' && (
          <div className="space-y-4">
            {conversation.currentParagraph ? (
              <div className="whitespace-pre-wrap selection:bg-blue-100 dark:selection:bg-blue-900/50">
                {conversation.currentParagraph}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <AlignLeft className="w-8 h-8 text-slate-400 mb-2 stroke-[1.5]" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Paragraph version not generated yet.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-sm">
                  Convert the bullet points and notes of this summary into natural, cohesive prose.
                </p>
                <button
                  type="button"
                  onClick={onConvertToParagraph}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                  <span>Convert to Paragraph Now</span>
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'original' && (
          <div className="space-y-2">
            <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mb-2">
              Original Document ({origStats.lines} lines, {origStats.characters} characters)
            </div>
            <div className="whitespace-pre-wrap font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 max-h-[450px] overflow-y-auto scrollbar-thin">
              {conversation.originalText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
