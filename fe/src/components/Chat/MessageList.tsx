import React, { useEffect, useRef } from 'react';
import { Message, User } from '../../types';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
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

export const MessageList: React.FC<MessageListProps> = ({
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
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // const scrollToBottom = () => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  // };

// useEffect để scroll xuống khi có tin nhắn mới
useEffect(() => {
  const timeout = setTimeout(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, 100);

  return () => clearTimeout(timeout);
}, [messages]);

// Handle scroll event for auto-loading more messages
const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
  const container = e.currentTarget;
  // Check if scrolled to top and has more messages to load
  if (container.scrollTop === 0 && hasMoreMessages && !isLoadingMore && onLoadMore) {
    onLoadMore();
  }
};

  const groupedMessages = messages.reduce((groups: Message[][], message, index) => {
    const prevMessage = messages[index - 1];
    const isNewGroup = !prevMessage || 
      prevMessage.senderId !== message.senderId ||
      new Date(message.sentAt).getTime() - new Date(prevMessage.sentAt).getTime() > 300000; // 5 minutes

    if (isNewGroup) {
      groups.push([message]);
    } else {
      groups[groups.length - 1].push(message);
    }
    return groups;
  }, []);  return (
    <div 
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide"
      onScroll={handleScroll}
    >      {/* Load More Messages Button */}
      {hasMoreMessages && onLoadMore && (
        <div className="flex justify-center mb-4">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoadingMore ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Đang tải 😿...</span>
              </div>
            ) : (
              'Tải tin nhắn cũ hơn'
            )}
          </button>
        </div>
      )}

      {groupedMessages.map((group, groupIndex) => (
        <div key={groupIndex} className="space-y-1">
          {group.map((message, messageIndex) => (            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.senderId === currentUserId}
              sender={message.senderId ? users[message.senderId] : undefined}
              showAvatar={(messageIndex === 0) && (message.senderId !== currentUserId)}
              onDelete={onDelete}
              onReply={onReply}
              onReplyClick={onReplyClick}
              onRetry={onRetryMessage}
            />
          ))}
        </div>
      ))}

      {/* Typing Indicators */}      {typingUsers.length > 0 && (
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <div className="flex space-x-1">
              <div className="w-1 h-1 bg-gray-600 rounded-full animate-bounce"></div>
              <div className="w-1 h-1 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-1 h-1 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
          <span className="text-sm text-gray-500">
            {typingUsers.length === 1 
              ? `${typingUsers[0] && users[typingUsers[0]]?.name || 'Someone'} đang gõ...`
              : `${typingUsers.length} người đang gõ...`
            }
          </span>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
