import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, MessagePagination, PaginatedMessageResponse } from '../types';
import { messageService } from '../services/api';
import { messageCacheService } from '../services/messageCacheService';

/**
 * Helper function to remove duplicate messages
 */
function removeDuplicateMessages(messages: Message[]): Message[] {
  const seen = new Map<string, Message>();
  const result: Message[] = [];
  
  for (const message of messages) {
    const existing = seen.get(message.id);
    if (existing) {
      // Check for content+timestamp duplicate
      const existingTime = new Date(existing.timestamp || existing.sentAt).getTime();
      const messageTime = new Date(message.timestamp || message.sentAt).getTime();
      
      if (existing.content === message.content && 
          existing.senderId === message.senderId &&
          Math.abs(existingTime - messageTime) < 5000) {
        console.log('API: Skipping duplicate message:', message.content.substring(0, 50));
        continue; // Skip duplicate
      }
    }
    
    seen.set(message.id, message);
    result.push(message);
  }
  
  return result;
}

interface UseOptimizedMessagesOptions {
  conversationId?: string;
  groupId?: string;
  pageSize?: number;
  autoLoadInitial?: boolean;
}

interface UseOptimizedMessagesReturn {
  messages: Message[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMoreOlder: boolean;
  hasMoreNewer: boolean;
  error: string | null;
  loadInitialMessages: () => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  loadNewerMessages: () => Promise<void>;
  addRealtimeMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  removeMessage: (messageId: string) => void;
  refresh: () => Promise<void>;
  clearMessages: () => void;
}

/**
 * Optimized hook for message loading with caching and pagination
 */
export const useOptimizedMessages = (options: UseOptimizedMessagesOptions): UseOptimizedMessagesReturn => {
  const { conversationId, groupId, pageSize = 12, autoLoadInitial = true } = options; // Giảm xuống 12 tin nhắn
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [hasMoreNewer, setHasMoreNewer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const cursorsRef = useRef<{ next?: string; previous?: string }>({});
  const activeConversationId = conversationId || groupId;
  /**
   * Load initial messages (latest 12 messages) - INSTANT DISPLAY
   */
  const loadInitialMessages = useCallback(async () => {
    if (!activeConversationId) return;

    // INSTANT: Check cache first và hiển thị ngay lập tức
    const cached = messageCacheService.getMessages(activeConversationId);
    if (cached && cached.messages.length > 0) {
      // Hiển thị ngay cache, lấy 12 tin nhắn gần nhất
      const recentMessages = cached.messages.slice(-12);
      setMessages(recentMessages);
      setHasMoreOlder(cached.hasMoreOlder || cached.messages.length >= 12);
      setHasMoreNewer(cached.hasMoreNewer);
      cursorsRef.current = cached.cursors;
        // Background refresh nếu cache cũ (> 30 giây)
      const cacheAge = Date.now() - cached.lastUpdated;
      if (cacheAge > 30000) {
        loadFreshMessages();
      }
      return;
    }

    // Nếu không có cache, load ngay với pageSize=12 để hiển thị nhanh
    await loadFreshMessages();
  }, [activeConversationId, conversationId, groupId, pageSize]);

  /**
   * Load fresh messages từ API (12 tin nhắn gần nhất)
   */
  const loadFreshMessages = useCallback(async () => {
    if (!activeConversationId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const pagination: MessagePagination = {
        pageSize: 12, // Cố định 12 tin nhắn để load nhanh
        useInfiniteScroll: true,
        direction: 'older'
      };

      let response: PaginatedMessageResponse;

      if (conversationId) {
        response = await messageService.getMessagesPaginated(conversationId, pagination);
      } else if (groupId) {
        response = await messageService.getGroupMessagesPaginated(groupId, pagination);
      } else {
        throw new Error('Either conversationId or groupId must be provided');
      }

      const { messages: newMessages, hasNextPage, nextCursor, previousCursor } = response;      // Reverse messages để hiển thị tin nhắn mới nhất ở dưới cùng
      const reversedMessages = [...newMessages].reverse();

      // ENHANCED: Remove duplicates from API response itself
      const uniqueMessages = removeDuplicateMessages(reversedMessages);

      setMessages(uniqueMessages);
      setHasMoreOlder(hasNextPage);
      setHasMoreNewer(false);
      
      cursorsRef.current = {
        next: nextCursor,
        previous: previousCursor
      };

      // Cache với timestamp để biết tuổi của cache
      messageCacheService.setMessages(activeConversationId, uniqueMessages, {
        nextCursor,
        previousCursor,
        hasMoreOlder: hasNextPage,
        hasMoreNewer: false,
        replace: true
      });

    } catch (error: any) {
      console.error('Error loading initial messages:', error);
      setError(error.message || 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [activeConversationId, conversationId, groupId]);

  /**
   * Load older messages (pagination backwards)
   */
  const loadOlderMessages = useCallback(async () => {
    if (!activeConversationId || !hasMoreOlder || isLoadingMore) return;

    setIsLoadingMore(true);
    setError(null);

    try {
      const pagination: MessagePagination = {
        pageSize,
        cursor: cursorsRef.current.next,
        useInfiniteScroll: true,
        direction: 'older'
      };

      let response: PaginatedMessageResponse;

      if (conversationId) {
        response = await messageService.getMessagesPaginated(conversationId, pagination);
      } else if (groupId) {
        response = await messageService.getGroupMessagesPaginated(groupId, pagination);
      } else {
        throw new Error('Either conversationId or groupId must be provided');
      }

      const { messages: newMessages, hasNextPage, nextCursor } = response;

      if (newMessages.length > 0) {
        // Append older messages to the end
        const updatedMessages = [...messages, ...newMessages.reverse()];
        setMessages(updatedMessages);
        
        cursorsRef.current.next = nextCursor;
        
        // Update cache
        messageCacheService.setMessages(activeConversationId, updatedMessages, {
          nextCursor,
          hasMoreOlder: hasNextPage
        });
      }

      setHasMoreOlder(hasNextPage);

    } catch (error: any) {
      console.error('Error loading older messages:', error);
      setError(error.message || 'Failed to load older messages');
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeConversationId, conversationId, groupId, pageSize, hasMoreOlder, isLoadingMore, messages]);

  /**
   * Load newer messages (not typically used, but available)
   */
  const loadNewerMessages = useCallback(async () => {
    if (!activeConversationId || !hasMoreNewer || isLoadingMore) return;

    setIsLoadingMore(true);
    setError(null);

    try {
      const pagination: MessagePagination = {
        pageSize,
        cursor: cursorsRef.current.previous,
        useInfiniteScroll: true,
        direction: 'newer'
      };

      let response: PaginatedMessageResponse;

      if (conversationId) {
        response = await messageService.getMessagesPaginated(conversationId, pagination);
      } else if (groupId) {
        response = await messageService.getGroupMessagesPaginated(groupId, pagination);
      } else {
        throw new Error('Either conversationId or groupId must be provided');
      }

      const { messages: newMessages, hasNextPage, previousCursor } = response;

      if (newMessages.length > 0) {
        // Prepend newer messages to the beginning
        const updatedMessages = [...newMessages.reverse(), ...messages];
        setMessages(updatedMessages);
        
        cursorsRef.current.previous = previousCursor;
        
        // Update cache
        messageCacheService.setMessages(activeConversationId, updatedMessages, {
          previousCursor,
          hasMoreNewer: hasNextPage
        });
      }

      setHasMoreNewer(hasNextPage);

    } catch (error: any) {
      console.error('Error loading newer messages:', error);
      setError(error.message || 'Failed to load newer messages');
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeConversationId, conversationId, groupId, pageSize, hasMoreNewer, isLoadingMore, messages]);
  /**
   * Add real-time message from SignalR - ENHANCED DUPLICATE PREVENTION
   */
  const addRealtimeMessage = useCallback((message: Message) => {
    if (!activeConversationId) return;

    setMessages(prev => {
      // Enhanced duplicate check: by ID and by content+timestamp
      const existsById = prev.some(m => m.id === message.id);
      if (existsById) {
        console.log('Duplicate message detected by ID:', message.id);
        return prev;
      }

      // Additional check for recently sent messages (within 5 seconds)
      // This prevents duplicate when sender receives their own message back from SignalR
      const now = new Date().getTime();
      const messageTime = new Date(message.timestamp).getTime();
      const recentSimilar = prev.find(m => {
        const existingTime = new Date(m.timestamp).getTime();
        return (
          m.content === message.content &&
          m.senderId === message.senderId &&
          Math.abs(existingTime - messageTime) < 5000 && // Within 5 seconds
          Math.abs(now - existingTime) < 10000 // Message was sent within last 10 seconds
        );
      });

      if (recentSimilar) {
        console.log('Duplicate message detected by content+time:', message.content.substring(0, 50));
        return prev;
      }

      // Add to beginning (latest first)
      const updated = [message, ...prev];
      
      // Update cache
      messageCacheService.addRealtimeMessage(activeConversationId, message);
      
      return updated;
    });
  }, [activeConversationId]);

  /**
   * Update existing message (read status, etc.)
   */
  const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
    if (!activeConversationId) return;

    setMessages(prev => {
      const updated = prev.map(msg => 
        msg.id === messageId ? { ...msg, ...updates } : msg
      );
      
      // Update cache
      messageCacheService.updateMessage(activeConversationId, messageId, updates);
      
      return updated;
    });
  }, [activeConversationId]);

  /**
   * Remove message (deleted messages)
   */
  const removeMessage = useCallback((messageId: string) => {
    if (!activeConversationId) return;

    setMessages(prev => {
      const updated = prev.filter(msg => msg.id !== messageId);
      
      // Update cache
      messageCacheService.removeMessage(activeConversationId, messageId);
      
      return updated;
    });
  }, [activeConversationId]);

  /**
   * Refresh messages (clear cache and reload)
   */
  const refresh = useCallback(async () => {
    if (!activeConversationId) return;
    
    messageCacheService.clearConversation(activeConversationId);
    cursorsRef.current = {};
    setMessages([]);
    setHasMoreOlder(true);
    setHasMoreNewer(false);
    await loadInitialMessages();
  }, [activeConversationId, loadInitialMessages]);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setHasMoreOlder(true);
    setHasMoreNewer(false);
    cursorsRef.current = {};
    if (activeConversationId) {
      messageCacheService.clearConversation(activeConversationId);
    }
  }, [activeConversationId]);

  // Auto load initial messages when conversation changes
  useEffect(() => {
    if (autoLoadInitial && activeConversationId) {
      loadInitialMessages();
    }
    
    return () => {
      // Cleanup on unmount or conversation change
      if (activeConversationId) {
        setMessages([]);
        setError(null);
        cursorsRef.current = {};
      }
    };
  }, [activeConversationId, autoLoadInitial, loadInitialMessages]);

  // ENHANCED: Clear stale cache on page reload to prevent duplicates
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Mark cache as potentially stale before page unload
      if (activeConversationId) {
        const cached = messageCacheService.getMessages(activeConversationId);
        if (cached) {
          // Clear cache if it might contain duplicates
          messageCacheService.clearConversation(activeConversationId);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeConversationId]);

  return {
    messages,
    isLoading,
    isLoadingMore,
    hasMoreOlder,
    hasMoreNewer,
    error,
    loadInitialMessages,
    loadOlderMessages,
    loadNewerMessages,
    addRealtimeMessage,
    updateMessage,
    removeMessage,
    refresh,
    clearMessages
  };
};
