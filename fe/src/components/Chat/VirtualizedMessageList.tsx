import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Message, User } from '../../types';
import { MessageBubble } from './MessageBubble';

interface VirtualizedMessageListProps {
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

// Highly optimized message item component với deep memoization
const MessageItem = React.memo<MessageItemProps>(({ index, style, data }) => {
  const { messages, currentUserId, users, onRetryMessage, onDelete, onReply, onReplyClick } = data;
  const message = messages[index];

  // Early return nếu không có message
  if (!message) {
    return <div style={style} className="px-4 h-20" />;
  }

  // Memoize sender để tránh lookup mỗi lần render
  const sender = users[message.senderId];
  const isOwn = message.senderId === currentUserId;

  return (
    <div style={style} className="px-4">
      <MessageBubble
        message={message}
        isOwn={isOwn}
        sender={sender}
        onRetry={onRetryMessage}
        onDelete={onDelete}
        onReply={onReply}
        onReplyClick={onReplyClick}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison để tránh re-render không cần thiết
  const prevMessage = prevProps.data.messages[prevProps.index];
  const nextMessage = nextProps.data.messages[nextProps.index];
    // Nếu message giống nhau và props khác giống nhau thì không re-render
  return (
    prevMessage?.id === nextMessage?.id &&
    prevMessage?.content === nextMessage?.content &&
    prevMessage?.sentAt === nextMessage?.sentAt &&
    prevProps.data.currentUserId === nextProps.data.currentUserId &&
    prevProps.index === nextProps.index
  );
});

MessageItem.displayName = 'MessageItem';

export const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({
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
  height = 400
}) => {
  const listRef = useRef<List>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const previousMessageCountRef = useRef(messages.length);
  const lastLoadTimeRef = useRef<number>(0);
  // Stable callbacks để tránh re-render
  const stableCallbacks = useMemo(() => ({
    onRetryMessage,
    onDelete,
    onReply,
    onReplyClick
  }), [onRetryMessage, onDelete, onReply, onReplyClick]);

  // Optimized data for virtual list với shallow comparison
  const listData = useMemo(() => ({
    messages,
    currentUserId,
    users,
    ...stableCallbacks
  }), [messages, currentUserId, users, stableCallbacks]);
  // Optimized auto-scroll với RequestAnimationFrame
  useEffect(() => {
    const newMessageCount = messages.length;
    const previousCount = previousMessageCountRef.current;
    
    // Only auto-scroll if new messages were added and auto-scroll is enabled
    if (isAutoScrollEnabled && newMessageCount > previousCount && newMessageCount > 0) {
      // Use RAF để đảm bảo smooth scrolling
      const frameId = requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollToItem(newMessageCount - 1, 'end');
        }
      });
      
      previousMessageCountRef.current = newMessageCount;
      return () => cancelAnimationFrame(frameId);
    }
    
    previousMessageCountRef.current = newMessageCount;
  }, [messages.length, isAutoScrollEnabled]);
  // Throttled scroll handler để tăng performance
  const handleScroll = useCallback(({ scrollOffset }: { scrollOffset: number; scrollDirection: 'forward' | 'backward' }) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollHeight, clientHeight } = container;
    const scrollTop = scrollOffset;
    
    // Check if near bottom (within 100px) - chỉ update khi cần thiết
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    // Batch state updates để tránh multiple re-renders
    if (isAutoScrollEnabled !== isNearBottom) {
      setIsAutoScrollEnabled(isNearBottom);
    }
    
    const shouldShowScrollButton = !isNearBottom && messages.length > 0;
    if (showScrollToBottom !== shouldShowScrollButton) {
      setShowScrollToBottom(shouldShowScrollButton);
    }    // Load more với throttling - chỉ trigger khi thực sự cần
    if (scrollTop < 200 && hasMoreMessages && !isLoadingMore && onLoadMore) {
      // Debounce load more để tránh multiple calls
      const now = Date.now();
      if (now - lastLoadTimeRef.current > 1000) {
        lastLoadTimeRef.current = now;
        onLoadMore();
      }
    }
  }, [hasMoreMessages, isLoadingMore, onLoadMore, messages.length, isAutoScrollEnabled, showScrollToBottom]);
  // Optimized scroll to bottom với RAF
  const scrollToBottom = useCallback(() => {
    if (listRef.current && messages.length > 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToItem(messages.length - 1, 'end');
        setIsAutoScrollEnabled(true);
        setShowScrollToBottom(false);
      });
    }
  }, [messages.length]);

  // Dynamic item size calculation dựa trên message content
  const getItemSize = useCallback((index: number) => {
    const message = messages[index];
    if (!message) return 80;
    
    // Estimate height based on content length
    const baseHeight = 60;
    const contentLines = Math.ceil(message.content.length / 50); // ~50 chars per line
    const lineHeight = 20;
    const padding = 20;
      return Math.max(baseHeight, (contentLines * lineHeight) + padding);
  }, [messages]);

  // Early return for empty messages để tránh render không cần thiết
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-lg font-medium">Chưa có tin nhắn</p>
          <p className="text-sm">Bắt đầu cuộc trò chuyện bằng cách gửi tin nhắn</p>
        </div>
      </div>
    );
  }

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
      )}      {/* Virtual scrolling list */}
      <div ref={scrollContainerRef} className="flex-1">        <List
          ref={listRef}
          height={height}
          width="100%"
          itemCount={messages.length}
          itemSize={80} // Fixed size for better performance
          itemData={listData}
          onScroll={handleScroll}
          style={{ direction: 'ltr' }}
          overscanCount={5} // Render 5 extra items for smoother scrolling
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
          {/* Message count badge */}
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {Math.min(messages.length - previousMessageCountRef.current, 99)}
          </span>        </button>
      )}
    </div>
  );
};
