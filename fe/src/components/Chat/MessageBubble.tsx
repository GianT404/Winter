import React from 'react';
import { Message, User } from '../../types';
import { Check, CheckCheck, Download, FileText } from 'lucide-react';
import config from '../../config';
import { ReplyBlock } from './ReplyBlock';
import { MessageMenu } from './MessageMenu';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  sender?: User;
  showAvatar?: boolean;
  onDelete?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  onReplyClick?: (message: Message) => void;
  onRetry?: (messageId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  sender,
  showAvatar = true,
  onDelete,
  onReply,
  onReplyClick,
  onRetry,
}) => {
const formatTime = (dateInput: string | Date) => {
  // Parse date and ensure it's treated as UTC if no timezone specified
  const date = typeof dateInput === 'string' 
    ? new Date(dateInput.includes('Z') || dateInput.includes('+') ? dateInput : dateInput + 'Z')
    : dateInput;
  
  if (isNaN(date.getTime())) {
    return 'Invalid time';
  }
  
  // Direct conversion to Vietnam time (UTC+7)
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
};
  const renderMessageContent = () => {
    // Check if message is deleted
    if (message.messageType === 'Deleted') {
      return (
        <p className="text-sm italic text-gray-500">
          Tin nhắn này đã bị xóa
        </p>
      );
    }

    switch (message.messageType) {case 'Image':
        const imageUrl = message.content.startsWith('http') 
          ? message.content 
          : `${config.api.baseUrl}${message.content}`;
        return (
          <div className="space-y-2">
            <div className="rounded-lg overflow-hidden max-w-xs">
              <img 
                src={imageUrl} 
                alt="Shared image"
                className="w-full h-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(imageUrl, '_blank')}
              />
            </div>
          </div>
        );
        case 'File':
        const fileName = message.content.split('/').pop() || 'File';
        const fileUrl = message.content.startsWith('http') 
          ? message.content 
          : `${config.api.baseUrl}${message.content}`;
        return (
          <div className="flex items-center space-x-3 p-3 bg-white/10 rounded-lg border border-white/20 max-w-xs">
            <div className="p-2 bg-white/20 rounded-lg">
              <FileText className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fileName}</p>
              <p className="text-xs opacity-70">Nhấn để tải</p>
            </div>
            <button
              onClick={() => window.open(fileUrl, '_blank')}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        );
      
      case 'Text':
      default:
        return (
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        );
    }
  };
  return (
    <div 
      id={`message-${message.id}`}
      className={`flex items-end space-x-2 mb-4 message-item group ${isOwn ? 'flex-row-reverse space-x-reverse' : ''}`}
    >
      {/* Avatar */}
      {/* {showAvatar && !isOwn && sender && (
        <div className="w-8 h-8 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
          {sender.name.charAt(0).toUpperCase()}
        </div>
      )} */}          {/* Message Content */}
      <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-1' : ''}`}>        {/* Reply Block - Show if this message is replying to another */}
        {message.replyToMessage && (
          <ReplyBlock 
            replyToMessage={message.replyToMessage}
            onClick={() => onReplyClick?.(message.replyToMessage!)}
          />
        )}

        <div
          className={`px-4 py-2 rounded-2xl border ${
            isOwn
              ? 'border-teal-300 text-teal-700'
              : 'border-gray-500 text-gray-800'
          }`}
        >
          {renderMessageContent()}
        </div>

        {/* Message Info */}
        <div className={`flex items-center space-x-1 mt-1 text-base ${
          isOwn ? 'justify-end text-primary-500' : 'text-gray-500'
        }`}>
          <span>{formatTime(message.sentAt)}</span>
          {isOwn && (
            <div className="flex items-center">
              {message.isRead ? (
                <CheckCheck className="w-3 h-3 text-primary-500" />
              ) : (
                <Check className="w-3 h-3 text-gray-400" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Message Menu - Positioned beside the message */}
      <MessageMenu
        messageId={message.id}
        isOwn={isOwn}
        onDelete={onDelete}
        onReply={onReply}
        className={`message-actions opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
          isOwn ? 'order-2' : ''
        }`}
      />
    </div>
  );
};