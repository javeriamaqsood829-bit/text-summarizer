import { Conversation } from '../types';

const DB_NAME = 'LocalSummarizeAI_DB';
const DB_VERSION = 1;
const STORE_NAME = 'conversations';

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

  public async getAllConversations(): Promise<Conversation[]> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('updatedAt');
        const request = index.openCursor(null, 'prev'); // Most recent first
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
    } catch (err) {
      // Memory fallback
      return Array.from(this.memoryFallback.values()).sort(
        (a, b) => b.updatedAt - a.updatedAt
      );
    }
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

  public async saveConversation(conversation: Conversation): Promise<void> {
    conversation.updatedAt = Date.now();
    this.memoryFallback.set(conversation.id, conversation);

    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(conversation);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Saved to in-memory fallback, IndexedDB unavailable:', err);
    }
  }

  public async deleteConversation(id: string): Promise<void> {
    this.memoryFallback.delete(id);
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Deleted from in-memory fallback');
    }
  }

  public async clearAllConversations(): Promise<void> {
    this.memoryFallback.clear();
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Cleared in-memory fallback');
    }
  }

  public async searchConversations(query: string): Promise<Conversation[]> {
    const all = await this.getAllConversations();
    if (!query || query.trim().length === 0) return all;

    const lower = query.toLowerCase().trim();
    return all.filter((conv) => {
      if (conv.title.toLowerCase().includes(lower)) return true;
      if (conv.currentSummary && conv.currentSummary.toLowerCase().includes(lower)) return true;
      if (conv.originalText && conv.originalText.toLowerCase().includes(lower)) return true;
      return false;
    });
  }

  public async getStorageEstimate(): Promise<{ count: number; estimatedBytes: number }> {
    const all = await this.getAllConversations();
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
