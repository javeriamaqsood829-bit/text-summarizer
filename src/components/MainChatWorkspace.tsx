import React, { useRef, useState, useEffect } from 'react';
import {
  Paperclip,
  Mic,
  MicOff,
  AudioWaveform as Waveform,
  ArrowUp,
  Sparkles,
  AlignLeft,
  FileText,
  Copy,
  Check,
  Download,
  RotateCcw,
  Sliders,
  Layers,
  ChevronRight,
  TrendingDown,
  Clock,
  Send,
  Moon,
  Sun,
  Sunset,
} from 'lucide-react';
import { IridescentOrb } from './IridescentOrb';
import { Conversation, SummarySettings, TextStatistics, SummaryMode } from '../types';
import { formatNumber } from '../utils/formatting';
import { SAMPLE_LONG_DOCUMENT, SAMPLE_LONG_DOCUMENT_TITLE } from '../data/sampleDocument';
import { SummaryModeDropdown } from './SummaryModeDropdown';

interface MainChatWorkspaceProps {
  inputText: string;
  onInputChange: (val: string) => void;
  statistics: TextStatistics;
  settings: SummarySettings;
  onUpdateSettings: (newSettings: Partial<SummarySettings>) => void;
  onSummarize: (customPrompt?: string) => void;
  onConvertToParagraph: (customCount?: '1' | '2' | '3' | 'natural') => void;
  onLoadSample: () => void;
  isProcessing: boolean;
  activeConversation: Conversation | null;
  onFollowUp: (
    operation: 'shorter' | 'detailed' | 'simpler' | 'key_points' | 'terms' | 'executive',
    label: string
  ) => void;
}

export const MainChatWorkspace: React.FC<MainChatWorkspaceProps> = ({
  inputText,
  onInputChange,
  statistics,
  settings,
  onUpdateSettings,
  onSummarize,
  onConvertToParagraph,
  onLoadSample,
  isProcessing,
  activeConversation,
  onFollowUp,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'paragraph' | 'original'>('summary');
  const [isCopied, setIsCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  // Chatbot identity greeting based on time of day - ALWAYS Javeria as requested
  const getGreetingData = () => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
      return {
        title: 'Good Morning, Javeria.',
        period: 'Morning',
        badge: 'Morning Session',
        icon: 'sun',
      };
    }
    if (hour >= 12 && hour < 17) {
      return {
        title: 'Good Afternoon, Javeria.',
        period: 'Afternoon',
        badge: 'Afternoon Session',
        icon: 'sun',
      };
    }
    if (hour >= 17 && hour < 21) {
      return {
        title: 'Good Evening, Javeria.',
        period: 'Evening',
        badge: 'Evening Session',
        icon: 'sunset',
      };
    }
    // Night: 21:00 (9 PM) to 04:59 (4:59 AM)
    return {
      title: 'Good Night, Javeria.',
      period: 'Night',
      badge: 'Night Session',
      icon: 'moon',
    };
  };

  const [greetingData, setGreetingData] = useState(getGreetingData);

  // Keep greeting updated with clock (every 15 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setGreetingData(getGreetingData());
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 72), 260)}px`;
    }
  }, [inputText]);

  const handleFileUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        onInputChange(content);
      }
    };
    reader.readAsText(file);
  };

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSpeechToggle = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    // Simple mock / fallback toggle
    setIsListening((prev) => !prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim() && !isProcessing) {
        onSummarize();
      }
    }
  };

  const hasSummary = Boolean(activeConversation?.currentSummary);
  const showHero = !hasSummary && !isProcessing;

  return (
    <div className="flex-1 flex flex-col justify-between max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10">
      {/* Hidden file input */}
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

      {/* TOP / CENTER SECTION */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
        {showHero ? (
          <div className="flex flex-col items-center text-center space-y-5 my-auto animate-in fade-in duration-300">
            {/* Stylized Professional AI Character Avatar */}
            <IridescentOrb size={128} />

            {/* Greeting Typography matching user request: Javeria with dynamic time of day */}
            <div className="space-y-2.5">
              {/* Dynamic Period Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/70 dark:bg-white/5 border border-slate-300/50 dark:border-white/10 text-[11px] font-medium text-slate-700 dark:text-slate-300 shadow-xs">
                {greetingData.icon === 'moon' ? (
                  <Moon className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400/20" />
                ) : greetingData.icon === 'sunset' ? (
                  <Sunset className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span>{greetingData.badge}</span>
                <span className="opacity-40">•</span>
                <span className="font-mono opacity-80">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {greetingData.title}
              </h1>
              <p className="text-2xl sm:text-3xl font-normal text-slate-700 dark:text-slate-200">
                Can I help you with anything ?
              </p>
            </div>
          </div>
        ) : (
          /* When Summary or Processing is active: Display Result Stream */
          <div className="w-full space-y-5 animate-in fade-in duration-200">
            {/* User message pill */}
            {activeConversation?.originalText && (
              <div className="flex justify-end">
                <div className="max-w-2xl bg-slate-200/80 dark:bg-white/10 rounded-2xl px-4 py-3 text-xs sm:text-sm text-slate-900 dark:text-white border border-slate-300/40 dark:border-white/5">
                  <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                    <span>Original Document ({formatNumber(activeConversation.originalText.split('\n').length)} lines)</span>
                  </div>
                  <p className="line-clamp-3 italic opacity-90">
                    "{activeConversation.originalText.slice(0, 240)}..."
                  </p>
                </div>
              </div>
            )}

            {/* AI Assistant Output Card */}
            <div className="w-full rounded-2xl bg-white dark:bg-[#121620] border border-slate-200 dark:border-white/10 p-5 sm:p-6 shadow-xl space-y-5">
              {/* Header bar: Tabs & Metrics */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-4">
                {/* Result Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActiveTab('summary')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === 'summary'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Summary</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeConversation?.currentParagraph) {
                        onConvertToParagraph();
                      }
                      setActiveTab('paragraph');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === 'paragraph'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5 text-blue-500" />
                    <span>Paragraph Flow</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('original')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === 'original'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>Original Text</span>
                  </button>
                </div>

                {/* Reduction metrics */}
                {activeConversation?.currentSummary && (
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <TrendingDown className="w-3.5 h-3.5" />
                      ~72% shorter
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Saved ~4 min
                    </span>
                  </div>
                )}
              </div>

              {/* Convert to Paragraph Banner (Shown on Summary tab to make conversion easy & discoverable) */}
              {activeTab === 'summary' && activeConversation?.currentSummary && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-gradient-to-r from-blue-50/90 to-indigo-50/90 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200/70 dark:border-blue-500/20 animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-blue-600 text-white shadow-xs">
                      <AlignLeft className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        Convert Summary to Paragraph
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Turn bullet points into seamless, continuous flowing text
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => {
                        onConvertToParagraph('1');
                        setActiveTab('paragraph');
                      }}
                      className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors shadow-xs"
                    >
                      1 Paragraph
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onConvertToParagraph('2');
                        setActiveTab('paragraph');
                      }}
                      className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 text-xs font-medium transition-colors"
                    >
                      2 Paragraphs
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onConvertToParagraph('3');
                        setActiveTab('paragraph');
                      }}
                      className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 text-xs font-medium transition-colors"
                    >
                      3 Paragraphs
                    </button>
                  </div>
                </div>
              )}

              {/* Tab Content */}
              <div className="min-h-[160px] text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans select-text">
                {activeTab === 'summary' && (
                  <div className="space-y-3 whitespace-pre-wrap">
                    {activeConversation?.currentSummary || 'Generating your summary...'}
                  </div>
                )}

                {activeTab === 'paragraph' && (
                  <div className="space-y-4">
                    {/* Paragraph Header with controls */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <AlignLeft className="w-3.5 h-3.5 text-blue-500" />
                          Flowing Paragraph Synthesis
                        </span>
                        <span>•</span>
                        <span>Cohesive transitions applied</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('summary')}
                        className="px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 font-medium transition-colors"
                      >
                        ← Back to Bullet Summary
                      </button>
                    </div>

                    {activeConversation?.currentParagraph ? (
                      <div className="space-y-4 whitespace-pre-wrap leading-loose text-[14.5px] text-slate-800 dark:text-slate-200">
                        {activeConversation.currentParagraph}
                      </div>
                    ) : (
                      <div className="text-center py-8 space-y-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Ready to transform your summary into a continuous paragraph?
                        </p>
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => onConvertToParagraph('1')}
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs"
                          >
                            Convert to 1 Paragraph
                          </button>
                          <button
                            type="button"
                            onClick={() => onConvertToParagraph('2')}
                            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white text-xs font-medium"
                          >
                            Convert to 2 Paragraphs
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Paragraph length adjuster */}
                    {activeConversation?.currentParagraph && (
                      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-white/5 text-xs">
                        <span className="text-slate-400 mr-1">Re-structure paragraph:</span>
                        <button
                          type="button"
                          onClick={() => onConvertToParagraph('1')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          1 Single Paragraph
                        </button>
                        <button
                          type="button"
                          onClick={() => onConvertToParagraph('2')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          2 Flowing Paragraphs
                        </button>
                        <button
                          type="button"
                          onClick={() => onConvertToParagraph('3')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          3 Detailed Paragraphs
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'original' && (
                  <div className="max-h-96 overflow-y-auto p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 font-mono text-xs whitespace-pre-wrap text-slate-600 dark:text-slate-400">
                    {activeConversation?.originalText}
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
                {/* Follow-up Quick Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 mr-1">Quick actions:</span>
                  <button
                    type="button"
                    onClick={() => onFollowUp('shorter', 'Make Shorter')}
                    className="px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    ⚡ Make Shorter
                  </button>
                  <button
                    type="button"
                    onClick={() => onFollowUp('key_points', 'Key Takeaways')}
                    className="px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    📌 Key Takeaways
                  </button>
                  <button
                    type="button"
                    onClick={() => onFollowUp('simpler', 'Simple English')}
                    className="px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    💡 Simpler Language
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onConvertToParagraph();
                      setActiveTab('paragraph');
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/20 transition-colors"
                  >
                    ✨ Convert to Paragraph
                  </button>
                </div>

                {/* Copy / Export */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const textToCopy =
                        activeTab === 'paragraph' && activeConversation?.currentParagraph
                          ? activeConversation.currentParagraph
                          : activeConversation?.currentSummary || '';
                      handleCopy(textToCopy);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    title="Copy content"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy {activeTab === 'paragraph' ? 'Paragraph' : 'Summary'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM SECTION: Prompt Box & 3 Suggestion Cards (Exact Layout as Sample Image) */}
      <div className="space-y-4 pt-6">
        {/* Sleek Prompt Card */}
        <div
          id="prompt-input-box"
          className="w-full rounded-2xl bg-white dark:bg-[#121620] border border-slate-200 dark:border-white/10 shadow-lg p-3 sm:p-4 transition-all focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20"
        >
          {/* Live text statistics when typing */}
          {inputText.length > 0 && (
            <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 px-1 pb-2 border-b border-slate-100 dark:border-white/5 mb-2 font-mono">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-blue-500" />
                {formatNumber(statistics.lines)} lines detected • {formatNumber(statistics.words)} words
              </span>
              <button
                type="button"
                onClick={() => onInputChange('')}
                className="hover:text-rose-500 transition-colors"
              >
                Clear
              </button>
            </div>
          )}

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            placeholder="Message Javeria AI... (Paste 500+ lines or type any document to summarize or convert into paragraphs)"
            rows={2}
            className="w-full bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm sm:text-base resize-none focus:outline-none scrollbar-thin max-h-60"
          />

          {/* Bottom Toolbar inside the Input Box */}
          <div className="flex items-center justify-between pt-2">
            {/* Left buttons (Paperclip + Quick pills) */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Paperclip / File upload */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                title="Upload document (.txt, .md, .csv, .json)"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Dedicated "Summarize" Button (Instant clear summary trigger) */}
              <button
                type="button"
                onClick={() => onSummarize()}
                disabled={!inputText.trim() || isProcessing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  inputText.trim() && !isProcessing
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
                title="Summarize document into concise bullet points"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Summarize</span>
              </button>

              {/* Dedicated "Convert to Paragraph" Button */}
              <button
                type="button"
                onClick={() => {
                  onConvertToParagraph();
                  setActiveTab('paragraph');
                }}
                disabled={(!inputText.trim() && !hasSummary) || isProcessing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  (inputText.trim() || hasSummary) && !isProcessing
                    ? 'bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-300/40 dark:border-indigo-500/30 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
                title="Convert text or summary into continuous flowing paragraph narrative"
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span>Convert to Paragraph</span>
              </button>

              {/* Sample Document Pill */}
              <button
                type="button"
                onClick={onLoadSample}
                disabled={isProcessing}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-medium border border-transparent dark:border-white/5 transition-colors"
                title="Load 500+ lines test document"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>500+ Lines Sample</span>
              </button>
            </div>

            {/* Right buttons: Mic, Audio waveform & Send button */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                onClick={handleSpeechToggle}
                className={`p-2 rounded-xl transition-colors ${
                  isListening
                    ? 'text-rose-500 bg-rose-500/10 animate-pulse'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
                title="Dictate with voice"
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => setShowSettingsDrawer((prev) => !prev)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                title="Mode settings & length controls"
              >
                <Waveform className="w-4 h-4" />
              </button>

              {/* Send / Summarize Icon Button */}
              <button
                type="button"
                onClick={() => onSummarize()}
                disabled={!inputText.trim() || isProcessing}
                className={`p-2 rounded-xl transition-all ${
                  inputText.trim() && !isProcessing
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-md hover:scale-105 active:scale-95'
                    : 'bg-slate-200 dark:bg-white/5 text-slate-400 cursor-not-allowed'
                }`}
                title="Summarize (Enter)"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Settings Drawer if expanded via waveform icon */}
        {showSettingsDrawer && (
          <div className="p-4 rounded-2xl bg-white dark:bg-[#121620] border border-blue-500/30 dark:border-blue-500/20 text-xs space-y-4 animate-in fade-in shadow-xl">
            <div className="flex items-center justify-between text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-100 dark:border-white/5 pb-2">
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-500" />
                Summarization Mode & Output Settings
              </span>
              <button
                type="button"
                onClick={() => setShowSettingsDrawer(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <SummaryModeDropdown
                  currentMode={settings.mode}
                  onSelectMode={(mode) => onUpdateSettings({ mode })}
                  showLabel={true}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">
                  Target Length
                </label>
                <div className="flex items-center gap-1.5 pt-0.5">
                  {(['short', 'medium', 'long'] as const).map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => onUpdateSettings({ length: len })}
                      className={`flex-1 py-2 rounded-xl capitalize font-medium text-xs transition-colors ${
                        settings.length === len
                          ? 'bg-blue-600 text-white font-semibold shadow-xs'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                      }`}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* The 3 Suggestion Cards at Bottom (Exact design from screenshot, functional for Summarize & Paragraphs) */}
        {showHero && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {/* Card 1: Summarize (Bullet Points) */}
            <div
              onClick={() => {
                onUpdateSettings({ mode: 'key_points' });
                onLoadSample();
              }}
              className="p-4 rounded-2xl bg-white/60 dark:bg-[#121620] border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15 cursor-pointer transition-all hover:-translate-y-0.5 group"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                  Smart Bullet Summary
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Condense 500+ lines of text into structured, high-impact key takeaways
              </p>
            </div>

            {/* Card 2: Convert to Paragraph Flow */}
            <div
              onClick={() => {
                onUpdateSettings({ mode: 'balanced', paragraphCount: '2' });
                onLoadSample();
              }}
              className="p-4 rounded-2xl bg-white/60 dark:bg-[#121620] border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15 cursor-pointer transition-all hover:-translate-y-0.5 group"
            >
              <div className="flex items-center gap-2">
                <AlignLeft className="w-3.5 h-3.5 text-blue-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                  Convert to Paragraph Flow
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Transform bullet points or raw data into a continuous, natural narrative
              </p>
            </div>

            {/* Card 3: Executive Analytics Brief */}
            <div
              onClick={() => {
                onUpdateSettings({ mode: 'executive' });
                onLoadSample();
              }}
              className="p-4 rounded-2xl bg-white/60 dark:bg-[#121620] border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15 cursor-pointer transition-all hover:-translate-y-0.5 group"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-emerald-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                  Executive Brief
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                High-level synthesis designed for quick leadership review and decision-making
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
