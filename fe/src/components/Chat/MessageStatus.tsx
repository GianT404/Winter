import { CheckIcon, ClockIcon, AlertTriangleIcon } from 'lucide-react';
import React from 'react';


interface MessageStatusProps {
  status: 'sending' | 'sent' | 'delivered' | 'failed';
  className?: string;
}

const MessageStatus: React.FC<MessageStatusProps> = ({ status, className = '' }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return <ClockIcon className="h-3 w-3 text-gray-400 animate-spin" />;
      case 'sent':
        return <CheckIcon className="h-3 w-3 text-gray-400" />;
      case 'delivered':
        return (
          <div className="relative">
            <CheckIcon className="h-3 w-3 text-blue-500" />
            <CheckIcon className="h-3 w-3 text-blue-500 absolute -right-1 top-0" />
          </div>
        );
      case 'failed':
        return <AlertTriangleIcon className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'sending':
        return 'Đang gửi...';
      case 'sent':
        return 'Đã gửi';
      case 'delivered':
        return 'Đã nhận';
      case 'failed':
        return 'Gửi thất bại';
      default:
        return '';
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`} title={getStatusText()}>
      {getStatusIcon()}
    </div>
  );
};

export default MessageStatus;
