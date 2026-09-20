import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Cpu,
  Shield,
  Database,
  Info,
  Layers,
  BookOpen,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Monitor,
  Moon,
  Sun,
  Code,
  Sparkles,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import { ModelInfo, SummarySettings, SummaryMode, SummaryLength, ParagraphOption } from '../types';
import { ThemeMode } from '../hooks/useTheme';
import { historyService } from '../services/HistoryService';
import { SummaryModeDropdown } from './SummaryModeDropdown';

interface SettingsModalProps {
  isOpen: boolean;
  initialTab?: string;
  onClose: () => void;
  theme: ThemeMode;
  onSetTheme: (t: ThemeMode) => void;
  modelInfo: ModelInfo;
  onLoadModel: () => void;
  onUnloadModel: () => void;
  onReloadModel: () => void;
  settings: SummarySettings;
  onUpdateSettings: (s: Partial<SummarySettings>) => void;
  onClearAllHistory: () => void;
}

type TabKey = 'appearance' | 'model' | 'summarization' | 'privacy' | 'storage' | 'training' | 'quality' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  initialTab = 'appearance',
  onClose,
  theme,
  onSetTheme,
  modelInfo,
  onLoadModel,
  onUnloadModel,
  onReloadModel,
  settings,
  onUpdateSettings,
  onClearAllHistory,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>((initialTab as TabKey) || 'appearance');
  const [storageInfo, setStorageInfo] = useState<{ count: number; estimatedBytes: number }>({
    count: 0,
    estimatedBytes: 0,
  });

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab as TabKey);
    }
  }, [initialTab]);

  useEffect(() => {
    if (isOpen) {
      historyService.getStorageEstimate().then(setStorageInfo);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'appearance', label: 'Appearance', icon: <Sun className="w-4 h-4" /> },
    { key: 'model', label: 'AI Model & WebGPU', icon: <Cpu className="w-4 h-4" /> },
    { key: 'summarization', label: 'Summarization', icon: <Sliders className="w-4 h-4" /> },
    { key: 'privacy', label: 'Privacy', icon: <Shield className="w-4 h-4" /> },
    { key: 'storage', label: 'Storage', icon: <Database className="w-4 h-4" /> },
    { key: 'training', label: 'Training & Fine-Tuning', icon: <Code className="w-4 h-4" /> },
    { key: 'quality', label: 'Evaluation Metrics', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'about', label: 'About', icon: <Info className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="settings-modal"
        className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Settings & Architecture
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Two-column tabbed layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Navigation Sidebar */}
          <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-2 md:p-3 bg-slate-50/70 dark:bg-slate-950/50 flex md:flex-col overflow-x-auto md:overflow-y-auto shrink-0 gap-1 scrollbar-none">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left whitespace-nowrap shrink-0 md:shrink ${
                  activeTab === t.key
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 p-5 md:p-6 overflow-y-auto scrollbar-thin space-y-5">
            {/* TAB: APPEARANCE */}
            {activeTab === 'appearance' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                    Color Theme
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Choose how LocalSummarize AI looks on your screen.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'light', label: 'Light', icon: <Sun className="w-4 h-4 text-amber-500" /> },
                    { key: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4 text-blue-400" /> },
                    { key: 'system', label: 'System', icon: <Monitor className="w-4 h-4 text-slate-400" /> },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onSetTheme(item.key as ThemeMode)}
                      className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-xs font-medium gap-2 transition-all ${
                        theme === item.key
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 font-semibold ring-1 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: AI MODEL & WEBGPU */}
            {activeTab === 'model' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                    On-Device Model Management
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Summarization operates strictly on your client device without secret API keys.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Model Name:</span>
                    <strong className="font-semibold text-slate-900 dark:text-slate-100">{modelInfo.name}</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Status:</span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {modelInfo.status === 'ready' ? 'Local AI Ready' : modelInfo.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Active Runtime:</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">{modelInfo.runtime}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Model Size:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">{modelInfo.sizeMB} MB</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400">WebGPU Acceleration:</span>
                    <span className={`font-medium ${modelInfo.webGpuSupported ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {modelInfo.webGpuSupported ? 'Hardware Supported' : 'Fallback / Not Available in Browser'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400">WebAssembly (WASM):</span>
                    <span className="text-emerald-600 font-medium">Supported</span>
                  </div>
                  {modelInfo.hardwareConcurrency && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 dark:text-slate-400">CPU Threads:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">{modelInfo.hardwareConcurrency} logical cores</span>
                    </div>
                  )}
                </div>

                {/* Local Download Notice */}
                <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    Local Model Architecture
                  </div>
                  <p className="text-[11px] leading-relaxed text-blue-800 dark:text-blue-300">
                    The model files are downloaded once and then reused locally. Processing happens directly in your browser tab without transmitting your private documents over the internet.
                  </p>
                </div>

                {/* Model Controls */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onLoadModel}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  >
                    Load Model
                  </button>
                  <button
                    type="button"
                    onClick={onUnloadModel}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
                  >
                    Unload Model
                  </button>
                  <button
                    type="button"
                    onClick={onReloadModel}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-blue-200 dark:border-blue-800"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reload Model
                  </button>
                </div>
              </div>
            )}

            {/* TAB: SUMMARIZATION SETTINGS */}
            {activeTab === 'summarization' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                    Summarization Defaults
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure default chunking and output preferences.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <SummaryModeDropdown
                      currentMode={settings.mode}
                      onSelectMode={(m) => onUpdateSettings({ mode: m })}
                      showLabel={true}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Default Summary Length
                    </label>
                    <select
                      value={settings.length}
                      onChange={(e) => onUpdateSettings({ length: e.target.value as SummaryLength })}
                      className="w-full text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      <option value="short">Short (~15-20% length)</option>
                      <option value="medium">Medium (~30-35% length)</option>
                      <option value="long">Long (~45-50% length)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Chunk Token Capacity
                    </label>
                    <select
                      value={settings.chunkSize}
                      onChange={(e) => onUpdateSettings({ chunkSize: parseInt(e.target.value, 10) })}
                      className="w-full text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      <option value="600">600 tokens (Smaller, safer on low-memory devices)</option>
                      <option value="900">900 tokens (Recommended balanced)</option>
                      <option value="1400">1400 tokens (Larger semantic contexts)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PRIVACY */}
            {activeTab === 'privacy' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                    Privacy Guarantee & Data Handling
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    How LocalSummarize AI protects your documents.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-slate-100">Zero Remote AI API Calls:</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        Your text is NEVER sent to OpenAI, Google Gemini, Anthropic Claude, or any cloud LLM API endpoint.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-slate-100">Client-Side IndexedDB Storage:</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        Your conversation history and summaries remain strictly inside your browser profile.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-slate-100">No Tracking or Analytics:</strong>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        Document contents are never logged, telemetry-tagged, or analyzed for advertising.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: STORAGE */}
            {activeTab === 'storage' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                    Browser Storage Management
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Local IndexedDB database metrics.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Stored Conversations:</span>
                    <strong className="font-semibold text-slate-900 dark:text-slate-100">{storageInfo.count}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Estimated Database Size:</span>
                    <span className="font-mono text-slate-900 dark:text-slate-100">
                      {(storageInfo.estimatedBytes / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to permanently delete all local history?')) {
                        onClearAllHistory();
                        setStorageInfo({ count: 0, estimatedBytes: 0 });
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All Local History</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB: TRAINING & FINE-TUNING ARCHITECTURE */}
            {activeTab === 'training' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                    Model Training & Fine-Tuning Architecture
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Offline pipeline documentation for training open-source summarization models.
                  </p>
                </div>

                <div className="text-xs space-y-3 leading-relaxed text-slate-700 dark:text-slate-300">
                  <p>
                    As specified in the application architecture, <strong>model training is strictly decoupled from client inference</strong> to ensure browser responsiveness.
                  </p>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                      Standard JSON Training Dataset Schema
                    </h4>
                    <pre className="font-mono text-[11px] p-2.5 rounded-lg bg-slate-900 text-emerald-400 overflow-x-auto">
{`{
  "text": "Full long-form source text (500+ lines, articles, reports)",
  "summary": "Target concise, human-verified abstractive summary"
}`}
                    </pre>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                      Recommended Offline Pipeline
                    </h4>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-400">
                      <li><strong>Dataset Collection:</strong> Clean raw texts into standardized JSON pairs.</li>
                      <li><strong>Preprocessing:</strong> Normalize whitespace and filter low-quality samples.</li>
                      <li><strong>Train/Validation Split:</strong> Standard 80/20 train/test partition.</li>
                      <li><strong>Tokenizer Selection:</strong> Pair with BPE or WordPiece tokenizer.</li>
                      <li><strong>Fine-Tuning:</strong> Train offline via PyTorch / Hugging Face Transformers.</li>
                      <li><strong>Model Quantization:</strong> Export to ONNX / WebAssembly format (INT8/FP16).</li>
                      <li><strong>Application Integration:</strong> Connect exported weights via the LocalModelService adapter.</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: QUALITY & EVALUATION */}
            {activeTab === 'quality' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                    Quality & Accuracy Evaluation
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Understanding the empirical metrics generated by the local engine.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                    <strong className="text-blue-600 dark:text-blue-400">ROUGE-1:</strong>
                    <p className="text-slate-600 dark:text-slate-400">
                      Measures unigram (single-word) overlap between the source document and generated summary.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                    <strong className="text-blue-600 dark:text-blue-400">ROUGE-2:</strong>
                    <p className="text-slate-600 dark:text-slate-400">
                      Measures bigram (two-word phrase) overlap, validating structural flow and phrasal coherence.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                    <strong className="text-blue-600 dark:text-blue-400">Faithfulness:</strong>
                    <p className="text-slate-600 dark:text-slate-400">
                      Verifies that numbers, dates, named entities, and claims are factually grounded in the source text.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                    <strong className="text-blue-600 dark:text-blue-400">Compression Ratio:</strong>
                    <p className="text-slate-600 dark:text-slate-400">
                      The percentage reduction achieved from the original word count to the generated summary.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: ABOUT */}
            {activeTab === 'about' && (
              <div className="space-y-4 text-xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                    About LocalSummarize AI
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    Long Text. Clear Summary. Private AI.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2 text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Version:</span>
                    <span className="font-mono font-semibold">2.4.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Architecture:</span>
                    <span>Client-First / Local WebGPU & WASM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Storage Engine:</span>
                    <span>Browser IndexedDB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">External API Keys:</span>
                    <span className="text-emerald-600 font-semibold">None (100% Free & Private)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
