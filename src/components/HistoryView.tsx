import React, { useState, useMemo } from 'react';
import {
  History as HistoryIcon,
  Search,
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  MessageSquare,
  FileText,
  Sparkles,
  Calendar,
  Clock,
  ExternalLink,
  ChevronRight,
  Filter,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { Conversation } from '../types';
import { formatNumber } from '../utils/formatting';

interface HistoryViewProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  currentUserEmail?: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  onClearAllHistory: () => void;
  onBackToChat: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  conversations,
  activeConversationId,
  currentUserEmail,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  onClearAllHistory,
  onBackToChat,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'summary' | 'chat'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Filter & Search
  const filteredConversations = useMemo(() => {
    let result = [...conversations];

    // Filter by type
    if (filterType === 'summary') {
      result = result.filter((c) => Boolean(c.currentSummary));
    } else if (filterType === 'chat') {
      result = result.filter((c) => !c.currentSummary);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((c) => {
        const titleMatch = (c.title || '').toLowerCase().includes(q);
        const originalMatch = (c.originalText || '').toLowerCase().includes(q);
        const summaryMatch = (c.currentSummary || '').toLowerCase().includes(q);
        const messagesMatch = (c.messages || []).some((m) =>
          (m.content || '').toLowerCase().includes(q)
        );
        return titleMatch || originalMatch || summaryMatch || messagesMatch;
      });
    }

    // Sort
    result.sort((a, b) => {
      const timeA = a.updatedAt || a.createdAt || 0;
      const timeB = b.updatedAt || b.createdAt || 0;
      return sortBy === 'newest' ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [conversations, filterType, searchQuery, sortBy]);

  // Group by date
  const groupedConversations = useMemo(() => {
    const today: Conversation[] = [];
    const yesterday: Conversation[] = [];
    const thisWeek: Conversation[] = [];
    const older: Conversation[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - 86400000 * 7;

    for (const conv of filteredConversations) {
      const time = conv.updatedAt || conv.createdAt || 0;
      if (time >= todayStart) {
        today.push(conv);
      } else if (time >= yesterdayStart) {
        yesterday.push(conv);
      } else if (time >= weekStart) {
        thisWeek.push(conv);
      } else {
        older.push(conv);
      }
    }

    return [
      { label: 'Today', items: today },
      { label: 'Yesterday', items: yesterday },
      { label: 'Previous 7 Days', items: thisWeek },
      { label: 'Older History', items: older },
    ].filter((g) => g.items.length > 0);
  }, [filteredConversations]);

  const summaryCount = useMemo(
    () => conversations.filter((c) => Boolean(c.currentSummary)).length,
    [conversations]
  );
  const chatCount = useMemo(
    () => conversations.filter((c) => !c.currentSummary).length,
    [conversations]
  );

  const startRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title || 'Untitled Session');
  };

  const saveRename = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return 'Unknown date';
    const date = new Date(ts);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSnippet = (conv: Conversation) => {
    if (conv.currentSummary) {
      return conv.currentSummary.slice(0, 180).replace(/[#*`_]/g, '');
    }
    if (conv.messages && conv.messages.length > 0) {
      const firstUserMsg = conv.messages.find((m) => m.role === 'user');
      const firstAsstMsg = conv.messages.find((m) => m.role === 'assistant');
      if (firstUserMsg && firstAsstMsg) {
        return `Q: ${firstUserMsg.content.slice(0, 80)}... — A: ${firstAsstMsg.content.slice(0, 100).replace(/[#*`_]/g, '')}`;
      }
      return conv.messages[0].content.slice(0, 160);
    }
    if (conv.originalText) {
      return conv.originalText.slice(0, 160);
    }
    return 'No additional details available';
  };

  return (
    <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 sm:px-8 py-6 sm:py-10 animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-white/5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToChat}
            className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shadow-xs cursor-pointer group"
            title="Back to Active Chat"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <HistoryIcon className="w-4 h-4" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Conversation History
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-medium">
                {conversations.length} {conversations.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Click any past session to reopen and continue your chat or review its summary
            </p>
            {currentUserEmail && (
              <div className="flex items-center gap-1.5 mt-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Protected & Synced to: <strong className="font-semibold">{currentUserEmail}</strong> (Persistent across login/logout)</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => {
              onNewConversation();
              onBackToChat();
            }}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>

          {conversations.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-medium cursor-pointer transition-colors"
              title="Clear all saved history"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="my-4 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-600/10 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-rose-900 dark:text-rose-200">
                Are you sure you want to clear all history?
              </h4>
              <p className="text-xs text-rose-700/80 dark:text-rose-300/80 mt-0.5">
                This will permanently delete all {conversations.length} saved chats and summaries from this browser.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 text-xs font-medium hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onClearAllHistory();
                setShowClearConfirm(false);
              }}
              className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            >
              Yes, Clear Everything
            </button>
          </div>
        </div>
      )}

      {/* Search Bar & Filter Tabs */}
      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by topic, questions, or text..."
            className="w-full pl-10 pr-9 py-2 rounded-xl bg-white dark:bg-[#121620] border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-white dark:bg-[#121620] p-1 rounded-xl border border-slate-200 dark:border-white/10 shadow-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              filterType === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All ({conversations.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('summary')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              filterType === 'summary'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Summaries ({summaryCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              filterType === 'chat'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-3 h-3" />
            <span>Q&A Chats ({chatCount})</span>
          </button>
        </div>
      </div>

      {/* History List or Empty State */}
      <div className="mt-8 space-y-8 flex-1">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-3xl bg-white dark:bg-[#121620] border border-slate-200 dark:border-white/5 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-sm">
              <HistoryIcon className="w-7 h-7 opacity-75" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {searchQuery.trim() ? 'No matching conversations' : 'No history yet'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {searchQuery.trim()
                  ? `No past sessions matched "${searchQuery}". Try a different keyword.`
                  : 'Your past document summaries and Q&A conversations will appear here automatically.'}
              </p>
            </div>
            {searchQuery.trim() ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors"
              >
                Clear Search
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onNewConversation();
                  onBackToChat();
                }}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                Start a Conversation
              </button>
            )}
          </div>
        ) : (
          groupedConversations.map((group) => (
            <div key={group.label} className="space-y-3">
              {/* Group Header */}
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span>{group.label}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                  ({group.items.length})
                </span>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 gap-3">
                {group.items.map((conv) => {
                  const isActive = conv.id === activeConversationId;
                  const isEditing = conv.id === editingId;
                  const hasSummary = Boolean(conv.currentSummary);
                  const totalWords =
                    (conv.originalText || '').split(/\s+/).filter(Boolean).length ||
                    (conv.currentSummary || '').split(/\s+/).filter(Boolean).length;
                  const messageCount = conv.messages?.length || 0;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        if (!isEditing) {
                          onSelectConversation(conv.id);
                        }
                      }}
                      className={`group relative rounded-2xl border p-4 sm:p-5 transition-all duration-150 cursor-pointer shadow-xs hover:shadow-md ${
                        isActive
                          ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-300 dark:border-blue-500/40 ring-1 ring-blue-500/20'
                          : 'bg-white dark:bg-[#121620] border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: Type Icon + Title + Snippet */}
                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${
                              hasSummary
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            }`}
                          >
                            {hasSummary ? (
                              <Sparkles className="w-4 h-4" />
                            ) : (
                              <MessageSquare className="w-4 h-4" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1 space-y-1.5">
                            {/* Title & Badge */}
                            <div className="flex flex-wrap items-center gap-2">
                              {isEditing ? (
                                <form
                                  onSubmit={(e) => saveRename(conv.id, e)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1.5 flex-1 max-w-md"
                                >
                                  <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    autoFocus
                                    className="w-full text-sm font-semibold px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-blue-500 text-slate-900 dark:text-white focus:outline-none"
                                  />
                                  <button
                                    type="submit"
                                    className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                    title="Save Title"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelRename}
                                    className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </form>
                              ) : (
                                <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white truncate">
                                  {conv.title || 'Untitled Session'}
                                </h3>
                              )}

                              {/* Badges */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                    hasSummary
                                      ? 'bg-amber-100/80 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300/40 dark:border-amber-800/40'
                                      : 'bg-blue-100/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300/40 dark:border-blue-800/40'
                                  }`}
                                >
                                  {hasSummary ? 'Document Summary' : 'Q&A Chat'}
                                </span>

                                {conv.fileName && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 font-mono truncate max-w-[120px]">
                                    📎 {conv.fileName}
                                  </span>
                                )}

                                {isActive && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    Active
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Snippet Preview */}
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                              {getSnippet(conv)}
                            </p>

                            {/* Footer Metadata */}
                            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 dark:text-slate-500">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTimestamp(conv.updatedAt || conv.createdAt)}
                              </span>
                              <span>•</span>
                              <span>
                                {messageCount} {messageCount === 1 ? 'message' : 'messages'}
                              </span>
                              {totalWords > 0 && (
                                <>
                                  <span>•</span>
                                  <span>~{formatNumber(totalWords)} words</span>
                                </>
                              )}
                              {conv.settings?.mode && (
                                <>
                                  <span>•</span>
                                  <span className="capitalize">{conv.settings.mode.replace('_', ' ')}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Actions: Open button, Rename, Delete */}
                        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                          {!isEditing && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => startRename(conv, e)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors opacity-70 group-hover:opacity-100 cursor-pointer"
                                title="Rename Session"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteConversation(conv.id);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors opacity-70 group-hover:opacity-100 cursor-pointer"
                                title="Delete from History"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => onSelectConversation(conv.id)}
                            className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-300 text-xs font-medium transition-all group-hover:bg-blue-600 group-hover:text-white cursor-pointer ml-1"
                          >
                            <span>Open</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
