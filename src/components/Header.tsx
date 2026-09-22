import React, { useState, useRef, useEffect } from 'react';
import {
  MoreHorizontal,
  Sun,
  Moon,
  Menu,
  Settings as SettingsIcon,
  Sparkles,
  Download,
  Trash2,
  HelpCircle,
  Cpu,
  History,
} from 'lucide-react';
import { ModelInfo, SummaryMode } from '../types';
import { ThemeMode } from '../hooks/useTheme';
import { SummaryModeDropdown } from './SummaryModeDropdown';
import { useAuth } from '../hooks/useAuth';
import { LogIn, User as UserIcon, LogOut, UserPlus } from 'lucide-react';

interface HeaderProps {
  modelInfo: ModelInfo;
  isProcessing: boolean;
  theme: ThemeMode;
  currentMode: SummaryMode;
  onSelectMode: (mode: SummaryMode) => void;
  onToggleTheme: () => void;
  onOpenSettings: (tab?: string) => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
  onToggleSidebar: () => void;
  onClearCurrentChat: () => void;
  onOpenHistory?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  modelInfo,
  isProcessing,
  theme,
  currentMode,
  onSelectMode,
  onToggleTheme,
  onOpenSettings,
  onOpenAuth,
  onToggleSidebar,
  onClearCurrentChat,
  onOpenHistory,
}) => {
  const { currentUser, logout } = useAuth();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      id="app-header"
      className="h-16 border-b border-transparent dark:border-white/5 bg-transparent px-4 sm:px-8 flex items-center justify-between z-20 sticky top-0"
    >
      {/* Left: Mobile hamburger & Summary Mode dropdown (Exact match to user screenshot) */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <button
          id="btn-sidebar-toggle"
          type="button"
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5 transition-colors lg:hidden"
          aria-label="Toggle Navigation Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Summary Mode Dropdown matching user screenshot */}
        <div className="w-48 sm:w-56">
          <SummaryModeDropdown
            currentMode={currentMode}
            onSelectMode={onSelectMode}
            showLabel={false}
            buttonClassName="py-1.5 px-3 text-xs sm:text-xs rounded-xl"
          />
        </div>
      </div>

      {/* Right: User Auth, Theme Toggle & Three-Dots Menu (•••) */}
      <div className="flex items-center gap-2">
        {/* User Auth Button */}
        {currentUser ? (
          <button
            type="button"
            onClick={() => onOpenAuth?.('login')}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-200/60 dark:hover:bg-white/5 border border-transparent hover:border-slate-200 dark:hover:border-white/10 transition-all text-xs text-slate-700 dark:text-slate-200"
            title={`Logged in as ${currentUser.name} (${currentUser.email})`}
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-full h-full object-cover object-top"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{currentUser.name.slice(0, 1)}</span>
              )}
            </div>
            <span className="font-medium max-w-[100px] truncate">{currentUser.name}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenAuth?.('login')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/5 text-xs font-medium transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth?.('register')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register</span>
            </button>
          </div>
        )}

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5 transition-colors"
          title={`Switch Theme (Current: ${theme})`}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>

        {/* Quick History Button */}
        {onOpenHistory && (
          <button
            type="button"
            onClick={onOpenHistory}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5 transition-colors"
            title="Open Conversation History"
          >
            <History className="w-4 h-4" />
          </button>
        )}

        {/* Three dots menu ••• */}
        <div className="relative" ref={moreMenuRef}>
          <button
            type="button"
            onClick={() => setShowMoreMenu((prev) => !prev)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5 transition-colors"
            title="More Options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMoreMenu && (
            <div className="absolute right-0 mt-2 w-52 p-1.5 rounded-2xl bg-white dark:bg-[#181c26] border border-slate-200 dark:border-white/10 shadow-2xl z-50 text-xs animate-in fade-in slide-in-from-top-2">
              {onOpenHistory && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenHistory();
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 text-left font-medium text-blue-600 dark:text-blue-400"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Conversation History</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onOpenAuth?.('login');
                  setShowMoreMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 text-left"
              >
                <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                <span>{currentUser ? 'Switch / Manage Account' : 'Sign In / Register'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenSettings();
                  setShowMoreMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 text-left"
              >
                <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>Settings</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenSettings('model');
                  setShowMoreMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 text-left"
              >
                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                <span>Model Engine & Memory</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClearCurrentChat();
                  setShowMoreMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-left"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Current Chat</span>
              </button>

              {currentUser && (
                <>
                  <div className="my-1 border-t border-slate-100 dark:border-white/5" />
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-left font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out ({currentUser.name})</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
