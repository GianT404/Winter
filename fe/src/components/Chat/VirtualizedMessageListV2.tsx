import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
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
  height?: number;
  width?: number;
}

interface MessageItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    messages: Message[];
    currentUserId: string;
    users: Record<string, User>;
    onRetryMessage?: (messageId: string) => void;
    onDelete?: (messageId: string) => void;
    onReply?: (messageId: string) => void;
    onReplyClick?: (message: Message) => void;
  };
}

// Memoized message item component
const MessageItem = React.memo<MessageItemProps>(({ index, style, data }) => {
  const { messages, currentUserId, users, onRetryMessage, onDelete, onReply, onReplyClick } = data;
  const message = messages[index];

  if (!message) return null;

  return (
    <div style={style} className="px-4">
      <MessageBubble
        message={message}
        isOwn={message.senderId === currentUserId}
        onRetry={onRetryMessage}
        onDelete={onDelete}
        onReply={onReply}
        onReplyClick={onReplyClick}
      />
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

export const OptimizedMessageList: React.FC<OptimizedMessageListProps> = ({
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
  onReplyClick,
  height = 400,
  width = 400
}) => {
  const listRef = useRef<List>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const previousMessageCountRef = useRef(messages.length);

  // Memoized data for virtual list
  const listData = useMemo(() => ({
    messages,
    currentUserId,
    users,
    onRetryMessage,
    onDelete,
    onReply,
    onReplyClick
  }), [messages, currentUserId, users, onRetryMessage, onDelete, onReply, onReplyClick]);

  // Auto-scroll to bottom for new messages when enabled
  useEffect(() => {
    const newMessageCount = messages.length;
    const previousCount = previousMessageCountRef.current;
    
    // Only auto-scroll if new messages were added and auto-scroll is enabled
    if (isAutoScrollEnabled && newMessageCount > previousCount && newMessageCount > 0) {
      const timeout = setTimeout(() => {
        listRef.current?.scrollToItem(0, 'end');
      }, 100);
      
      previousMessageCountRef.current = newMessageCount;
      return () => clearTimeout(timeout);
    }
    
    previousMessageCountRef.current = newMessageCount;
  }, [messages.length, isAutoScrollEnabled]);

  // Handle scroll events
  const handleScroll = useCallback(({ scrollOffset, scrollDirection }: { scrollOffset: number; scrollDirection: 'forward' | 'backward' }) => {
    const scrollTop = scrollOffset;
    
    // Check if near bottom (within 100px)
    const isNearBottom = scrollTop < 100;
    
    // Enable/disable auto-scroll based on position
    setIsAutoScrollEnabled(isNearBottom);
    setShowScrollToBottom(!isNearBottom && messages.length > 0);

    // Load more messages when scrolling to bottom (older messages)
    if (scrollTop < 200 && hasMoreMessages && !isLoadingMore && onLoadMore) {
      onLoadMore();
    }
  }, [hasMoreMessages, isLoadingMore, onLoadMore, messages.length]);

  // Scroll to bottom manually
  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToItem(0, 'start');
    setIsAutoScrollEnabled(true);
    setShowScrollToBottom(false);
  }, []);

  // Calculate estimated item size (rough estimate)
  const getItemSize = useCallback(() => {
    // Base message height + padding
    return 100; // Adjust based on your message design
  }, []);

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Loading indicator for older messages */}
      {isLoadingMore && (
        <div className="flex justify-center py-2 bg-gray-50">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            <span className="text-sm text-gray-600">Loading older messages...</span>
          </div>
        </div>
      )}

      {/* Virtual scrolling list */}
      <div className="flex-1">
        <List
          ref={listRef}
          height={height}
          width={width}
          itemCount={messages.length}
          itemSize={getItemSize()}
          itemData={listData}
          onScroll={handleScroll}
          style={{ direction: 'ltr' }}
        >
          {MessageItem}
        </List>
      </div>

      {/* Typing indicators */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-2 bg-gray-50">
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
          className="absolute bottom-4 right-4 bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full shadow-lg transition-all duration-200 z-10"
          aria-label="Scroll to bottom"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}

      {/* Empty state */}
      {messages.length === 0 && !isLoadingMore && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm">Start a conversation by sending a message</p>
          </div>
        </div>
      )}
    </div>
  );
};
