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
  Lock,
  LogIn,
  FileCode,
  Image as ImageIcon,
  FileCheck,
  FileType,
  Loader2,
  X,
  FileDown,
  UploadCloud,
} from 'lucide-react';
import { IridescentOrb } from './IridescentOrb';
import { Conversation, SummarySettings, TextStatistics, SummaryMode } from '../types';
import { formatNumber } from '../utils/formatting';
import { SAMPLE_LONG_DOCUMENT, SAMPLE_LONG_DOCUMENT_TITLE } from '../data/sampleDocument';
import { SummaryModeDropdown } from './SummaryModeDropdown';
import { FileExtractorService, ExtractedFileResult } from '../services/FileExtractorService';
import { ExportService } from '../services/ExportService';

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
  guestUsageCount?: number;
  guestLimit?: number;
  isGuestLimitReached?: boolean;
  isAuthenticated?: boolean;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
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
  guestUsageCount = 0,
  guestLimit = 10,
  isGuestLimitReached = false,
  isAuthenticated = false,
  onOpenAuth,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'paragraph' | 'original'>('summary');
  const [isCopied, setIsCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  // Multi-file extraction & parsing state (PDF, Image OCR, Code, Text)
  const [isExtractingFile, setIsExtractingFile] = useState(false);
  const [extractStatus, setExtractStatus] = useState('');
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractedFile, setExtractedFile] = useState<ExtractedFileResult | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  // Chatbot identity greeting based on time of day - ALWAYS Javeria as requested
  const getGreetingData = () => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
      return {
        title: 'Good Morning, Javeria.',
        period: 'Morning',
        badge: 'Morning',
        icon: 'sun',
      };
    }
    if (hour >= 12 && hour < 17) {
      return {
        title: 'Good Afternoon, Javeria.',
        period: 'Afternoon',
        badge: 'Afternoon',
        icon: 'sun',
      };
    }
    if (hour >= 17 && hour < 21) {
      return {
        title: 'Good Evening, Javeria.',
        period: 'Evening',
        badge: 'Evening',
        icon: 'sunset',
      };
    }
    // Night: 21:00 (9 PM) to 04:59 (4:59 AM)
    return {
      title: 'Good Night, Javeria.',
      period: 'Night',
      badge: 'Night',
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

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsExtractingFile(true);
    setExtractProgress(15);
    setExtractStatus(`Extracting ${file.name}...`);
    try {
      const result = await FileExtractorService.extractFile(file, (status, pct) => {
        setExtractStatus(status);
        setExtractProgress(pct);
      });
      onInputChange(result.content);
      setExtractedFile(result);
      setExtractStatus(`Loaded ${result.fileName}`);
    } catch (err: any) {
      alert(err.message || 'Could not extract text from this file.');
    } finally {
      setIsExtractingFile(false);
    }
  };

  const handleCopy = (text: string) => {
    if (!text) return;
    ExportService.copyToClipboard(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadPdf = () => {
    if (!activeConversation) return;
    const title = activeConversation.title || 'Javeria_AI_Document';
    if (activeTab === 'paragraph' && activeConversation.currentParagraph) {
      ExportService.downloadSingleTextPdf(title, activeConversation.currentParagraph, 'Paragraph');
    } else if (activeTab === 'summary' && activeConversation.currentSummary) {
      ExportService.downloadPdf(
        title,
        activeConversation.currentSummary,
        activeConversation.currentParagraph,
        {
          mode: activeConversation.settings.mode,
        }
      );
    } else {
      ExportService.downloadSingleTextPdf(title, activeConversation.originalText, 'Document');
    }
    setDownloadNotice('PDF downloaded successfully!');
    setTimeout(() => setDownloadNotice(null), 2500);
  };

  const handleDownloadTxt = () => {
    if (!activeConversation) return;
    const title = activeConversation.title || 'Javeria_AI_Document';
    const content =
      activeTab === 'paragraph' && activeConversation.currentParagraph
        ? activeConversation.currentParagraph
        : activeTab === 'original'
        ? activeConversation.originalText
        : activeConversation.currentSummary;
    ExportService.downloadTxt(title, content, activeTab);
    setDownloadNotice('TXT file downloaded successfully!');
    setTimeout(() => setDownloadNotice(null), 2500);
  };

  const handleDownloadMarkdown = () => {
    if (!activeConversation) return;
    const title = activeConversation.title || 'Javeria_AI_Document';
    ExportService.downloadMarkdown(
      title,
      activeConversation.currentSummary,
      activeConversation.currentParagraph,
      {
        mode: activeConversation.settings.mode,
      }
    );
    setDownloadNotice('Markdown file downloaded successfully!');
    setTimeout(() => setDownloadNotice(null), 2500);
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
      if (isGuestLimitReached) {
        onOpenAuth?.('register');
        return;
      }
      if (inputText.trim() && !isProcessing) {
        onSummarize();
      }
    }
  };

  const hasSummary = Boolean(activeConversation?.currentSummary);
  const showHero = !hasSummary && !isProcessing;

  return (
    <div className="flex-1 flex flex-col justify-between max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10">
      {/* Hidden file input supporting PDF, Images/OCR, Code, and Text */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,.text,.rtf,.log,.json,.csv,.tsv,.xml,.yaml,.yml,.js,.ts,.tsx,.jsx,.py,.java,.cpp,.c,.cs,.php,.rb,.go,.rs,.swift,.kt,.html,.css,.sql,.sh,.png,.jpg,.jpeg,.webp,.bmp,image/*,application/pdf"
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
              {/* Dynamic Period & Time Badge (without "Session") */}
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

                {/* Download, Export & Copy Action Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {/* Copy Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const textToCopy =
                        activeTab === 'paragraph' && activeConversation?.currentParagraph
                          ? activeConversation.currentParagraph
                          : activeConversation?.currentSummary || '';
                      handleCopy(textToCopy);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition-all active:scale-95 cursor-pointer shadow-xs"
                    title="Copy content to clipboard"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-500 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>Copy {activeTab === 'paragraph' ? 'Paragraph' : 'Summary'}</span>
                      </>
                    )}
                  </button>

                  {/* Download PDF Button */}
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800/40 transition-all active:scale-95 cursor-pointer shadow-xs"
                    title="Download document as formatted PDF (.pdf)"
                  >
                    <FileDown className="w-3.5 h-3.5 text-rose-500" />
                    <span>Download PDF</span>
                  </button>

                  {/* Download TXT Button */}
                  <button
                    type="button"
                    onClick={handleDownloadTxt}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/5 transition-all active:scale-95 cursor-pointer shadow-xs"
                    title="Download document as plain text (.txt)"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Download TXT</span>
                  </button>

                  {/* Download Markdown Button */}
                  <button
                    type="button"
                    onClick={handleDownloadMarkdown}
                    className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                    title="Download formatted Markdown (.md)"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>MD</span>
                  </button>
                </div>
              </div>

              {/* Download notification banner */}
              {downloadNotice && (
                <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-[12px] text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>{downloadNotice}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM SECTION: Prompt Box & 3 Suggestion Cards (Exact Layout as Sample Image) */}
      <div className="space-y-4 pt-6">
        {/* Guest Limit Reached Warning Banner */}
        {!isAuthenticated && isGuestLimitReached && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-sm animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm">
                  Free Limit Reached ({guestLimit}/{guestLimit} Uses)
                </p>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] sm:text-xs">
                  Aap 10 martaba summarize/convert use kar chukay hain. Mazeed use karne ke liye please account banayein ya login karein.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenAuth?.('register')}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all shrink-0 cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Register</span>
            </button>
          </div>
        )}

        {/* Guest Usage Progress Indicator (when not yet reached 10) */}
        {!isAuthenticated && !isGuestLimitReached && (
          <div className="flex items-center justify-between text-xs px-1 text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>Free Guest Mode:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {guestLimit - guestUsageCount} of {guestLimit} free uses remaining
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpenAuth?.('login')}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
            >
              Sign In for Unlimited
            </button>
          </div>
        )}

        {/* Sleek Prompt Card with Drag & Drop */}
        <div
          id="prompt-input-box"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingFile(true);
          }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingFile(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileUpload(e.dataTransfer.files[0]);
            }
          }}
          className={`w-full rounded-2xl bg-white dark:bg-[#121620] border transition-all p-3 sm:p-4 shadow-lg focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 ${
            isDraggingFile
              ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20'
              : 'border-slate-200 dark:border-white/10'
          }`}
        >
          {/* File Extraction Progress Status */}
          {isExtractingFile && (
            <div className="flex items-center gap-3 p-3 mb-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/50 text-xs text-blue-700 dark:text-blue-300 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{extractStatus}</div>
                <div className="w-full bg-blue-200 dark:bg-blue-900/60 h-1.5 rounded-full mt-1 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${extractProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Extracted File Badge */}
          {extractedFile && !isExtractingFile && (
            <div className="flex items-center justify-between gap-2 p-2 px-3 mb-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-200 font-medium">
              <div className="flex items-center gap-2 truncate">
                {extractedFile.fileType === 'pdf' ? (
                  <FileDown className="w-4 h-4 text-rose-500 shrink-0" />
                ) : extractedFile.fileType === 'image' ? (
                  <ImageIcon className="w-4 h-4 text-purple-500 shrink-0" />
                ) : extractedFile.fileType === 'code' ? (
                  <FileCode className="w-4 h-4 text-amber-500 shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                )}
                <span className="truncate font-semibold">{extractedFile.fileName}</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                  ({formatNumber(extractedFile.wordCount)} words extracted)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setExtractedFile(null);
                  onInputChange('');
                }}
                className="p-1 hover:text-rose-500 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Remove attached file"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Live text statistics when typing */}
          {inputText.length > 0 && (
            <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 px-1 pb-2 border-b border-slate-100 dark:border-white/5 mb-2 font-mono">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-blue-500" />
                {formatNumber(statistics.lines)} lines detected • {formatNumber(statistics.words)} words
              </span>
              <button
                type="button"
                onClick={() => {
                  onInputChange('');
                  setExtractedFile(null);
                }}
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
            placeholder="Message Javeria AI... (Upload or paste PDF, TXT, Code, Image, or 500+ lines to summarize or convert into paragraphs)"
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
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                title="Upload file (PDF, TXT, Code, Picture/Image OCR, Docs, CSV)"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Dedicated "Summarize" Button (Instant clear summary trigger) */}
              <button
                type="button"
                onClick={() => {
                  if (isGuestLimitReached) {
                    onOpenAuth?.('register');
                    return;
                  }
                  onSummarize();
                }}
                disabled={!inputText.trim() || isProcessing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  inputText.trim() && !isProcessing
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer'
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
                  if (isGuestLimitReached) {
                    onOpenAuth?.('register');
                    return;
                  }
                  onConvertToParagraph();
                  setActiveTab('paragraph');
                }}
                disabled={(!inputText.trim() && !hasSummary) || isProcessing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  (inputText.trim() || hasSummary) && !isProcessing
                    ? 'bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-300/40 dark:border-indigo-500/30 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 cursor-pointer'
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
                onClick={() => {
                  if (isGuestLimitReached) {
                    onOpenAuth?.('register');
                    return;
                  }
                  onSummarize();
                }}
                disabled={!inputText.trim() || isProcessing}
                className={`p-2 rounded-xl transition-all ${
                  inputText.trim() && !isProcessing
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-md hover:scale-105 active:scale-95 cursor-pointer'
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
                if (isGuestLimitReached) {
                  onOpenAuth?.('register');
                  return;
                }
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
                if (isGuestLimitReached) {
                  onOpenAuth?.('register');
                  return;
                }
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
                if (isGuestLimitReached) {
                  onOpenAuth?.('register');
                  return;
                }
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
