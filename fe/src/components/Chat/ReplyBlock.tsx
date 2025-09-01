import React from 'react';
import { Message } from '../../types';

interface ReplyBlockProps {
  replyToMessage: Message;
  onClick?: () => void;
}

export const ReplyBlock: React.FC<ReplyBlockProps> = ({ replyToMessage, onClick }) => {
  const truncateContent = (content: string, maxLength: number = 30) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const getMessagePreview = () => {
    switch (replyToMessage.messageType) {
      case 'Image':
        return '📷 Hình ảnh';
      case 'File':
        return '📎 File';
      case 'Deleted':
        return 'Tin nhắn này đã bị xóa';
      default:
        return truncateContent(replyToMessage.content);
    }
  };

  return (
    <div 
      className="bg-gray-100 border-l-4 border-gray-400 p-2 mb-2 rounded-r cursor-pointer hover:bg-gray-200 transition-colors"
      onClick={onClick}
    >
      <div className="text-xs text-gray-600 font-medium">
        {replyToMessage.sender?.name || 'Unknown User'}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {getMessagePreview()}
      </div>
    </div>
  );
};
