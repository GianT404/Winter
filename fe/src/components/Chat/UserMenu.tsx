import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { blockService } from '../../services/api';
import BlockUserModal from './BlockUserModal';
import UnblockUserModal from './UnblockUserModal';

interface UserMenuProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onBlockStatusChange: (isBlocked: boolean, hasBlocked: boolean) => void;
}

const UserMenu: React.FC<UserMenuProps> = ({
  user,
  isOpen,
  onClose,
  onBlockStatusChange,
}) => {
  const [isBlocked, setIsBlocked] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (isOpen && user?.id) {
      checkBlockStatus();
    }
  }, [isOpen, user?.id]);  const checkBlockStatus = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const blockStatus = await blockService.getBlockStatus(user.id);
      setIsBlocked(blockStatus.hasBlocked || false);
    } catch (error) {
      console.error('Không kiểm tra được trạng thái chặn:', error);
      // Set default value on error to prevent UI issues
      setIsBlocked(false);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockSuccess = () => {
    setIsBlocked(true);
    onBlockStatusChange(true, true);
  };

  const handleUnblockSuccess = () => {
    setIsBlocked(false);
    onBlockStatusChange(false, false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="absolute right-0 top-12 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-48">
        <div className="py-2">          <div className="px-4 py-2 border-b border-gray-100">
            <p className="font-medium text-gray-900">{user?.name || 'Unknown User'}</p>
            <p className="text-sm text-gray-500">{user?.email || 'No email'}</p>
          </div>
          
          <div className="py-1">
            {loading ? (
              <div className="px-4 py-2 text-gray-500">Đang tải...</div>
            ) : (
              <>
                {isBlocked ? (
                  <button
                    onClick={() => setShowUnblockModal(true)}
                    className="w-auto text-left px-1 py-2 text-green-600 hover:bg-green-50 transition-colors"
                  >
                    🔓 Gỡ chặn người này!?
                  </button>
                ) : (
                  <button
                    onClick={() => setShowBlockModal(true)}
                    className="w-full text-left px-2 py-2 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    🚫 Chặn người dùng
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Overlay to close menu */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />

      {/* Portal container cho modals - sẽ hiển thị giữa khu vực chat */}
      <div id="modal-portal" className="z-50" />

      {/* Modals - sử dụng absolute để đặt trong khu vực chat */}
      {(showBlockModal || showUnblockModal) && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center z-50">
          <div className="bg-black bg-opacity-50 absolute inset-0" onClick={() => {
            setShowBlockModal(false);
            setShowUnblockModal(false);
          }} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 z-50">
            {showBlockModal && (              <BlockUserModal
                isOpen={showBlockModal}
                onClose={() => setShowBlockModal(false)}
                userId={user?.id || ''}
                userName={user?.name || 'Unknown User'}
                onBlockSuccess={handleBlockSuccess}
              />
            )}

            {showUnblockModal && (              <UnblockUserModal
                isOpen={showUnblockModal}
                onClose={() => setShowUnblockModal(false)}
                userId={user?.id || ''}
                userName={user?.name || 'Unknown User'}
                onUnblockSuccess={handleUnblockSuccess}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default UserMenu;