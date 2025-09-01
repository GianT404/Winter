import React, { useState, useEffect } from 'react';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import { Avatar } from '../UI/Avatar';
import { User, GroupMember } from '../../types';
import { friendshipApi, groupApi } from '../../services/api';
import { cn } from '../../utils/cn';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  existingMembers: GroupMember[];
  onMemberAdded: () => void;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  isOpen,
  onClose,
  groupId,
  existingMembers,
  onMemberAdded,
}) => {
  const [friends, setFriends] = useState<User[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadFriends();
      setSearchQuery('');
      setSelectedFriend(null);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    // Filter friends who are not already members
    const existingMemberIds = existingMembers.map(member => member.userId);
    const availableFriends = friends.filter(friend => !existingMemberIds.includes(friend.id));
    
    if (searchQuery.trim()) {
      const filtered = availableFriends.filter(friend => 
        friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        friend.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredFriends(filtered);
    } else {
      setFilteredFriends(availableFriends);
    }
  }, [searchQuery, friends, existingMembers]);

  const loadFriends = async () => {
    try {
      setIsLoading(true);
      const friendsData = await friendshipApi.getFriends();
      setFriends(friendsData);
    } catch (error) {
      console.error('Error loading friends:', error);
      setError('Không thể tải danh sách bạn bè');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedFriend) return;

    try {
      setIsSubmitting(true);
      setError(null);

      await groupApi.addGroupMember(groupId, {
        userId: selectedFriend.id
      });

      onMemberAdded();
      onClose();
    } catch (error) {
      console.error('Error adding member:', error);
      setError('Không thể thêm thành viên. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFriendSelect = (friend: User) => {
    setSelectedFriend(selectedFriend?.id === friend.id ? null : friend);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Thêm thành viên"
    >
      <div className="space-y-4">
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm bạn bè để thêm vào nhóm..."
            className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Selected Friend */}
        {selectedFriend && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <Avatar src={selectedFriend.avatar} alt={selectedFriend.name} size="sm" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">{selectedFriend.name}</p>
                <p className="text-xs text-blue-600">{selectedFriend.email}</p>
              </div>
              <button
                onClick={() => setSelectedFriend(null)}
                className="text-blue-600 hover:text-blue-800"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Friends List */}
        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
          {isLoading ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Đang tải bạn bè...</p>
            </div>
          ) : filteredFriends.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {filteredFriends.map((friend) => (
                <div
                  key={friend.id}
                  className={cn(
                    "flex items-center space-x-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors",
                    selectedFriend?.id === friend.id ? "bg-blue-50" : ""
                  )}
                  onClick={() => handleFriendSelect(friend)}
                >
                  <Avatar src={friend.avatar} alt={friend.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {friend.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {friend.email}
                    </p>
                  </div>
                  {friend.isOnline && (
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  )}
                  {selectedFriend?.id === friend.id && (
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              {friends.length === 0 ? (
                <p>Bạn chưa có bạn bè nào để thêm vào nhóm</p>
              ) : (
                <p>Không tìm thấy bạn bè phù hợp hoặc tất cả bạn bè đã ở trong nhóm</p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Hủy
          </Button>
          <Button
            onClick={handleAddMember}
            disabled={!selectedFriend || isSubmitting}
            isLoading={isSubmitting}
          >
            {isSubmitting ? 'Đang thêm...' : 'Thêm thành viên'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
