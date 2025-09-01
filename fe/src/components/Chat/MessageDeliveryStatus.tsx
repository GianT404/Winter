import React from 'react';

interface MessageDeliveryStatusProps {
  status: 'sending' | 'sent' | 'delivered' | 'failed';
  onRetry?: () => void;
}

export const MessageDeliveryStatus: React.FC<MessageDeliveryStatusProps> = ({ status, onRetry }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>;
      case 'sent':
        return <div className="w-2 h-2 bg-blue-400 rounded-full"></div>;
      case 'delivered':
        return <div className="w-2 h-2 bg-green-400 rounded-full"></div>;
      case 'failed':
        return (
          <button 
            onClick={onRetry}
            className="w-2 h-2 bg-red-400 rounded-full hover:bg-red-300 cursor-pointer"
            title="Click to retry"
          >
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-end mt-1">
      {getStatusIcon()}
    </div>
  );
};