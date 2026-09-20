import { useState, useEffect, useCallback } from 'react';
import { Conversation, Message, SummarySettings } from '../types';
import { historyService } from '../services/HistoryService';

export function useHistory() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await historyService.getAllConversations();
      setConversations(items);
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  const createNewConversation = useCallback(
    (defaultSettings: SummarySettings, initialText: string = '', title: string = 'New Summary'): Conversation => {
      const newConv: Conversation = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        originalText: initialText,
        currentSummary: '',
        currentParagraph: '',
        settings: { ...defaultSettings },
        modelInformation: {
          name: 'Distil-BART-Edge / Local Hybrid',
          runtime: 'Local Engine (Optimized)',
        },
      };

      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      historyService.saveConversation(newConv);
      return newConv;
    },
    []
  );

  const saveActiveConversation = useCallback(async (conv: Conversation) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === conv.id);
      if (idx === -1) return [conv, ...prev];
      const updated = [...prev];
      updated[idx] = conv;
      return updated.sort((a, b) => b.updatedAt - a.updatedAt);
    });
    await historyService.saveConversation(conv);
  }, []);

  const renameConversation = useCallback(async (id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const updated = { ...c, title: trimmed, updatedAt: Date.now() };
          historyService.saveConversation(updated);
          return updated;
        }
        return c;
      })
    );
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      await historyService.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
      }
    },
    [activeConversationId]
  );

  const clearAllHistory = useCallback(async () => {
    await historyService.clearAllConversations();
    setConversations([]);
    setActiveConversationId(null);
  }, []);

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      (c.currentSummary && c.currentSummary.toLowerCase().includes(q)) ||
      (c.originalText && c.originalText.toLowerCase().includes(q))
    );
  });

  return {
    conversations: filteredConversations,
    allConversationsCount: conversations.length,
    activeConversation,
    activeConversationId,
    setActiveConversationId,
    searchQuery,
    setSearchQuery,
    isLoading,
    createNewConversation,
    saveActiveConversation,
    renameConversation,
    deleteConversation,
    clearAllHistory,
    refreshHistory: loadConversations,
  };
}
