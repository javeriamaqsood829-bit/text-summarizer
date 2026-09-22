import { useState, useEffect, useCallback, useRef } from 'react';
import { Conversation, Message, SummarySettings } from '../types';
import { historyService } from '../services/HistoryService';

export function useHistory(userEmail?: string | null) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const emailRef = useRef<string | null | undefined>(userEmail);

  emailRef.current = userEmail;

  const loadConversations = useCallback(async (targetEmail?: string | null) => {
    setIsLoading(true);
    const emailToUse = targetEmail !== undefined ? targetEmail : emailRef.current;
    try {
      if (emailToUse) {
        // Claim any guest sessions so newly logged-in users keep their work
        await historyService.claimGuestConversations(emailToUse);
      }
      const items = await historyService.getAllConversations(emailToUse);
      setConversations(items);
      
      // If no active conversation or current active is not in the list, choose the first
      setActiveConversationId((currentId) => {
        if (currentId && items.some((item) => item.id === currentId)) {
          return currentId;
        }
        return items.length > 0 ? items[0].id : null;
      });
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reload when user logs in, logs out, or switches accounts
  useEffect(() => {
    loadConversations(userEmail);
  }, [userEmail, loadConversations]);

  // Listen to background server sync updates
  useEffect(() => {
    const handleHistoryUpdated = (e: any) => {
      const eventEmail = e?.detail?.email;
      const currentClean = (emailRef.current || '').trim().toLowerCase();
      if (!eventEmail || eventEmail === currentClean) {
        loadConversations(emailRef.current);
      }
    };
    window.addEventListener('javeria-history-updated', handleHistoryUpdated);
    return () => {
      window.removeEventListener('javeria-history-updated', handleHistoryUpdated);
    };
  }, [loadConversations]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  const createNewConversation = useCallback(
    (defaultSettings: SummarySettings, initialText: string = '', title: string = 'New Summary'): Conversation => {
      const currentEmail = (emailRef.current || '').trim().toLowerCase();
      const newConv: Conversation = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        originalText: initialText,
        currentSummary: '',
        currentParagraph: '',
        userEmail: currentEmail || 'guest',
        settings: { ...defaultSettings },
        modelInformation: {
          name: 'Distil-BART-Edge / Local Hybrid',
          runtime: 'Local Engine (Optimized)',
        },
      };

      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      historyService.saveConversation(newConv, currentEmail);
      return newConv;
    },
    []
  );

  const saveActiveConversation = useCallback(async (conv: Conversation) => {
    const currentEmail = (emailRef.current || '').trim().toLowerCase();
    if (currentEmail) {
      conv.userEmail = currentEmail;
    }
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === conv.id);
      if (idx === -1) return [conv, ...prev];
      const updated = [...prev];
      updated[idx] = conv;
      return updated.sort((a, b) => b.updatedAt - a.updatedAt);
    });
    await historyService.saveConversation(conv, currentEmail);
  }, []);

  const renameConversation = useCallback(async (id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const currentEmail = (emailRef.current || '').trim().toLowerCase();
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const updated = { ...c, title: trimmed, updatedAt: Date.now() };
          historyService.saveConversation(updated, currentEmail);
          return updated;
        }
        return c;
      })
    );
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      const currentEmail = (emailRef.current || '').trim().toLowerCase();
      await historyService.deleteConversation(id, currentEmail);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setActiveConversationId((curr) => (curr === id ? null : curr));
    },
    []
  );

  const clearAllHistory = useCallback(async () => {
    const currentEmail = (emailRef.current || '').trim().toLowerCase();
    await historyService.clearAllConversations(currentEmail);
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
    refreshHistory: () => loadConversations(emailRef.current),
  };
}
