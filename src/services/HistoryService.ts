import { Conversation } from '../types';

const DB_NAME = 'LocalSummarizeAI_DB';
const DB_VERSION = 1;
const STORE_NAME = 'conversations';
const EVENT_HISTORY_UPDATED = 'javeria-history-updated';

export class HistoryService {
  private static instance: HistoryService;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryFallback: Map<string, Conversation> = new Map();

  public static getInstance(): HistoryService {
    if (!HistoryService.instance) {
      HistoryService.instance = new HistoryService();
    }
    return HistoryService.instance;
  }

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    if (typeof window === 'undefined' || !window.indexedDB) {
      return Promise.reject(new Error('IndexedDB not supported in this environment'));
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('title', 'title', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  private getLocalStorageKey(cleanEmail: string): string {
    return `javeria_user_history_${cleanEmail}`;
  }

  private readLocalBackup(cleanEmail: string): Conversation[] {
    try {
      const raw = localStorage.getItem(this.getLocalStorageKey(cleanEmail));
      if (raw) {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {}
    return [];
  }

  private writeLocalBackup(cleanEmail: string, items: Conversation[]): void {
    try {
      localStorage.setItem(this.getLocalStorageKey(cleanEmail), JSON.stringify(items));
    } catch {}
  }

  /**
   * Fetch all conversations for a specific user email (or guest).
   * Ensures dual-persistence across IndexedDB, localStorage, and server backend.
   */
  public async getAllConversations(userEmail?: string | null): Promise<Conversation[]> {
    const cleanEmail = (userEmail || '').trim().toLowerCase();

    // 1. Get raw items from IndexedDB
    let allFromDB: Conversation[] = [];
    try {
      const db = await this.openDB();
      allFromDB = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('updatedAt');
        const request = index.openCursor(null, 'prev');
        const results: Conversation[] = [];

        request.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch {
      allFromDB = Array.from(this.memoryFallback.values()).sort(
        (a, b) => b.updatedAt - a.updatedAt
      );
    }

    // 2. Filter by userEmail
    const conversationMap = new Map<string, Conversation>();

    if (cleanEmail) {
      // IndexedDB items matching this user (or legacy unassigned assigned to Javeria)
      for (const item of allFromDB) {
        const itemEmail = (item.userEmail || '').trim().toLowerCase();
        if (itemEmail === cleanEmail) {
          conversationMap.set(item.id, item);
        } else if (!itemEmail && cleanEmail === 'javeriamaqsood829@gmail.com') {
          item.userEmail = cleanEmail;
          conversationMap.set(item.id, item);
          this.saveConversation(item, cleanEmail).catch(() => {});
        }
      }

      // LocalStorage backup items
      const localBackup = this.readLocalBackup(cleanEmail);
      for (const item of localBackup) {
        if (!conversationMap.has(item.id)) {
          conversationMap.set(item.id, item);
          // Sync into IndexedDB
          this.openDB().then((db) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(item);
          }).catch(() => {});
        }
      }

      // 3. Server backend sync (async background pull to ensure cloud persistence)
      this.syncFromServer(cleanEmail).catch(() => {});
    } else {
      // Guest items
      for (const item of allFromDB) {
        const itemEmail = (item.userEmail || '').trim().toLowerCase();
        if (!itemEmail || itemEmail === 'guest') {
          conversationMap.set(item.id, item);
        }
      }
    }

    const merged = Array.from(conversationMap.values()).sort(
      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
    );

    if (cleanEmail) {
      this.writeLocalBackup(cleanEmail, merged);
    }

    return merged;
  }

  /**
   * Sync from server /api/history for authenticated user
   */
  public async syncFromServer(cleanEmail: string): Promise<Conversation[]> {
    if (!cleanEmail) return [];
    try {
      const res = await fetch(`/api/history?email=${encodeURIComponent(cleanEmail)}`);
      if (!res.ok) return [];
      const data = await res.json();
      if (data && data.success && Array.isArray(data.conversations)) {
        const serverList: Conversation[] = data.conversations;
        if (serverList.length === 0) return [];

        // Save server conversations into IndexedDB and localStorage
        const db = await this.openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const conv of serverList) {
          conv.userEmail = cleanEmail;
          store.put(conv);
        }

        const currentLocal = this.readLocalBackup(cleanEmail);
        const map = new Map<string, Conversation>();
        for (const c of currentLocal) map.set(c.id, c);
        let hasNew = false;
        for (const c of serverList) {
          if (!map.has(c.id)) {
            hasNew = true;
          }
          map.set(c.id, c);
        }

        const updated = Array.from(map.values()).sort(
          (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
        );
        this.writeLocalBackup(cleanEmail, updated);

        if (hasNew) {
          window.dispatchEvent(new CustomEvent(EVENT_HISTORY_UPDATED, { detail: { email: cleanEmail } }));
        }
        return updated;
      }
    } catch (err) {
      // Ignore network errors in offline/airgapped environments
    }
    return [];
  }

  public async getConversation(id: string): Promise<Conversation | null> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return this.memoryFallback.get(id) || null;
    }
  }

  /**
   * Save conversation with userEmail attachment
   */
  public async saveConversation(conversation: Conversation, userEmail?: string | null): Promise<void> {
    conversation.updatedAt = Date.now();
    const cleanEmail = (userEmail || conversation.userEmail || '').trim().toLowerCase();
    if (cleanEmail) {
      conversation.userEmail = cleanEmail;
    } else {
      conversation.userEmail = 'guest';
    }

    this.memoryFallback.set(conversation.id, conversation);

    // Save to IndexedDB
    try {
      const db = await this.openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(conversation);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Saved to in-memory fallback, IndexedDB unavailable:', err);
    }

    // If user is authenticated, also save to localStorage and server API
    if (cleanEmail && cleanEmail !== 'guest') {
      const backup = this.readLocalBackup(cleanEmail);
      const idx = backup.findIndex((c) => c.id === conversation.id);
      if (idx >= 0) {
        backup[idx] = conversation;
      } else {
        backup.unshift(conversation);
      }
      backup.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      this.writeLocalBackup(cleanEmail, backup);

      // Server persistence (fire and forget)
      fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, conversation }),
      }).catch(() => {});
    }
  }

  /**
   * Automatically claim any unassigned/guest conversations when a user logs in
   */
  public async claimGuestConversations(userEmail: string): Promise<void> {
    const cleanEmail = userEmail.trim().toLowerCase();
    if (!cleanEmail) return;

    try {
      const db = await this.openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();

      request.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const item: Conversation = cursor.value;
          if (!item.userEmail || item.userEmail === 'guest') {
            item.userEmail = cleanEmail;
            cursor.update(item);
            this.saveConversation(item, cleanEmail).catch(() => {});
          }
          cursor.continue();
        }
      };
    } catch {}
  }

  /**
   * Delete single conversation
   */
  public async deleteConversation(id: string, userEmail?: string | null): Promise<void> {
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    this.memoryFallback.delete(id);

    try {
      const db = await this.openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Deleted from in-memory fallback');
    }

    if (cleanEmail && cleanEmail !== 'guest') {
      const backup = this.readLocalBackup(cleanEmail).filter((c) => c.id !== id);
      this.writeLocalBackup(cleanEmail, backup);

      fetch(`/api/history?email=${encodeURIComponent(cleanEmail)}&id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
  }

  /**
   * Clear all conversations for the specific user (does not wipe other users' data)
   */
  public async clearAllConversations(userEmail?: string | null): Promise<void> {
    const cleanEmail = (userEmail || '').trim().toLowerCase();

    try {
      const db = await this.openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();

      request.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const item: Conversation = cursor.value;
          const itemEmail = (item.userEmail || '').trim().toLowerCase();
          if (cleanEmail) {
            if (itemEmail === cleanEmail) {
              cursor.delete();
            }
          } else {
            if (!itemEmail || itemEmail === 'guest') {
              cursor.delete();
            }
          }
          cursor.continue();
        }
      };
    } catch (err) {
      console.warn('Cleared in-memory fallback');
    }

    if (cleanEmail && cleanEmail !== 'guest') {
      this.writeLocalBackup(cleanEmail, []);
      fetch(`/api/history?email=${encodeURIComponent(cleanEmail)}&all=true`, {
        method: 'DELETE',
      }).catch(() => {});
    }
  }

  public async searchConversations(query: string, userEmail?: string | null): Promise<Conversation[]> {
    const all = await this.getAllConversations(userEmail);
    if (!query || query.trim().length === 0) return all;

    const lower = query.toLowerCase().trim();
    return all.filter((conv) => {
      if (conv.title.toLowerCase().includes(lower)) return true;
      if (conv.currentSummary && conv.currentSummary.toLowerCase().includes(lower)) return true;
      if (conv.originalText && conv.originalText.toLowerCase().includes(lower)) return true;
      return false;
    });
  }

  public async getStorageEstimate(userEmail?: string | null): Promise<{ count: number; estimatedBytes: number }> {
    const all = await this.getAllConversations(userEmail);
    const count = all.length;
    let estimatedBytes = 0;
    try {
      const str = JSON.stringify(all);
      estimatedBytes = new Blob([str]).size;
    } catch {
      estimatedBytes = count * 25000;
    }
    return { count, estimatedBytes };
  }
}

export const historyService = HistoryService.getInstance();
