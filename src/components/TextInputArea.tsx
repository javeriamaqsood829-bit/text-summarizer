import React, { useRef, useState } from 'react';
import {
  FileText,
  Upload,
  Clipboard,
  Trash2,
  BookOpen,
  Sparkles,
  Clock,
  Layers,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';
import { TextStatistics } from '../types';
import { formatNumber } from '../utils/formatting';
import { SAMPLE_LONG_DOCUMENT } from '../data/sampleDocument';

interface TextInputAreaProps {
  value: string;
  onChange: (val: string) => void;
  statistics: TextStatistics;
  disabled?: boolean;
  onClear: () => void;
  onLoadSample: () => void;
}

export const TextInputArea: React.FC<TextInputAreaProps> = ({
  value,
  onChange,
  statistics,
  disabled = false,
  onClear,
  onLoadSample,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  const handleFileUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        onChange(content);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handlePasteFromClipboard = async () => {
    if (disabled) return;
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          onChange(text);
          setCopiedNotification(true);
          setTimeout(() => setCopiedNotification(false), 2000);
        }
      }
    } catch {
      // Browser permission prompt or fallback
    }
  };

  return (
    <div
      id="text-input-container"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-all"
    >
      {/* Top Banner: 500+ lines badge & live stats */}
      <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Badge */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100/70 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
            <Layers className="w-3.5 h-3.5" />
            Supports long-form text & 500+ lines
          </span>
          {value.length > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {formatNumber(statistics.lines)} lines detected
            </span>
          )}
        </div>

        {/* Live Text Statistics Bar */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1.5" title="Total Words">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Words: <strong className="font-semibold text-slate-900 dark:text-slate-100">{formatNumber(statistics.words)}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5" title="Total Characters">
            <span>
              Chars: <strong className="font-semibold text-slate-900 dark:text-slate-100">{formatNumber(statistics.characters)}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5" title="Total Paragraphs">
            <span>
              Paras: <strong className="font-semibold text-slate-900 dark:text-slate-100">{formatNumber(statistics.paragraphs)}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5" title="Estimated Reading Time">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Reading: <strong className="font-semibold text-slate-900 dark:text-slate-100">{statistics.estimatedReadingTimeMin} min</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Textarea with drag-and-drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative transition-colors ${
          isDragging
            ? 'bg-blue-50/50 dark:bg-blue-950/20 ring-2 ring-blue-500 ring-inset'
            : ''
        }`}
      >
        <textarea
          id="textarea-input-text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Paste your text here (500+ lines, research papers, reports, notes, assignments, documentation)... or drop a TXT/Markdown file."
          rows={11}
          className="w-full p-4 sm:p-5 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm sm:text-base leading-relaxed resize-y focus:outline-none scrollbar-thin"
        />

        {/* Drag Overlay Hint */}
        {isDragging && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-500/10 dark:bg-blue-500/20 backdrop-blur-xs pointer-events-none">
            <Upload className="w-10 h-10 text-blue-600 dark:text-blue-400 mb-2 animate-bounce" />
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              Drop text or markdown document here
            </p>
          </div>
        )}
      </div>

      {/* Action Toolbar */}
      <div className="px-4 py-2.5 bg-slate-50/60 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Load Sample Button */}
          <button
            id="btn-load-sample"
            type="button"
            onClick={onLoadSample}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 hover:bg-blue-100 dark:hover:bg-blue-900/60 active:scale-[0.98] transition-all"
            title="Load 600+ line scientific research report to test local chunking and Map-Reduce"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Sample Long Document (500+ Lines)</span>
          </button>

          {/* Upload File Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.text,.markdown,.json,.csv"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
            className="hidden"
          />
          <button
            id="btn-upload-file"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            title="Upload local .txt or .md file"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Upload File</span>
          </button>

          {/* Paste Button */}
          <button
            id="btn-paste-clipboard"
            type="button"
            onClick={handlePasteFromClipboard}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            title="Paste text from clipboard"
          >
            <Clipboard className="w-3.5 h-3.5 text-slate-500" />
            <span>{copiedNotification ? 'Pasted!' : 'Paste'}</span>
          </button>
        </div>

        {/* Right side: Clear button */}
        {value.length > 0 && (
          <button
            id="btn-clear-input"
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            title="Clear all text"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>
    </div>
  );
};
