import React from 'react';
import { Trash2, Reply } from 'lucide-react';

interface MessageMenuProps {
  messageId: string;
  isOwn: boolean;
  onDelete?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  className?: string;
}

export const MessageMenu: React.FC<MessageMenuProps> = ({
  messageId,
  isOwn,
  onDelete,
  onReply,
  className = ''
}) => {
  const handleReply = () => {
    onReply?.(messageId);
  };

  const handleDelete = () => {
    onDelete?.(messageId);
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {/* Reply Button - Available for all messages */}
      {onReply && (
        <button
          onClick={handleReply}
          className="p-2 rounded-full bg-white/90 border border-gray-200 shadow-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all duration-200 group"
          title="Trả lời"
        >
          <Reply className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
        </button>
      )}
      
      {/* Delete Button - Only for own messages */}
      {isOwn && onDelete && (
        <button
          onClick={handleDelete}
          className="p-2 rounded-full bg-white/90 border border-gray-200 shadow-sm hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all duration-200 group"
          title="Xóa"
        >
          <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
        </button>
      )}
    </div>
  );
};
