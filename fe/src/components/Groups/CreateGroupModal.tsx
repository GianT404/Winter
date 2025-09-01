import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import { Avatar } from '../UI/Avatar';
import { User, CreateGroupDto } from '../../types';
import { groupApi, friendshipApi } from '../../services/api';
import { cn } from '../../utils/cn';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (group: any) => void;
}

interface FormData {
  name: string;
  description: string;
  privacy: 'Public' | 'Private';
  avatar: File | null;
  memberIds: string[];
}

interface FormErrors {
  name?: string;
  description?: string;
  privacy?: string;
  memberIds?: string;
  avatar?: string;
  general?: string;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onGroupCreated,
}) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    privacy: 'Private',
    avatar: null,
    memberIds: [],
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [friends, setFriends] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredFriends, setFilteredFriends] = useState<User[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<User[]>([]);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showMemberSearch, setShowMemberSearch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load friends on component mount
  useEffect(() => {
    if (isOpen) {
      loadFriends();
      resetForm();
    }
  }, [isOpen]);

  // Filter friends based on search query
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = friends.filter(friend => 
        friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        friend.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredFriends(filtered);
    } else {
      setFilteredFriends(friends);
    }
  }, [searchQuery, friends]);

  const loadFriends = async () => {
    try {
      const friendsData = await friendshipApi.getFriends();
      setFriends(friendsData);
      setFilteredFriends(friendsData);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      privacy: 'Private',
      avatar: null,
      memberIds: [],
    });
    setSelectedMembers([]);
    setErrors({});
    setSearchQuery('');
    setAvatarPreview(null);
    setShowMemberSearch(false);
  };

  const validateForm = (): FormErrors => {
    const newErrors: FormErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Tên nhóm là bắt buộc';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Tên nhóm phải có ít nhất 3 ký tự';
    } else if (formData.name.trim().length > 50) {
      newErrors.name = 'Tên nhóm không được quá 50 ký tự';
    }

    // Description validation
    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Mô tả không được quá 500 ký tự';
    }

    // Member validation
    if (selectedMembers.length < 1) {
      newErrors.memberIds = 'Nhóm phải có ít nhất 1 thành viên (ngoài bạn)';
    }

    // Avatar validation
    if (formData.avatar) {
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (formData.avatar.size > maxSize) {
        newErrors.avatar = 'Ảnh đại diện không được lớn hơn 5MB';
      }
      
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(formData.avatar.type)) {
        newErrors.avatar = 'Chỉ hỗ trợ file ảnh (JPEG, PNG, GIF, WebP)';
      }
    }

    return newErrors;
  };

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file immediately
      const maxSize = 5 * 1024 * 1024; // 5MB
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      
      if (file.size > maxSize) {
        setErrors(prev => ({ ...prev, avatar: 'Ảnh đại diện không được lớn hơn 5MB' }));
        return;
      }
      
      if (!allowedTypes.includes(file.type)) {
        setErrors(prev => ({ ...prev, avatar: 'Chỉ hỗ trợ file ảnh (JPEG, PNG, GIF, WebP)' }));
        return;
      }

      setFormData(prev => ({ ...prev, avatar: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Clear any previous error
      setErrors(prev => ({ ...prev, avatar: undefined }));
    }
  };

  const handleRemoveAvatar = () => {
    setFormData(prev => ({ ...prev, avatar: null }));
    setAvatarPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMemberToggle = (member: User) => {
    const isSelected = selectedMembers.some(m => m.id === member.id);
    
    if (isSelected) {
      setSelectedMembers(prev => prev.filter(m => m.id !== member.id));
    } else {
      setSelectedMembers(prev => [...prev, member]);
    }

    // Clear member error when user selects/deselects
    if (errors.memberIds) {
      setErrors(prev => ({ ...prev, memberIds: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // Convert avatar to base64 if provided
      let avatarBase64 = '';
      if (formData.avatar) {
        avatarBase64 = await fileToBase64(formData.avatar);
      }      const groupData: CreateGroupDto = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        privacy: formData.privacy,
        avatar: avatarBase64 || undefined,
        memberIds: selectedMembers.map(m => m.id),
      };

      console.log('Creating group with data:', groupData);
      const newGroup = await groupApi.createGroup(groupData);
      onGroupCreated(newGroup);
      onClose();
    } catch (error: any) {
      console.error('Error creating group:', error);
      setErrors({ 
        general: error.response?.data?.message || 'Có lỗi xảy ra khi tạo nhóm. Vui lòng thử lại.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:image/type;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tạo nhóm mới"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General Error */}
        {errors.general && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
            {errors.general}
          </div>
        )}

        {/* Group Avatar */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            {avatarPreview ? (
              <div className="relative">
                <img
                  src={avatarPreview}
                  alt="Group avatar preview"
                  className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                />
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center border-2 border-dashed border-gray-300">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              </div>
            )}
          </div>
          
          <div className="flex space-x-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Chọn ảnh đại diện
            </Button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarSelect}
            className="hidden"
          />
          
          {errors.avatar && (
            <p className="text-red-500 text-sm">{errors.avatar}</p>
          )}
        </div>

        {/* Group Name */}
        <div>
          <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-2">
            Tên nhóm <span className="text-red-500">*</span>
          </label>
          <input
            id="groupName"
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="Nhập tên nhóm (3-50 ký tự)"
            className={cn(
              "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
              errors.name ? "border-red-300 bg-red-50" : "border-gray-300"
            )}
            maxLength={50}
          />
          {errors.name && (
            <p className="text-red-500 text-sm mt-1">{errors.name}</p>
          )}
          <p className="text-gray-500 text-xs mt-1">{formData.name.length}/50 ký tự</p>
        </div>

        {/* Group Description */}
        <div>
          <label htmlFor="groupDescription" className="block text-sm font-medium text-gray-700 mb-2">
            Mô tả nhóm
          </label>
          <textarea
            id="groupDescription"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Nhập mô tả ngắn về nhóm (tùy chọn)"
            rows={3}
            className={cn(
              "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none",
              errors.description ? "border-red-300 bg-red-50" : "border-gray-300"
            )}
            maxLength={500}
          />
          {errors.description && (
            <p className="text-red-500 text-sm mt-1">{errors.description}</p>
          )}
          <p className="text-gray-500 text-xs mt-1">{formData.description.length}/500 ký tự</p>
        </div>

        {/* Privacy Setting */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quyền riêng tư
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                value="Private"
                checked={formData.privacy === 'Private'}
                onChange={(e) => handleInputChange('privacy', e.target.value)}
                className="mr-2"
              />
              <div>
                <span className="text-sm font-medium">Riêng tư</span>
                <p className="text-xs text-gray-500">Chỉ thành viên mới có thể xem và tham gia</p>
              </div>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="Public"
                checked={formData.privacy === 'Public'}
                onChange={(e) => handleInputChange('privacy', e.target.value)}
                className="mr-2"
              />
              <div>
                <span className="text-sm font-medium">Công khai</span>
                <p className="text-xs text-gray-500">Mọi người có thể tìm thấy và yêu cầu tham gia</p>
              </div>
            </label>
          </div>
        </div>

        {/* Member Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Thành viên nhóm <span className="text-red-500">*</span>
          </label>
          
          {/* Search Bar */}
          <div className="relative mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowMemberSearch(true)}
              placeholder="Tìm kiếm bạn bè để thêm vào nhóm..."
              className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Selected Members */}
          {selectedMembers.length > 0 && (
            <div className="mb-3">
              <p className="text-sm text-gray-600 mb-2">Đã chọn ({selectedMembers.length}):</p>
              <div className="flex flex-wrap gap-2">
                {selectedMembers.map((member) => (                  <div
                    key={member.id}
                    className="flex items-center space-x-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                  >
                    <Avatar src={member.avatar} alt={member.name} size="sm" />
                    <span>{member.name}</span>
                    <button
                      type="button"
                      onClick={() => handleMemberToggle(member)}
                      className="ml-1 hover:text-blue-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Member List */}
          {(showMemberSearch || searchQuery) && (
            <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
              {filteredFriends.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {filteredFriends.map((friend) => {
                    const isSelected = selectedMembers.some(m => m.id === friend.id);
                    return (
                      <div
                        key={friend.id}
                        className={cn(
                          "flex items-center space-x-3 p-3 hover:bg-gray-50 cursor-pointer",
                          isSelected ? "bg-blue-50" : ""
                        )}
                        onClick={() => handleMemberToggle(friend)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleMemberToggle(friend)}
                          className="w-4 h-4 text-blue-600"
                        />
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
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500 text-sm">
                  {searchQuery ? 'Không tìm thấy bạn bè nào' : 'Bạn chưa có bạn bè nào'}
                </div>
              )}
            </div>
          )}

          {errors.memberIds && (
            <p className="text-red-500 text-sm mt-1">{errors.memberIds}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
            fullWidth
          >
            Hủy
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            fullWidth
          >
            {isSubmitting ? 'Đang tạo...' : 'Tạo nhóm'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
