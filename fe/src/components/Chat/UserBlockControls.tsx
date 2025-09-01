import React, { useState } from 'react';
import { blockUser, unblockUser } from '../../services/api';
import { toast } from 'react-hot-toast';
import { Button } from '../UI/Button';
import { Modal } from '../UI/Modal';

interface UserBlockControlsProps {
  userId: string;
  username: string;
  isBlocked: boolean;
  hasBlocked: boolean;
  onBlockStatusChange: (isBlocked: boolean, hasBlocked: boolean) => void;
}

export const UserBlockControls: React.FC<UserBlockControlsProps> = ({
  userId,
  username,
  isBlocked,
  hasBlocked,
  onBlockStatusChange,
}) => {
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleBlock = async () => {
    try {
      setIsLoading(true);
      await blockUser(userId);
      onBlockStatusChange(true, true); // Khi block thì hasBlocked = true
      toast.success(`Bạn đã chặn ${username}`);
      setShowBlockModal(false);
    } catch (error) {
      toast.error('Không thể chặn người dùng. Vui lòng thử lại');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblock = async () => {
    try {
      setIsLoading(true);
      await unblockUser(userId);
      onBlockStatusChange(false, false); // Khi unblock thì isBlocked và hasBlocked = false
      toast.success(`Bạn đã gỡ chặn ${username}`);
      setShowUnblockModal(false);
    } catch (error) {
      toast.error('Không thể gỡ chặn người dùng. Vui lòng thử lại');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* {hasBlocked ? (
        <Button
          variant="danger"
          size="sm"
          onClick={() => setShowUnblockModal(true)}
          className="text-sm"
        >
          Gỡ chặn
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowBlockModal(true)}
          className="text-sm"
        >
          Chặn người dùng
        </Button>
      )} */}

      {/* Modal xác nhận chặn */}
      <Modal isOpen={showBlockModal} onClose={() => setShowBlockModal(false)} title={`Chặn ${username}?`}>
        <div className="p-4">
          <p className="mb-4">
            Khi bạn chặn người dùng:
            <ul className="list-disc ml-5 mt-2">
              <li>Người đó sẽ không thể gửi tin nhắn cho bạn</li>
              <li>Người đó sẽ không thấy bạn đang online</li>
              <li>Bạn cũng sẽ không nhận được tin nhắn từ họ</li>
            </ul>
          </p>
          <div className="flex justify-end space-x-3 mt-4">
            <Button variant="secondary" onClick={() => setShowBlockModal(false)} disabled={isLoading}>
              Hủy
            </Button>
            <Button variant="danger" onClick={handleBlock} disabled={isLoading}>
              {isLoading ? 'Đang chặn...' : 'Chặn'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal xác nhận gỡ chặn */}
      <Modal isOpen={showUnblockModal} onClose={() => setShowUnblockModal(false)} title={`Gỡ chặn ${username}?`}>
        <div className="p-4">
          <p className="mb-4">
            Khi bạn gỡ chặn người dùng:
            <ul className="list-disc ml-5 mt-2">
              <li>Người đó có thể gửi tin nhắn cho bạn trở lại</li>
              <li>Người đó có thể thấy bạn đang online</li>
              <li>Bạn sẽ nhận lại tin nhắn từ người đó</li>
            </ul>
          </p>
          <div className="flex justify-end space-x-3 mt-4">
            <Button variant="secondary" onClick={() => setShowUnblockModal(false)} disabled={isLoading}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleUnblock} disabled={isLoading}>
              {isLoading ? 'Đang gỡ chặn...' : 'Gỡ chặn'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
