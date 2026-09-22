import React, { useState, useEffect } from 'react';
import {
  Home,
  LayoutGrid,
  Compass,
  History as HistoryIcon,
  Wallet,
  Search,
  MessageSquare,
  Trash2,
  Edit2,
  Check,
  X,
  Plus,
  ChevronDown,
  Sun,
  Moon,
  Settings as SettingsIcon,
  Sparkles,
  Command,
  FileText,
  AlertTriangle,
  LogOut,
  LogIn,
  UserCheck,
  CheckCircle2,
  ArrowRight,
  User as UserIcon,
  UserPlus,
} from 'lucide-react';
import { Conversation } from '../types';
import { ThemeMode } from '../hooks/useTheme';
import { getStoredAvatar } from '../utils/avatarStore';
import { useAuth } from '../hooks/useAuth';
import { isOwner } from '../services/authService';

interface SidebarProps {
  isOpen: boolean;
  conversations: Conversation[];
  activeConversationId: string | null;
  searchQuery: string;
  theme: ThemeMode;
  activeNavTab: string;
  onSelectNavTab: (tab: string) => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onSearchChange: (q: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  onClearAllHistory: () => void;
  onToggleTheme: () => void;
  onOpenSettings: (tab?: string) => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onCloseMobileSidebar: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  conversations,
  activeConversationId,
  searchQuery,
  theme,
  activeNavTab,
  onSelectNavTab,
  onSelectConversation,
  onNewConversation,
  onSearchChange,
  onRenameConversation,
  onDeleteConversation,
  onClearAllHistory,
  onToggleTheme,
  onOpenSettings,
  onOpenAuth,
  onCloseMobileSidebar,
}) => {
  const { currentUser, logout } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string>(getStoredAvatar());

  useEffect(() => {
    const handleAvatarChange = () => {
      setAvatarSrc(getStoredAvatar());
    };
    window.addEventListener('javeria-avatar-changed', handleAvatarChange);
    return () => window.removeEventListener('javeria-avatar-changed', handleAvatarChange);
  }, []);

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const startRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleSaveRename = (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  // Group conversations by time (e.g., Today, Yesterday, 10 days Ago)
  const groupConversations = () => {
    const today: Conversation[] = [];
    const yesterday: Conversation[] = [];
    const older: Conversation[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;

    conversations.forEach((conv) => {
      if (conv.updatedAt >= todayStart) {
        today.push(conv);
      } else if (conv.updatedAt >= yesterdayStart) {
        yesterday.push(conv);
      } else {
        older.push(conv);
      }
    });

    return { today, yesterday, older };
  };

  const groups = groupConversations();

  const renderGroup = (title: string, items: Conversation[]) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-4">
        <div className="px-3 py-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
          {title}
        </div>
        <div className="space-y-0.5">
          {items.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isEditing = conv.id === editingId;

            return (
              <div
                key={conv.id}
                id={`sidebar-item-${conv.id}`}
                onClick={() => {
                  if (!isEditing) {
                    onSelectConversation(conv.id);
                    onCloseMobileSidebar();
                  }
                }}
                className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-200/70 dark:bg-white/10 text-slate-900 dark:text-white font-medium'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-white/5'
                }`}
              >
                <div className="min-w-0 flex-1 truncate pr-1">
                  {isEditing ? (
                    <form
                      onSubmit={(e) => handleSaveRename(conv.id, e)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1"
                    >
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                        className="w-full text-xs px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-blue-500 focus:outline-none text-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="submit"
                        className="p-0.5 text-emerald-500 hover:text-emerald-400"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelRename}
                        className="p-0.5 text-slate-400 hover:text-slate-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <span className="block truncate">{conv.title || 'Untitled Summary'}</span>
                  )}
                </div>

                {!isEditing && (
                  <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => startRename(conv, e)}
                      className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/10"
                      title="Rename"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-white/10"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onCloseMobileSidebar}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 lg:hidden"
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-64 bg-slate-50 dark:bg-[#0c0e14] border-r border-slate-200 dark:border-white/5 flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between">
          <div
            onClick={() => {
              onSelectNavTab('home');
              onNewConversation();
              onCloseMobileSidebar();
            }}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
          >
            {/* Javeria Stylized Logo Icon */}
            <div className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-black font-bold text-sm tracking-tighter shadow-sm">
              <span className="font-sans font-black">J</span>
            </div>
            <span className="font-semibold text-base tracking-tight text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
              Javeria
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              onNewConversation();
              onCloseMobileSidebar();
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5 transition-colors"
            title="New Summary (⌘K)"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search Chats Input */}
        <div className="px-4 pb-3">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
            <input
              id="input-sidebar-search"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search chats"
              className="w-full text-xs pl-9 pr-8 py-2 rounded-xl bg-slate-200/50 dark:bg-white/5 border border-transparent dark:border-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
            <div className="absolute right-2.5 flex items-center justify-center w-5 h-5 rounded bg-slate-300/50 dark:bg-white/10 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              ⌘
            </div>
          </div>
        </div>

        {/* Primary Navigation Items (Exact match with reference image) */}
        <div className="px-3 py-1 space-y-0.5">
          <button
            type="button"
            onClick={() => {
              onSelectNavTab('home');
              onNewConversation();
              onCloseMobileSidebar();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              activeNavTab === 'home'
                ? 'bg-slate-200/80 dark:bg-white/10 text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectNavTab('templates');
              onCloseMobileSidebar();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              activeNavTab === 'templates'
                ? 'bg-slate-200/80 dark:bg-white/10 text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Templates</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectNavTab('explore');
              onCloseMobileSidebar();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              activeNavTab === 'explore'
                ? 'bg-slate-200/80 dark:bg-white/10 text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Explore</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectNavTab('history');
              onCloseMobileSidebar();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              activeNavTab === 'history'
                ? 'bg-slate-200/80 dark:bg-white/10 text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <HistoryIcon className="w-4 h-4" />
            <span>History</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenSettings('model');
              onCloseMobileSidebar();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <Wallet className="w-4 h-4" />
            <span>Engine & Limits</span>
          </button>
        </div>

        {/* Separator */}
        <div className="my-2 border-t border-slate-200 dark:border-white/5 mx-3" />

        {/* Conversation History List */}
        <div className="flex-1 overflow-y-auto px-3 scrollbar-thin">
          {conversations.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
              <MessageSquare className="w-5 h-5 mx-auto mb-2 opacity-40" />
              <span>No chats yet</span>
            </div>
          ) : (
            <>
              {renderGroup('Today', groups.today)}
              {renderGroup('Yesterday', groups.yesterday)}
              {renderGroup('10 days Ago', groups.older)}
            </>
          )}
        </div>

        {/* Clear History Confirmation if shown */}
        {showClearConfirm && (
          <div className="p-3 mx-3 mb-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-xs">
            <p className="text-rose-800 dark:text-rose-200 mb-2 font-medium">
              Clear all saved chats?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onClearAllHistory();
                  setShowClearConfirm(false);
                }}
                className="flex-1 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-[11px]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Bottom User Profile Section (Dynamic with Authentication) */}
        <div className="p-3 border-t border-slate-200 dark:border-white/5 relative">
          {currentUser ? (
            <div
              id="sidebar-user-profile"
              onClick={() => setShowProfileMenu((prev) => !prev)}
              className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-200/60 dark:hover:bg-white/5 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Circular Avatar with Portrait */}
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 ring-1 ring-white/20 relative">
                  {(isOwner(currentUser) ? (currentUser.avatarUrl || avatarSrc) : currentUser.avatarUrl) ? (
                    <img
                      src={isOwner(currentUser) ? (currentUser.avatarUrl || avatarSrc) : currentUser.avatarUrl}
                      alt={currentUser.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-top"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span>{currentUser.name.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 truncate">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                    <span>{currentUser.name}</span>
                    {currentUser.isEmailVerified && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" title="Verified Account" />
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono">
                    {currentUser.email}
                  </div>
                </div>
              </div>

              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  showProfileMenu ? 'rotate-180' : ''
                }`}
              />
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 space-y-2">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                    Guest Account
                  </span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-400 font-medium">
                  Free
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight px-0.5">
                Log in or register with your email to keep your summaries and history saved.
              </p>
              <div className="space-y-1.5 pt-0.5">
                <button
                  type="button"
                  id="sidebar-signin-btn"
                  onClick={() => onOpenAuth('login')}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  id="sidebar-register-btn"
                  onClick={() => onOpenAuth('register')}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 text-xs font-medium transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Register with Email</span>
                </button>
              </div>
            </div>
          )}

          {/* Profile Dropdown Menu */}
          {showProfileMenu && currentUser && (
            <div className="absolute bottom-16 left-3 right-3 p-1.5 rounded-2xl bg-white dark:bg-[#181c26] border border-slate-200 dark:border-white/10 shadow-xl z-50 text-xs animate-in fade-in slide-in-from-bottom-2 space-y-1">
              {/* Account summary inside dropdown */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 mb-1">
                <div className="font-semibold text-slate-900 dark:text-white truncate">
                  {currentUser.name}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                  {currentUser.email}
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium">
                    {currentUser.plan} Plan
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                </div>
              </div>

              {/* Switch Account */}
              <button
                type="button"
                onClick={() => {
                  onOpenAuth('login');
                  setShowProfileMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200"
              >
                <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                <span>Switch Account</span>
              </button>

              {/* Create New Account */}
              <button
                type="button"
                onClick={() => {
                  onOpenAuth('register');
                  setShowProfileMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span>Register New User</span>
              </button>

              <div className="my-1 border-t border-slate-100 dark:border-white/5" />

              <button
                type="button"
                onClick={() => {
                  onToggleTheme();
                  setShowProfileMenu(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200"
              >
                <span className="flex items-center gap-2">
                  {isDark ? (
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-slate-600" />
                  )}
                  <span>Toggle Theme</span>
                </span>
                <span className="text-[10px] text-slate-400 uppercase font-mono">
                  {theme}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenSettings();
                  setShowProfileMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200"
              >
                <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>Settings</span>
              </button>

              {conversations.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowClearConfirm(true);
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-rose-500/10 text-rose-600 dark:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All History</span>
                </button>
              )}

              <div className="my-1 border-t border-slate-100 dark:border-white/5" />

              {/* Sign Out Button */}
              <button
                type="button"
                onClick={() => {
                  logout();
                  setShowProfileMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
