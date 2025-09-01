import React from 'react';
import { Message } from '../../types';
import { X, Reply } from 'lucide-react';

interface ReplyPreviewProps {
  replyToMessage: Message;
  onCancelReply: () => void;
}

export const ReplyPreview: React.FC<ReplyPreviewProps> = ({ replyToMessage, onCancelReply }) => {
  const truncateContent = (content: string, maxLength: number = 50) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const getMessagePreview = () => {
    switch (replyToMessage.messageType) {
      case 'Image':
        return '📷 Hình ảnh';
      case 'File':
        return '📎 File';
      default:
        // Check if message has been deleted using a property check
        if ('deleted' in replyToMessage && replyToMessage.deleted) {
          return 'Tin nhắn này đã bị xóa';
        }
        return truncateContent(replyToMessage.content);
    }
  };

  return (
    <div className="bg-gray-50 border-l-4 border-blue-500 p-3 mx-4 mb-2 rounded-r-lg">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-2 flex-1">
          <Reply className="w-4 h-4 text-blue-500 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-blue-600">
                Trả lời {replyToMessage.sender?.name || 'Unknown User'}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {getMessagePreview()}
            </p>
          </div>
        </div>
        <button
          onClick={onCancelReply}
          className="p-1 hover:bg-gray-200 rounded-full transition-colors"
          aria-label="Hủy reply"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    </div>
  );
};
