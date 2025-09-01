import React, { useState, useEffect } from 'react';
import { Button } from '../UI/Button';
import { Avatar } from '../UI/Avatar';
import { CreateGroupModal } from './CreateGroupModal';
import { Group, User } from '../../types';
import { groupApi } from '../../services/api';
import { cn } from '../../utils/cn';

interface GroupListProps {
  onGroupSelect?: (group: Group) => void;
  selectedGroupId?: string;
  currentUser?: User;
}

export const GroupList: React.FC<GroupListProps> = ({
  onGroupSelect,
  selectedGroupId,
  currentUser,
}) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    // Filter groups based on search query
    if (searchQuery.trim()) {
      const filtered = groups.filter(group =>
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredGroups(filtered);
    } else {
      setFilteredGroups(groups);
    }
  }, [searchQuery, groups]);

  const loadGroups = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const groupsData = await groupApi.getGroups();
      setGroups(groupsData);
      setFilteredGroups(groupsData);
    } catch (error: any) {
      console.error('Error loading groups:', error);
      setError('Không thể tải danh sách nhóm. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroupCreated = (newGroup: Group) => {
    setGroups(prev => [newGroup, ...prev]);
    setFilteredGroups(prev => [newGroup, ...prev]);
    if (onGroupSelect) {
      onGroupSelect(newGroup);
    }
  };

  const handleGroupClick = (group: Group) => {
    if (onGroupSelect) {
      onGroupSelect(group);
    }
  };
  const getGroupAvatar = (group: Group) => {
    if (!group.avatar) return undefined;
    
    // If avatar already starts with data:, return as-is
    if (group.avatar.startsWith('data:')) {
      return group.avatar;
    }
    
    // Otherwise, assume it's base64 and add the data URL prefix
    return `data:image/jpeg;base64,${group.avatar}`;
  };

  const formatMemberCount = (count: number = 0) => {
    if (count === 1) return '1 thành viên';
    return `${count} thành viên`;
  };

  const isGroupOwner = (group: Group) => {
    return currentUser && group.createdById === currentUser.id;
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Nhóm</h2>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Tạo nhóm
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm nhóm..."
            className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4">
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadGroups}
              >
                Thử lại
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto">
        {filteredGroups.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchQuery ? (
              <div>
                <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p>Không tìm thấy nhóm nào phù hợp</p>
                <p className="text-sm mt-1">Thử tìm kiếm với từ khóa khác</p>
              </div>
            ) : (
              <div>
                <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p>Chưa có nhóm nào</p>
                <p className="text-sm mt-1">Tạo nhóm đầu tiên để bắt đầu trò chuyện</p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-4"
                >
                  Tạo nhóm mới
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredGroups.map((group) => (
              <div
                key={group.id}
                className={cn(
                  "flex items-center space-x-3 p-4 hover:bg-gray-50 cursor-pointer transition-colors",
                  selectedGroupId === group.id ? "bg-blue-50 border-r-2 border-blue-500" : ""
                )}
                onClick={() => handleGroupClick(group)}
              >
                {/* Group Avatar */}
                <div className="relative">
                  {group.avatar ? (
                    <img
                      src={getGroupAvatar(group)}
                      alt={group.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                      <span className="text-white font-semibold text-lg">
                        {group.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  
                  {/* Privacy indicator */}
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center bg-white border border-gray-200">
                    {group.privacy === 'Public' ? (
                      <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 2C5.582 2 2 5.582 2 10s3.582 8 8 8 8-3.582 8-8-3.582-8-8-8zM8 11a3 3 0 116 0 3 3 0 01-6 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Group Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {group.name}
                    </h3>
                    {isGroupOwner(group) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Admin
                      </span>
                    )}
                  </div>
                  
                  {group.description && (
                    <p className="text-xs text-gray-500 truncate mt-1">
                      {group.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">
                      {formatMemberCount(group.memberCount)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {group.privacy === 'Public' ? 'Công khai' : 'Riêng tư'}
                    </span>
                  </div>
                </div>

                {/* Unread indicator (placeholder for future implementation) */}
                {/* 
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                */}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onGroupCreated={handleGroupCreated}
      />
    </div>
  );
};
