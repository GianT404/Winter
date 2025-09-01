import React, { useState } from 'react';
import { blockService } from '../../services/api';

interface UnblockUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onUnblockSuccess: () => void;
}

const UnblockUserModal: React.FC<UnblockUserModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  onUnblockSuccess,
}) => {
  const [isUnblocking, setIsUnblocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnblock = async () => {
    setIsUnblocking(true);
    setError(null);

    try {
      await blockService.unblockUser(userId);
      onUnblockSuccess();
      onClose();
    } catch (error) {
      console.error('Lỗi khi gỡ chặn người dùng:', error);
      setError('Gỡ chặn thất bại. Vui lòng thử lại.');
    } finally {
      setIsUnblocking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unblock-user-title"
      aria-describedby="unblock-user-desc"
    >
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-lg" style={{ marginTop: '600px' }}>
        <h2
          id="unblock-user-title"
          className="text-xl font-bold text-gray-800 mb-4 text-center"
        >
          Gỡ chặn người dùng
        </h2>

        <p id="unblock-user-desc" className="text-gray-700 mb-6 text-center">
          Bạn có chắc muốn gỡ chặn <strong>{userName}</strong> không? <br />
          Người này sẽ có thể gửi tin nhắn cho bạn trở lại.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-center">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            disabled={isUnblocking}
            className="px-6 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={handleUnblock}
            disabled={isUnblocking}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUnblocking ? 'Đang gỡ chặn...' : 'Gỡ chặn'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnblockUserModal;
