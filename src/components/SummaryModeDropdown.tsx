import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Sparkles } from 'lucide-react';
import { SummaryMode } from '../types';

export interface SummaryModeOption {
  id: SummaryMode;
  label: string;
  description: string;
}

export const SUMMARY_MODE_OPTIONS: SummaryModeOption[] = [
  { id: 'quick', label: 'Quick Summary', description: 'Fast, concise overview of top points' },
  { id: 'balanced', label: 'Balanced Summary', description: 'Standard balanced synthesis of key themes' },
  { id: 'detailed', label: 'Detailed Summary', description: 'In-depth, comprehensive analysis' },
  { id: 'key_points', label: 'Key Points', description: 'High-impact structured bullet points' },
  {
    id: 'lengthy_paragraph',
    label: 'Lengthy Paragraph & Data',
    description: 'High-accuracy deep extraction of thesis, critical points & statistics from long texts',
  },
  { id: 'academic', label: 'Academic Summary', description: 'Scholarly structure with methodology & context' },
  { id: 'simple_english', label: 'Simple English', description: 'Accessible wording without complex jargon' },
  { id: 'executive', label: 'Executive Summary', description: 'High-level strategic briefing with action points' },
];

interface SummaryModeDropdownProps {
  currentMode: SummaryMode;
  onSelectMode: (mode: SummaryMode) => void;
  showLabel?: boolean;
  className?: string;
  buttonClassName?: string;
}

export const SummaryModeDropdown: React.FC<SummaryModeDropdownProps> = ({
  currentMode,
  onSelectMode,
  showLabel = true,
  className = '',
  buttonClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption =
    SUMMARY_MODE_OPTIONS.find((opt) => opt.id === currentMode) || SUMMARY_MODE_OPTIONS[1];

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {showLabel && (
        <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
          Summary Mode
        </label>
      )}

      {/* Dropdown Trigger Box (styled to match user screenshot) */}
      <button
        type="button"
        id="summary-mode-trigger-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0e1626] border-2 ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
            : 'border-blue-500/90 hover:border-blue-500 dark:border-blue-500/80 shadow-xs'
        } text-slate-900 dark:text-white transition-all cursor-pointer text-left ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="text-xs sm:text-sm font-semibold tracking-tight truncate">
          {selectedOption.label}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Opened Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          id="summary-mode-options-list"
          className="absolute left-0 mt-1.5 w-full min-w-[220px] rounded-xl bg-white dark:bg-[#0e1626] border border-slate-200 dark:border-slate-800 shadow-2xl py-1 z-50 animate-in fade-in duration-150 overflow-hidden"
        >
          {SUMMARY_MODE_OPTIONS.map((opt) => {
            const isSelected = opt.id === currentMode;
            return (
              <button
                key={opt.id}
                role="option"
                aria-selected={isSelected}
                type="button"
                onClick={() => {
                  onSelectMode(opt.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs sm:text-sm text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                }`}
              >
                <div className="flex flex-col">
                  <span className={isSelected ? 'font-semibold text-white' : 'font-medium'}>
                    {opt.label}
                  </span>
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 shrink-0 text-white" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
