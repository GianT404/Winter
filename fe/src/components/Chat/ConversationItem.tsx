import React, { memo } from 'react';
import { Conversation, User, BlockStatusDto } from '../../types';
import Avatar from '../UI/Avatar';

interface ConversationItemProps {
  conversation: Conversation;
  recipient: User;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
  blockStatus?: BlockStatusDto;
}

export const ConversationItem: React.FC<ConversationItemProps> = memo(({
  conversation,
  recipient,
  isActive,
  onSelect,
  blockStatus
}) => {
  const handleClick = () => {
    onSelect(conversation);
  };

  return (
    <div
      onClick={handleClick}
      className={`p-4 border-b border-white/10 hover:bg-white/20 cursor-pointer transition-colors ${
        isActive ? 'bg-white/20' : ''
      }`}
    >
      <div className="flex items-center space-x-3">
        <div className="relative">
          <Avatar
            src={recipient.avatar}
            alt={recipient.name}
            size="md"
          />
        </div>        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <p className="font-medium text-gray-900 truncate">
                {recipient.name}
              </p>
              {blockStatus?.hasBlocked && (
                <span className="text-xs bg-red-100 text-red-600 px-1 rounded">Đã chặn 😼</span>
              )}
              {blockStatus?.isBlocked && (
                <span className="text-xs bg-orange-100 text-orange-600 px-1 rounded">Bạn đã chặn 😿</span>
              )}
            </div>
            {conversation.lastMessage && (
              <span className="text-xs text-gray-500">
                {new Date(conversation.lastMessage.sentAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            )}
          </div>
          {conversation.lastMessage && (
            <p className="text-sm text-gray-600 truncate">
              {conversation.lastMessage.content}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

ConversationItem.displayName = 'ConversationItem';
