import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Message, User } from '../../types';
import { MessageBubble } from './MessageBubble';

interface OptimizedMessageListProps {
  messages: Message[];
  currentUserId: string;
  users: Record<string, User>;
  typingUsers: string[];
  onRetryMessage?: (messageId: string) => void;
  onLoadMore?: () => void;
  hasMoreMessages?: boolean;
  isLoadingMore?: boolean;
  onDelete?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  onReplyClick?: (message: Message) => void;
}

interface VirtualizedRange {
  start: number;
  end: number;
}

export const SuperOptimizedMessageList: React.FC<OptimizedMessageListProps> = ({
  messages,
  currentUserId,
  users,
  typingUsers,
  onRetryMessage,
  onLoadMore,
  hasMoreMessages = false,
  isLoadingMore = false,
  onDelete,
  onReply,
  onReplyClick
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [visibleRange, setVisibleRange] = useState<VirtualizedRange>({ start: 0, end: 20 }); // Giảm range để render nhanh hơn
  const previousMessageCountRef = useRef(messages.length);

  // Optimized virtualization constants
  const ITEM_HEIGHT = 80; // Giảm height estimate để tính toán nhanh hơn
  const BUFFER_SIZE = 5; // Giảm buffer để render ít hơn
  const LOAD_MORE_THRESHOLD = 200; // Distance from top to trigger load more

  // Calculate visible range based on scroll position
  const updateVisibleRange = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, clientHeight } = container;
    const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
    const visibleCount = Math.ceil(clientHeight / ITEM_HEIGHT);
    const end = Math.min(messages.length, start + visibleCount + BUFFER_SIZE * 2);

    setVisibleRange({ start, end });
  }, [messages.length]);

  // Memoized visible messages
  const visibleMessages = useMemo(() => {
    return messages.slice(visibleRange.start, visibleRange.end);
  }, [messages, visibleRange]);

  // Handle scroll events with throttling
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    
    // Check if near bottom (within 100px)
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    // Enable/disable auto-scroll based on position
    setIsAutoScrollEnabled(isNearBottom);
    setShowScrollToBottom(!isNearBottom && messages.length > 0);

    // Load more messages when scrolling to top
    if (scrollTop < LOAD_MORE_THRESHOLD && hasMoreMessages && !isLoadingMore && onLoadMore) {
      onLoadMore();
    }

    // Update visible range for virtualization
    updateVisibleRange();
  }, [hasMoreMessages, isLoadingMore, onLoadMore, messages.length, updateVisibleRange]);

  // Throttled scroll handler
  const throttledScrollHandler = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleScroll, 16); // ~60fps
    };
  }, [handleScroll]);

  // Auto-scroll to bottom for new messages
  useEffect(() => {
    const newMessageCount = messages.length;
    const previousCount = previousMessageCountRef.current;
    
    if (isAutoScrollEnabled && newMessageCount > previousCount && newMessageCount > 0) {
      const timeout = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      
      previousMessageCountRef.current = newMessageCount;
      return () => clearTimeout(timeout);
    }
    
    previousMessageCountRef.current = newMessageCount;
  }, [messages.length, isAutoScrollEnabled]);

  // Initialize visible range
  useEffect(() => {
    updateVisibleRange();
  }, [updateVisibleRange]);

  // Scroll to bottom manually
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsAutoScrollEnabled(true);
    setShowScrollToBottom(false);
  }, []);

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Loading indicator for older messages */}
      {isLoadingMore && (
        <div className="flex justify-center py-3 bg-gray-50 border-b">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            <span className="text-sm text-gray-600">Loading older messages...</span>
          </div>
        </div>
      )}

      {/* Messages container with virtualization */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
        onScroll={throttledScrollHandler}
        style={{ 
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {/* Virtual spacer for messages above viewport */}
        {visibleRange.start > 0 && (
          <div style={{ height: visibleRange.start * ITEM_HEIGHT }} />
        )}

        {/* Visible messages */}
        <div className="space-y-2 px-4 py-2">
          {visibleMessages.map((message, index) => (
            <div 
              key={message.id} 
              style={{ minHeight: ITEM_HEIGHT }}
              className="flex flex-col"
            >
              <MessageBubble
                message={message}
                isOwn={message.senderId === currentUserId}
                onRetry={onRetryMessage}
                onDelete={onDelete}
                onReply={onReply}
                onReplyClick={onReplyClick}
              />
            </div>
          ))}
        </div>

        {/* Virtual spacer for messages below viewport */}
        {visibleRange.end < messages.length && (
          <div style={{ height: (messages.length - visibleRange.end) * ITEM_HEIGHT }} />
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicators */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 border-t">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <span className="text-sm text-gray-600">
              {typingUsers.length === 1 
                ? `${users[typingUsers[0]]?.name || 'Someone'} is typing...`
                : `${typingUsers.length} people are typing...`
              }
            </span>
          </div>
        </div>
      )}

      {/* Scroll to bottom button */}
      {showScrollToBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-lg transition-all duration-200 z-10 group"
          aria-label="Scroll to bottom"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          
          {/* New messages count badge */}
          {messages.length > previousMessageCountRef.current && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium">
              {Math.min(messages.length - previousMessageCountRef.current, 99)}
            </span>
          )}
          
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Scroll to bottom
          </div>
        </button>
      )}

      {/* Empty state */}
      {messages.length === 0 && !isLoadingMore && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center text-gray-500">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No messages yet</h3>
            <p className="text-gray-600">Start the conversation by sending a message below</p>
          </div>
        </div>
      )}

      {/* Performance stats (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
          Rendering: {visibleRange.end - visibleRange.start}/{messages.length} messages
        </div>
      )}
    </div>
  );
};
