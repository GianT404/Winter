import { Message } from '../types';

interface MessageCacheEntry {
  messages: Message[];
  cursors: {
    next?: string;
    previous?: string;
  };
  hasMoreOlder: boolean;
  hasMoreNewer: boolean;
  lastUpdated: number;
}

interface MessageCache {
  [conversationId: string]: MessageCacheEntry;
}

class MessageCacheService {
  private cache: MessageCache = {};
  private readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 20; // Max conversations to cache
  private readonly SESSION_KEY = 'message_cache_session'; // Track page reloads

  constructor() {
    // ENHANCED: Detect page reload and clear potentially duplicate cache
    this.handlePageReload();
  }

  /**
   * Handle page reload detection and cache cleanup
   */
  private handlePageReload(): void {
    const currentSession = Date.now().toString();
    const lastSession = sessionStorage.getItem(this.SESSION_KEY);
    
    if (lastSession) {
      // Page was reloaded, clear cache to prevent duplicates
      console.log('Page reload detected, clearing message cache to prevent duplicates');
      this.cache = {};
    }
    
    // Set current session
    sessionStorage.setItem(this.SESSION_KEY, currentSession);
  }

  /**
   * Get cached messages for a conversation
   */
  getMessages(conversationId: string): MessageCacheEntry | null {
    const entry = this.cache[conversationId];
    if (!entry) return null;

    // Check if cache is expired
    if (Date.now() - entry.lastUpdated > this.CACHE_EXPIRY) {
      delete this.cache[conversationId];
      return null;
    }

    return entry;
  }

  /**
   * Set messages for a conversation
   */
  setMessages(conversationId: string, messages: Message[], options: {
    nextCursor?: string;
    previousCursor?: string;
    hasMoreOlder?: boolean;
    hasMoreNewer?: boolean;
    replace?: boolean;
  } = {}): void {
    const existing = this.cache[conversationId];
    
    if (options.replace || !existing) {
      // Replace or create new entry
      this.cache[conversationId] = {
        messages: [...messages],
        cursors: {
          next: options.nextCursor,
          previous: options.previousCursor
        },
        hasMoreOlder: options.hasMoreOlder ?? true,
        hasMoreNewer: options.hasMoreNewer ?? false,
        lastUpdated: Date.now()
      };
    } else {
      // Merge messages
      const mergedMessages = this.mergeMessages(existing.messages, messages);
      this.cache[conversationId] = {
        ...existing,
        messages: mergedMessages,
        cursors: {
          next: options.nextCursor ?? existing.cursors.next,
          previous: options.previousCursor ?? existing.cursors.previous
        },
        hasMoreOlder: options.hasMoreOlder ?? existing.hasMoreOlder,
        hasMoreNewer: options.hasMoreNewer ?? existing.hasMoreNewer,
        lastUpdated: Date.now()
      };
    }

    // Limit cache size
    this.limitCacheSize();
  }
  /**
   * Add a new real-time message to cache - ENHANCED DUPLICATE PREVENTION
   */
  addRealtimeMessage(conversationId: string, message: Message): void {
    const entry = this.cache[conversationId];
    if (!entry) return;

    // Enhanced duplicate check: by ID and by content+timestamp
    const existsById = entry.messages.some(m => m.id === message.id);
    if (existsById) {
      console.log('Cache: Duplicate message detected by ID:', message.id);
      return;
    }

    // Additional check for recently sent messages (within 5 seconds)
    const now = new Date().getTime();
    const messageTime = new Date(message.timestamp).getTime();
    const recentSimilar = entry.messages.find(m => {
      const existingTime = new Date(m.timestamp).getTime();
      return (
        m.content === message.content &&
        m.senderId === message.senderId &&
        Math.abs(existingTime - messageTime) < 5000 && // Within 5 seconds
        Math.abs(now - existingTime) < 10000 // Message was sent within last 10 seconds
      );
    });

    if (recentSimilar) {
      console.log('Cache: Duplicate message detected by content+time:', message.content.substring(0, 50));
      return;
    }

    // Add to the beginning (latest messages first)
    entry.messages.unshift(message);
    entry.lastUpdated = Date.now();

    // Limit message count per conversation (keep latest 200)
    if (entry.messages.length > 200) {
      entry.messages = entry.messages.slice(0, 200);
      entry.hasMoreOlder = true;
    }
  }

  /**
   * Update message in cache (for read status, etc.)
   */
  updateMessage(conversationId: string, messageId: string, updates: Partial<Message>): void {
    const entry = this.cache[conversationId];
    if (!entry) return;

    const messageIndex = entry.messages.findIndex(m => m.id === messageId);
    if (messageIndex !== -1) {
      entry.messages[messageIndex] = { ...entry.messages[messageIndex], ...updates };
      entry.lastUpdated = Date.now();
    }
  }

  /**
   * Remove message from cache
   */
  removeMessage(conversationId: string, messageId: string): void {
    const entry = this.cache[conversationId];
    if (!entry) return;

    entry.messages = entry.messages.filter(m => m.id !== messageId);
    entry.lastUpdated = Date.now();
  }

  /**
   * Clear cache for a conversation
   */
  clearConversation(conversationId: string): void {
    delete this.cache[conversationId];
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    this.cache = {};
  }

  /**
   * Get cache statistics
   */
  getStats(): { totalConversations: number; totalMessages: number } {
    const conversationIds = Object.keys(this.cache);
    const totalMessages = conversationIds.reduce(
      (sum, id) => sum + this.cache[id].messages.length, 
      0
    );
    
    return {
      totalConversations: conversationIds.length,
      totalMessages
    };
  }
  private mergeMessages(existing: Message[], newMessages: Message[]): Message[] {
    const messageMap = new Map<string, Message>();
    
    // Add existing messages
    existing.forEach(msg => messageMap.set(msg.id, msg));
    
    // Add/update with new messages - ENHANCED DUPLICATE PREVENTION
    newMessages.forEach(msg => {
      const existingMsg = messageMap.get(msg.id);
      if (existingMsg) {
        // Check for potential duplicate by content + timestamp
        const existingTime = new Date(existingMsg.timestamp || existingMsg.sentAt).getTime();
        const newTime = new Date(msg.timestamp || msg.sentAt).getTime();
        
        if (existingMsg.content === msg.content && 
            existingMsg.senderId === msg.senderId &&
            Math.abs(existingTime - newTime) < 5000) {
          console.log('Merge: Skipping duplicate message:', msg.content.substring(0, 50));
          return; // Skip duplicate
        }
      }
      messageMap.set(msg.id, msg);
    });
    
    // Convert back to array and sort by timestamp (newest first)
    // Use timestamp field consistently with the rest of the app
    return Array.from(messageMap.values())
      .sort((a, b) => new Date(b.timestamp || b.sentAt).getTime() - new Date(a.timestamp || a.sentAt).getTime());
  }

  private limitCacheSize(): void {
    const conversationIds = Object.keys(this.cache);
    if (conversationIds.length <= this.MAX_CACHE_SIZE) return;

    // Remove oldest entries (by lastUpdated)
    const sortedEntries = conversationIds
      .map(id => ({ id, lastUpdated: this.cache[id].lastUpdated }))
      .sort((a, b) => a.lastUpdated - b.lastUpdated);

    const toRemove = sortedEntries.slice(0, conversationIds.length - this.MAX_CACHE_SIZE);
    toRemove.forEach(entry => delete this.cache[entry.id]);
  }
}

// Singleton instance
export const messageCacheService = new MessageCacheService();
export default MessageCacheService;
