import React, { useState } from 'react';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import { Avatar } from '../UI/Avatar';
import { GroupMember, User } from '../../types';
import { groupApi } from '../../services/api';
import { cn } from '../../utils/cn';

interface ManageMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: GroupMember;
  groupId: string;
  currentUser: User;
  groupCreatorId: string;
  onMemberUpdated: () => void;
}

export const ManageMemberModal: React.FC<ManageMemberModalProps> = ({
  isOpen,
  onClose,
  member,
  groupId,
  currentUser,
  groupCreatorId,
  onMemberUpdated,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'remove' | 'promote' | 'demote' | null>(null);

  const isGroupCreator = member.userId === groupCreatorId;
  const isSelf = member.userId === currentUser.id;
  const canModify = !isGroupCreator && !isSelf;

  const handleRoleChange = async (newRole: 'Admin' | 'Member') => {
    if (!member.user) return;

    try {
      setIsSubmitting(true);
      setError(null);

      await groupApi.updateGroupMember(groupId, member.userId, {
        role: newRole
      });

      onMemberUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating member role:', error);
      setError('Không thể cập nhật vai trò. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
      setConfirmAction(null);
    }
  };

  const handleRemoveMember = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      await groupApi.removeGroupMember(groupId, member.userId);

      onMemberUpdated();
      onClose();
    } catch (error) {
      console.error('Error removing member:', error);
      setError('Không thể xóa thành viên. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
      setConfirmAction(null);
    }
  };

  const renderConfirmationView = () => {
    if (!confirmAction) return null;

    const actions = {
      remove: {
        title: 'Xóa thành viên',
        message: `Bạn có chắc chắn muốn xóa ${member.user?.name} khỏi nhóm?`,
        action: 'Xóa',
        onConfirm: handleRemoveMember,
        className: 'bg-white-600 hover:bg-white-700 text-white'
      },
      promote: {
        title: 'Thăng cấp thành viên',
        message: `Bạn có chắc chắn muốn thăng cấp ${member.user?.name} thành quản trị viên?`,
        action: 'Thăng cấp',
        onConfirm: () => handleRoleChange('Admin'),
        className: 'bg-blue-600 hover:bg-blue-700 text-white'
      },
      demote: {
        title: 'Hạ cấp quản trị viên',
        message: `Bạn có chắc chắn muốn hạ cấp ${member.user?.name} xuống thành viên thông thường?`,
        action: 'Hạ cấp',
        onConfirm: () => handleRoleChange('Member'),
        className: 'bg-orange-600 hover:bg-orange-700 text-white'
      }
    };

    const currentAction = actions[confirmAction];

    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {currentAction.title}
          </h3>
          <p className="text-sm text-gray-600">
            {currentAction.message}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}        <div className="flex justify-end space-x-3">
          <Button
            variant="ghost"
            onClick={() => setConfirmAction(null)}
            disabled={isSubmitting}
          >
            Hủy
          </Button>
          <Button
            className={currentAction.className}
            onClick={currentAction.onConfirm}
            disabled={isSubmitting}
            isLoading={isSubmitting}
          >
            {isSubmitting ? 'Đang xử lý...' : currentAction.action}
          </Button>
        </div>
      </div>
    );
  };

  if (!isOpen || !member.user) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Thông tin thành viên"
    >
      {confirmAction ? renderConfirmationView() : (
        <div className="space-y-6">
          {/* Member Info */}
          <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
            <Avatar src={member.user.avatar} alt={member.user.name} size="lg" />
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900">
                {member.user.name}
              </h3>
              <p className="text-sm text-gray-600">{member.user.email}</p>
              <div className="flex items-center space-x-2 mt-2">
                <span className={cn(
                  "inline-flex items-center px-2 py-1 rounded text-xs font-medium",
                  member.role === 'Admin' 
                    ? "bg-blue-100 text-blue-800" 
                    : "bg-gray-100 text-gray-800"
                )}>
                  {member.role === 'Admin' ? 'Quản trị viên' : 'Thành viên'}
                </span>
                {isGroupCreator && (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                    Người tạo nhóm
                  </span>
                )}
                {member.user.isOnline && (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-xs text-green-600">Đang online</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Tham gia: {new Date(member.joinedAt).toLocaleDateString('vi-VN')}
              </p>
            </div>
          </div>

          {/* Actions */}
          {canModify ? (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-900">Hành động</h4>
              
              {/* Role Management */}
              <div className="space-y-2">                {member.role === 'Member' ? (
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmAction('promote')}
                    className="w-full justify-start"
                    disabled={isSubmitting}
                  >
                    <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                    Thăng cấp thành quản trị viên
                  </Button>                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmAction('demote')}
                    className="w-full justify-start"
                    disabled={isSubmitting}
                  >
                    <svg className="w-4 h-4 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                    </svg>
                    Hạ cấp xuống thành viên
                  </Button>
                )}                {/* Remove Member */}
                <Button
                  variant="ghost"
                  onClick={() => setConfirmAction('remove')}
                  className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50 "
                  disabled={isSubmitting}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Xóa khỏi nhóm
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex">
                <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm text-yellow-800">
                    {isSelf 
                      ? 'Bạn không thể thực hiện hành động trên chính mình'
                      : 'Người tạo nhóm không thể bị xóa hoặc thay đổi vai trò'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
              {error}
            </div>
          )} 

        </div>

      )}
    </Modal>
  );
};
