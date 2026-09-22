import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MainChatWorkspace } from './components/MainChatWorkspace';
import { HistoryView } from './components/HistoryView';
import { TemplatesModal } from './components/TemplatesModal';
import { ExploreModal } from './components/ExploreModal';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { useTheme } from './hooks/useTheme';
import { useLocalModel } from './hooks/useLocalModel';
import { useHistory } from './hooks/useHistory';
import { useSummarizer } from './hooks/useSummarizer';
import { useAuth } from './hooks/useAuth';
import { SummarySettings, SummaryMode, Conversation } from './types';
import { calculateTextStatistics } from './utils/textStatistics';
import { validateInputText } from './utils/validation';
import {
  SAMPLE_LONG_DOCUMENT,
  SAMPLE_LONG_DOCUMENT_TITLE,
  SAMPLE_LENGTHY_PARAGRAPH,
  SAMPLE_LENGTHY_PARAGRAPH_TITLE,
} from './data/sampleDocument';
import { AlertCircle, X } from 'lucide-react';

const DEFAULT_SETTINGS: SummarySettings = {
  mode: 'balanced',
  length: 'medium',
  lengthPercentage: 30,
  paragraphCount: 'natural',
  chunkSize: 900,
};

export default function App() {
  const { theme, setTheme, toggleTheme } = useTheme();
  const { modelInfo, loadModel, unloadModel, reloadModel } = useLocalModel();

  const {
    currentUser,
    isAuthenticated,
    guestUsageCount,
    guestLimit,
    isGuestLimitReached,
    recordGuestUse,
  } = useAuth();

  const {
    conversations,
    activeConversation,
    activeConversationId,
    setActiveConversationId,
    searchQuery,
    setSearchQuery,
    createNewConversation,
    saveActiveConversation,
    renameConversation,
    deleteConversation,
    clearAllHistory,
  } = useHistory(currentUser?.email);

  const {
    isProcessing,
    progress,
    error: summarizerError,
    startSummarization,
    cancelSummarization,
    convertToParagraph,
    executeFollowUp,
    askQuestion,
  } = useSummarizer();

  const [inputText, setInputText] = useState('');
  const [settings, setSettings] = useState<SummarySettings>(DEFAULT_SETTINGS);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeNavTab, setActiveNavTab] = useState('home');
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [exploreModalOpen, setExploreModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsModalTab, setSettingsModalTab] = useState<string>('appearance');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [validationError, setValidationError] = useState<string | null>(null);

  // When active user account changes (login/logout), reset input text
  useEffect(() => {
    setInputText('');
    setValidationError(null);
  }, [currentUser?.email]);

  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const checkGuestUsageAllowed = (): boolean => {
    if (currentUser) {
      return true;
    }
    if (isGuestLimitReached) {
      setValidationError(
        `Free limit reached (${guestLimit}/${guestLimit} uses). Please Sign In or Register to continue using Javeria AI.`
      );
      handleOpenAuth('register');
      return false;
    }
    return true;
  };

  // Live text statistics
  const statistics = calculateTextStatistics(inputText);

  // Synchronize input text when active conversation changes
  useEffect(() => {
    // Keep draft input box clean so previous documents never clutter the prompt area
    setInputText('');
    if (activeConversation) {
      setSettings(activeConversation.settings || DEFAULT_SETTINGS);
    }
  }, [activeConversationId]);

  // Keyboard shortcut support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd + K -> New chat
      if (isCmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleNewSummary();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings]);

  const handleUpdateSettings = (newSettings: Partial<SummarySettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (activeConversation) {
        saveActiveConversation({ ...activeConversation, settings: updated });
      }
      return updated;
    });
  };

  const handleNewSummary = () => {
    setInputText('');
    setValidationError(null);
    setActiveConversationId(null);
  };

  const handleNavSelect = (tab: string) => {
    setActiveNavTab(tab);
    if (tab === 'templates') {
      setTemplatesModalOpen(true);
    } else if (tab === 'explore') {
      setExploreModalOpen(true);
    } else if (tab === 'home') {
      handleNewSummary();
    }
  };

  const handleLoadSample = () => {
    setInputText(SAMPLE_LONG_DOCUMENT);
    setValidationError(null);
    if (!activeConversation) {
      createNewConversation(settings, SAMPLE_LONG_DOCUMENT, SAMPLE_LONG_DOCUMENT_TITLE);
    } else {
      saveActiveConversation({
        ...activeConversation,
        originalText: SAMPLE_LONG_DOCUMENT,
        title: SAMPLE_LONG_DOCUMENT_TITLE,
      });
    }
  };

  const handleLoadLengthyParagraph = () => {
    setInputText(SAMPLE_LENGTHY_PARAGRAPH);
    setValidationError(null);
    const lengthySettings = { ...settings, mode: 'lengthy_paragraph' as SummaryMode };
    if (!activeConversation) {
      createNewConversation(lengthySettings, SAMPLE_LENGTHY_PARAGRAPH, SAMPLE_LENGTHY_PARAGRAPH_TITLE);
    } else {
      saveActiveConversation({
        ...activeConversation,
        originalText: SAMPLE_LENGTHY_PARAGRAPH,
        title: SAMPLE_LENGTHY_PARAGRAPH_TITLE,
        settings: lengthySettings,
      });
    }
  };

  const handleSummarize = async (
    customPrompt?: string,
    fileMeta?: { fileName?: string; fileType?: string },
    customSettings?: Partial<SummarySettings>
  ) => {
    setValidationError(null);
    if (!checkGuestUsageAllowed()) {
      return;
    }

    const textToSummarize = (customPrompt ?? inputText).trim();
    const validation = validateInputText(textToSummarize);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Please enter text to summarize.');
      return;
    }

    // Immediately clear input box so it is not shown below again
    setInputText('');

    if (!currentUser) {
      recordGuestUse();
    }

    const activeSettings = customSettings ? { ...settings, ...customSettings } : settings;

    let targetConv = activeConversation;
    if (!targetConv) {
      targetConv = createNewConversation(activeSettings, textToSummarize);
    } else {
      targetConv = { ...targetConv, originalText: textToSummarize, settings: activeSettings };
    }

    if (fileMeta?.fileName) {
      targetConv.fileName = fileMeta.fileName;
      targetConv.fileType = fileMeta.fileType;
    }

    await startSummarization(textToSummarize, activeSettings, targetConv, (updated) => {
      if (fileMeta?.fileName) {
        updated.fileName = fileMeta.fileName;
        updated.fileType = fileMeta.fileType;
      }
      saveActiveConversation(updated);
    });
  };

  const handleConvertToParagraph = async (
    customParagraphCount?: '1' | '2' | '3' | 'natural',
    fileMeta?: { fileName?: string; fileType?: string }
  ) => {
    setValidationError(null);
    if (!checkGuestUsageAllowed()) {
      return;
    }

    const targetCount = customParagraphCount || settings.paragraphCount;

    // 1. If summary already exists in active conversation, convert it directly
    if (activeConversation?.currentSummary) {
      if (!currentUser) {
        recordGuestUse();
      }
      setInputText('');
      await convertToParagraph(
        activeConversation.currentSummary,
        targetCount,
        activeConversation,
        (updated) => {
          saveActiveConversation(updated);
        }
      );
      return;
    }

    // 2. If user pasted input text and directly clicks "Convert to Paragraph"
    const textToConvert = inputText.trim();
    if (textToConvert) {
      const validation = validateInputText(textToConvert);
      if (!validation.isValid) {
        setValidationError(validation.error || 'Please enter text to summarize into paragraphs.');
        return;
      }

      // Immediately clear input box so it is not shown below again
      setInputText('');

      if (!currentUser) {
        recordGuestUse();
      }

      let targetConv = activeConversation;
      if (!targetConv) {
        targetConv = createNewConversation(settings, textToConvert);
      } else {
        targetConv = { ...targetConv, originalText: textToConvert, settings };
      }

      if (fileMeta?.fileName) {
        targetConv.fileName = fileMeta.fileName;
        targetConv.fileType = fileMeta.fileType;
      }

      await startSummarization(textToConvert, settings, targetConv, async (summarizedConv) => {
        if (fileMeta?.fileName) {
          summarizedConv.fileName = fileMeta.fileName;
          summarizedConv.fileType = fileMeta.fileType;
        }
        saveActiveConversation(summarizedConv);
        if (summarizedConv.currentSummary) {
          await convertToParagraph(
            summarizedConv.currentSummary,
            targetCount,
            summarizedConv,
            (paraConv) => {
              saveActiveConversation(paraConv);
            }
          );
        }
      });
      return;
    }

    setValidationError('Please enter or paste text to convert into paragraphs.');
  };

  const handleFollowUp = async (
    operation: 'shorter' | 'detailed' | 'simpler' | 'key_points' | 'terms' | 'executive',
    label: string
  ) => {
    if (!activeConversation) return;
    if (!checkGuestUsageAllowed()) {
      return;
    }
    if (!currentUser) {
      recordGuestUse();
    }
    await executeFollowUp(operation, label, activeConversation, (updated) => {
      saveActiveConversation(updated);
    });
  };

  const handleAskQuestion = async (question: string) => {
    setValidationError(null);
    if (!checkGuestUsageAllowed()) {
      return;
    }

    const trimmed = question.trim();
    if (!trimmed) return;

    setInputText('');

    if (!currentUser) {
      recordGuestUse();
    }

    let targetConv = activeConversation;
    if (!targetConv) {
      targetConv = createNewConversation(settings, '');
    }

    await askQuestion(trimmed, targetConv, settings, (updated) => {
      saveActiveConversation(updated);
    });
  };

  const handleSelectTemplate = (title: string, content: string, mode: SummaryMode) => {
    setInputText(content);
    setSettings((prev) => ({ ...prev, mode }));
    setValidationError(null);
    createNewConversation({ ...settings, mode }, content, title);
  };

  const handleOpenSettings = (tab?: string) => {
    if (tab) setSettingsModalTab(tab);
    setSettingsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#090b0f] text-slate-900 dark:text-slate-100 flex overflow-hidden antialiased selection:bg-blue-500 selection:text-white transition-colors duration-150">
      {/* Left Sidebar (Exact layout as sample Axora interface) */}
      <Sidebar
        isOpen={isSidebarOpen}
        conversations={conversations}
        activeConversationId={activeConversationId}
        searchQuery={searchQuery}
        theme={theme}
        activeNavTab={activeNavTab}
        onSelectNavTab={handleNavSelect}
        onSelectConversation={(id) => {
          setActiveConversationId(id);
          setInputText('');
          setActiveNavTab('home');
          setValidationError(null);
        }}
        onNewConversation={handleNewSummary}
        onSearchChange={setSearchQuery}
        onRenameConversation={renameConversation}
        onDeleteConversation={deleteConversation}
        onClearAllHistory={clearAllHistory}
        onToggleTheme={toggleTheme}
        onOpenSettings={handleOpenSettings}
        onOpenAuth={handleOpenAuth}
        onCloseMobileSidebar={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto bg-slate-50/70 dark:bg-[#0c0e14] relative">
        {/* Top Bar with AI Assistant dropdown, theme toggle, and menu */}
        <Header
          modelInfo={modelInfo}
          isProcessing={isProcessing}
          theme={theme}
          currentMode={settings.mode}
          onSelectMode={(mode) => handleUpdateSettings({ mode })}
          onToggleTheme={toggleTheme}
          onOpenSettings={handleOpenSettings}
          onOpenAuth={handleOpenAuth}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onClearCurrentChat={handleNewSummary}
          onOpenHistory={() => setActiveNavTab('history')}
        />

        {/* Validation or Engine Error Alert Banner */}
        {(validationError || summarizerError) && (
          <div className="mx-4 sm:mx-8 mt-2 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs sm:text-sm text-rose-800 dark:text-rose-300 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{validationError || summarizerError}</span>
            </div>
            <button
              type="button"
              onClick={() => setValidationError(null)}
              className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Workspace (Hero with Iridescent Orb + Message Card + 3 Suggestion Cards) OR Complete History View */}
        <main id="main-content" className="flex-1 flex flex-col justify-between overflow-y-auto">
          {activeNavTab === 'history' ? (
            <HistoryView
              conversations={conversations}
              activeConversationId={activeConversationId}
              currentUserEmail={currentUser?.email}
              onSelectConversation={(id) => {
                setActiveConversationId(id);
                setInputText('');
                setActiveNavTab('home');
                setValidationError(null);
              }}
              onNewConversation={() => {
                handleNewSummary();
                setActiveNavTab('home');
              }}
              onRenameConversation={renameConversation}
              onDeleteConversation={deleteConversation}
              onClearAllHistory={clearAllHistory}
              onBackToChat={() => setActiveNavTab('home')}
            />
          ) : (
            <MainChatWorkspace
              inputText={inputText}
              onInputChange={(val) => {
                setInputText(val);
                setValidationError(null);
              }}
              statistics={statistics}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onSummarize={handleSummarize}
              onConvertToParagraph={handleConvertToParagraph}
              onLoadSample={handleLoadSample}
              onLoadLengthyParagraph={handleLoadLengthyParagraph}
              isProcessing={isProcessing}
              activeConversation={activeConversation}
              onFollowUp={handleFollowUp}
              currentUser={currentUser}
              guestUsageCount={guestUsageCount}
              guestLimit={guestLimit}
              isGuestLimitReached={isGuestLimitReached}
              isAuthenticated={isAuthenticated}
              onOpenAuth={handleOpenAuth}
              onAskQuestion={handleAskQuestion}
            />
          )}
        </main>
      </div>

      {/* Templates Modal */}
      <TemplatesModal
        isOpen={templatesModalOpen}
        onClose={() => setTemplatesModalOpen(false)}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Explore Capabilities Modal */}
      <ExploreModal
        isOpen={exploreModalOpen}
        onClose={() => setExploreModalOpen(false)}
        onLoad500Lines={handleLoadSample}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsModalOpen}
        initialTab={settingsModalTab}
        onClose={() => setSettingsModalOpen(false)}
        theme={theme}
        onSetTheme={setTheme}
        modelInfo={modelInfo}
        onLoadModel={loadModel}
        onUnloadModel={unloadModel}
        onReloadModel={reloadModel}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onClearAllHistory={clearAllHistory}
      />

      {/* Authentication Modal (Sign In / Register / Verify Code) */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}
