import React, { useState } from 'react';
import { blockService } from '../../services/api';

interface BlockUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onBlockSuccess: () => void;
}

const BlockUserModal: React.FC<BlockUserModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  onBlockSuccess,
}) => {
  const [isBlocking, setIsBlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBlock = async () => {
    setIsBlocking(true);
    setError(null);

    try {
      await blockService.blockUser(userId);
      onBlockSuccess();
      onClose();
    } catch (error) {
      console.error('Lỗi khi chặn người dùng:', error);
      setError('Chặn người dùng thất bại. Vui lòng thử lại.');
    } finally {
      setIsBlocking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center pt-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="block-user-title"
      aria-describedby="block-user-desc"
    >
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-lg" style={{ marginTop: '600px' }}>
        <h2
          id="block-user-title"
          className="text-xl font-bold text-gray-800 mb-4 text-center"
        >
          Chặn người dùng
        </h2>

        <p id="block-user-desc" className="text-gray-700 mb-6 text-center">
          Bạn có chắc chắn muốn chặn <strong>{userName}</strong> không? <br />
          Người này sẽ không thể gửi tin nhắn cho bạn nữa và bạn cũng sẽ không nhận được tin nhắn từ họ.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-center">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            disabled={isBlocking}
            className="px-6 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={handleBlock}
            disabled={isBlocking}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBlocking ? 'Đang chặn...' : 'Chặn'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlockUserModal;
