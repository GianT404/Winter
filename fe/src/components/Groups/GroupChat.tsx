import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Group, Message, User, GroupMember } from '../../types';
import { groupApi } from '../../services/api';
import { signalRService } from '../../services/signalRService';
import { MessageBubble } from '../Chat/MessageBubble';
import { MessageInput } from '../Chat/MessageInput';
import { ArrowLeft, Users, Settings, UserPlus, UserMinus, Edit3, Camera, X, Trash2 } from 'lucide-react';
import { AddMemberModal } from './AddMemberModal';
import config from '../../config';

interface GroupChatProps {
  group: Group;
  currentUser: User;
  onBackClick?: () => void;
}

export const GroupChat: React.FC<GroupChatProps> = ({
  group,
  currentUser,
  onBackClick,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);  const [currentPage, setCurrentPage] = useState(1);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [newGroupName, setNewGroupName] = useState(group.name);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Optimized scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      requestAnimationFrame(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      });
    }
  }, []);
  
  // Auto-scroll effect that only triggers on message count change
  useEffect(() => {
    if (messages.length > 0 && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      
      if (isNearBottom) {
        scrollToBottom();
      }
    }
  }, [messages.length, scrollToBottom]);  // Load initial data
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [messagesData, membersData] = await Promise.all([
        groupApi.getGroupMessages(group.id, 1, 50),
        groupApi.getGroupMembers(group.id)
      ]);
      
      setMessages(messagesData || []);
      setMembers(membersData || []);
      setHasMoreMessages((messagesData?.length || 0) >= 50);
      
      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error('Error loading group data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [group.id, scrollToBottom]);

  const setupSignalRListeners = useCallback(async () => {
    try {
      await signalRService.joinGroup(group.id);
      
      const unsubscribeGroupMessage = signalRService.onGroupMessageReceived((message: Message) => {
        if (message.groupId === group.id) {
          setMessages(prev => {
            const exists = prev.find(m => m.id === message.id);
            if (exists) return prev;
            return [...prev, message];
          });
        }
      });

      return () => {
        unsubscribeGroupMessage();
        signalRService.leaveGroup(group.id);
      };
    } catch (error) {
      console.error('Error setting up SignalR listeners:', error);
    }
  }, [group.id]);

  useEffect(() => {
    if (group) {
      loadInitialData();
      setupSignalRListeners();
    }
  }, [group, loadInitialData, setupSignalRListeners]);  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages) return;
    
    try {
      setIsLoadingMore(true);
      const nextPage = currentPage + 1;
      const newMessages = await groupApi.getGroupMessages(group.id, nextPage, 50);
      
      if (newMessages && newMessages.length > 0) {
        setMessages(prev => [...newMessages, ...prev]);
        setCurrentPage(nextPage);
        setHasMoreMessages(newMessages.length >= 50);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };  const handleSendMessage = async (content: string, messageType: 'Text' | 'Image' | 'File' | 'Deleted' = 'Text', file?: File) => {
    if ((!content.trim() && !file) || !group?.id || !currentUser?.id) return;

    const tempId = `temp-${Date.now()}`;
    let finalContent = content.trim();
    let finalMessageType = messageType;

    // Handle file upload first if there's a file
    if (file) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const uploadResponse = await fetch(`${config.api.baseUrl}/api/file/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error(`File upload failed: ${uploadResponse.status}`);
        }

        const uploadResult = await uploadResponse.json();
        finalContent = uploadResult.url || uploadResult.fileName || uploadResult.filename;
        finalMessageType = file.type.startsWith('image/') ? 'Image' : 'File';
      } catch (error) {
        console.error('File upload error:', error);
        alert('Tải file lên thất bại. Vui lòng thử lại.');
        return;
      }
    }
    
    try {
      const tempMessage: Message = {
        id: tempId,
        groupId: group.id,
        senderId: currentUser.id,
        content: finalContent || (file ? file.name : ''),
        messageType: finalMessageType,
        sentAt: new Date().toISOString(),
        isRead: false,
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        readByRecipient: false,
        sender: currentUser,
        deliveryStatus: 'sending'
      };

      // Check if user is at bottom before adding message
      const container = messagesContainerRef.current;
      const wasAtBottom = container ? 
        container.scrollHeight - container.scrollTop - container.clientHeight < 50 : true;

      // Add optimistic message
      setMessages(prev => [...prev, tempMessage]);      // Send message
      try {
        const result = await signalRService.sendGroupMessageWithConfirmation(group.id, finalContent, finalMessageType, tempId);
        
        if (result.delivered) {
          setMessages(prev => prev.map(msg => 
            msg.id === tempId 
              ? { ...msg, deliveryStatus: 'delivered' as const }
              : msg
          ));
        } else {
          setMessages(prev => prev.map(msg => 
            msg.id === tempId 
              ? { ...msg, deliveryStatus: 'sent' as const }
              : msg
          ));
        }

        // Maintain scroll position
        if (wasAtBottom) {
          setTimeout(() => scrollToBottom(), 100);
        }

      } catch (confirmationError) {
        console.error('Failed to send group message:', confirmationError);
        setMessages(prev => prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, deliveryStatus: 'sent' as const }
            : msg
        ));
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
    }
  };
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (container && container.scrollTop === 0 && hasMoreMessages && !isLoadingMore) {
      loadMoreMessages();
    }
  };
  // Load group members
  const loadGroupMembers = async () => {
    if (!group?.id) return;
    
    try {
      const membersData = await groupApi.getGroupMembers(group.id);
      setMembers(membersData || []);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  };  // Remove member from group
  const removeMember = async (userId: string, memberName: string) => {
    if (!group?.id || !currentUser?.id) return;
    
    if (!window.confirm(`Bạn có chắc muốn xóa ${memberName} khỏi nhóm?`)) return;
    
    try {
      await groupApi.removeGroupMember(group.id, userId);
      setMembers(prev => prev.filter(member => member.userId !== userId));
      console.log('Member removed successfully');
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Không thể xóa thành viên. Vui lòng thử lại.');
    }
  };

  // Handle member addition success
  const handleMemberAdded = () => {
    loadGroupMembers();
    setShowAddMemberModal(false);
  };

  // Update group name
  const updateGroupName = async () => {
    if (!group?.id || !newGroupName.trim() || newGroupName === group.name) {
      setEditingGroupName(false);
      setNewGroupName(group.name);
      return;
    }
    
    setIsUpdatingGroup(true);
    try {
      await groupApi.updateGroup(group.id, { name: newGroupName.trim() });
      group.name = newGroupName.trim(); // Update local state
      setEditingGroupName(false);
      console.log('Group name updated successfully');
    } catch (error) {
      console.error('Error updating group name:', error);
      alert('Không thể cập nhật tên nhóm. Vui lòng thử lại.');
      setNewGroupName(group.name);
    } finally {
      setIsUpdatingGroup(false);
    }
  };
  // Update group image
  const updateGroupImage = async (file: File) => {
    if (!group?.id) return;
    
    setIsUpdatingGroup(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const base64Data = base64.split(',')[1]; // Remove data:image/... prefix
        
        try {
          await groupApi.updateGroup(group.id, { avatar: base64Data });
          group.avatar = base64Data; // Update local state
          console.log('Group image updated successfully');
        } catch (error) {
          console.error('Error updating group image:', error);
          alert('Không thể cập nhật ảnh nhóm. Vui lòng thử lại.');
        } finally {
          setIsUpdatingGroup(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Không thể đọc file ảnh. Vui lòng thử lại.');
      setIsUpdatingGroup(false);
    }
  };
  // Delete group function
  const deleteGroup = async () => {
    if (!group?.id || !currentUser?.id) return;
    
    setIsDeleting(true);
    try {
      await groupApi.deleteGroup(group.id);
      console.log('Group deleted successfully');
      // Navigate back or close the chat
      if (onBackClick) {
        onBackClick();
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('Không thể xóa nhóm. Vui lòng thử lại.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };
  // Helper function to get proper avatar URL
  const getAvatarUrl = (avatar: string | null | undefined): string | undefined => {
    if (!avatar) return undefined;
    
    // If avatar already starts with data:, return as-is
    if (avatar.startsWith('data:')) {
      return avatar;
    }
    
    // Otherwise, assume it's base64 and add the data URL prefix
    return `data:image/jpeg;base64,${avatar}`;
  };

  // Check if current user is group admin  
  const isGroupAdmin = currentUser && group?.createdById === currentUser.id;

  const handleDeleteGroup = async () => {
    if (!group?.id) return;
    
    if (!window.confirm('Bạn có chắc muốn xóa nhóm này?')) return;
    
    setIsDeleting(true);
    try {
      await groupApi.deleteGroup(group.id);
      alert('Nhóm đã được xóa.');
      // Optionally, redirect or update UI after deletion
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('Không thể xóa nhóm. Vui lòng thử lại.');
    } finally {
      setIsDeleting(false);
      setShowGroupSettings(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">      {/* Header - Fixed at top */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBackClick}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            
            <div className="flex items-center space-x-3">
              <div>
                <img
                  src={getAvatarUrl(group.avatar)}
                  alt="Group Avatar"
                  className="w-10 h-10 rounded-full"
                />
              </div>

              <div>
                <h3 className="font-semibold text-gray-900">{group.name}</h3>
                <p className="text-sm text-gray-500">
                  {members.length} thành viên
                </p>
              </div>
            </div>
          </div>

          {/* Group Settings Button */}
          <button
            onClick={() => setShowGroupSettings(true)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title="Cài đặt nhóm"
          >
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
      
      {/* Messages Container - Flexible with fixed height */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Messages Scrollable Area */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto"
          onScroll={handleScroll}
          style={{ 
            scrollBehavior: 'smooth',
            overflowAnchor: 'none' // Prevent scroll anchoring
          }}
        >
          <div className="px-4 py-2 space-y-3">
            {/* Load More Button */}
            {hasMoreMessages && (
              <div className="text-center pb-2">
                <button
                  onClick={loadMoreMessages}
                  disabled={isLoadingMore}
                  className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoadingMore ? 'Đang tải...' : 'Tải thêm tin nhắn'}
                </button>
              </div>
            )}

            {/* Messages List */}
            {messages.map((message, index) => {
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const isFirstInGroup = !prevMessage || 
                prevMessage.senderId !== message.senderId ||
                new Date(message.sentAt).getTime() - new Date(prevMessage.sentAt).getTime() > 300000;

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.senderId === currentUser.id}
                  showAvatar={isFirstInGroup}
                />
              );
            })}

            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <div className="mx-auto h-12 w-12 text-gray-300 mb-4 flex items-center justify-center">
                  <Users className="w-8 h-8" />
                </div>
                <p>Chưa có tin nhắn nào trong nhóm</p>
                <p className="text-sm mt-1">Hãy gửi tin nhắn đầu tiên!</p>
              </div>
            )}
            
            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>      
        {/* Message Input - Fixed at bottom */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white p-4">
          <MessageInput
            onSendMessage={handleSendMessage}
            onTyping={() => {}}
          />
        </div>
      </div>

      {/* Group Settings Modal */}
      {showGroupSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Cài đặt nhóm</h2>              <button
                onClick={() => {
                  setShowGroupSettings(false);
                  setEditingGroupName(false);
                  setNewGroupName(group.name);
                  setShowDeleteConfirm(false);
                }}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              {/* Group Info Section */}
              <div className="p-4 border-b">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Thông tin nhóm</h3>
                
                {/* Group Image */}
                <div className="flex items-center space-x-4 mb-4">
                  <div className="relative">
                    <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">                      {group.avatar ? (
                        <img 
                          src={getAvatarUrl(group.avatar)} 
                          alt={group.name}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                      ) : (
                        <Users className="w-8 h-8 text-white" />
                      )}
                    </div>
                    {isGroupAdmin && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUpdatingGroup}
                        className="absolute -bottom-1 -right-1 p-1 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                      >
                        <Camera className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Ảnh nhóm</p>
                    {isGroupAdmin && (
                      <p className="text-xs text-gray-400">Nhấn vào biểu tượng camera để thay đổi</p>
                    )}
                  </div>
                </div>

                {/* Group Name */}
                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-900">Tên nhóm</label>
                  {editingGroupName ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nhập tên nhóm"
                        disabled={isUpdatingGroup}
                      />
                      <button
                        onClick={updateGroupName}
                        disabled={isUpdatingGroup || !newGroupName.trim()}
                        className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                      >
                        {isUpdatingGroup ? 'Đang lưu...' : 'Lưu'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingGroupName(false);
                          setNewGroupName(group.name);
                        }}
                        disabled={isUpdatingGroup}
                        className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Hủy
                      </button>
                    </div>
                    
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="block text-sm text-gray-500 mb-1 ">{group.name}</span>
                      {isGroupAdmin && (
                        <button
                          onClick={() => setEditingGroupName(true)}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {/* Group Description */}
                {group.description && (
                  <div>
                    <p className="text-sm">Mô tả</p>
                    <label className="block text-sm text-gray-500 mb-1">{group.description}</label>
                  </div>
                )}
              </div>

              {/* Members Section */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-700">
                    Thành viên ({members.length})
                  </h3>                  {isGroupAdmin && (
                    <button 
                      onClick={() => setShowAddMemberModal(true)}
                      className="flex items-center space-x-1 px-2 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span className="text-sm">Thêm</span>
                    </button>
                  )}
                </div>

                {/* Members List */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                          {member.user?.avatar ? (
                            <img 
                              src={getAvatarUrl(member.user.avatar)}
                              alt={member.user.name}
                              className="w-8 h-8 rounded-full object-cover"
                              onError={(e) => {
                                // Hide the image and show fallback if it fails to load
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.setAttribute('style', 'display: block');
                              }}
                            />
                          ) : null}
                          <span 
                            className="text-xs text-gray-600"
                            style={{ display: member.user?.avatar ? 'none' : 'block' }}
                          >
                            {member.user?.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {member.user?.name}
                            {member.userId === currentUser?.id && (
                              <span className="text-gray-500"> (Bạn)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">
                            {member.role === 'Admin' ? 'Quản trị viên' : 'Thành viên'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Member Actions */}
                      {isGroupAdmin && member.userId !== currentUser?.id && member.userId !== group.createdById && (
                        <button
                          onClick={() => removeMember(member.userId, member.user?.name || 'Thành viên')}
                          className="p-1 text-red-400 hover:text-red-600 transition-colors"
                          title="Xóa khỏi nhóm"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Delete Group Section - Only for Admin */}
              {isGroupAdmin && (
                <div className="p-4 border-t border-red-100 bg-red-50">
                  <h3 className="text-sm font-medium text-red-700 mb-3">Vùng nguy hiểm</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-800">Xóa nhóm</p>
                      <p className="text-xs text-red-600 mt-1">
                        Hành động này không thể hoàn tác. Tất cả tin nhắn và dữ liệu sẽ bị mất vĩnh viễn.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={isDeleting}
                      className="px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center space-x-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Xác nhận xóa nhóm</h3>
                  <p className="text-sm text-gray-500">Hành động này không thể hoàn tác</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-gray-700 mb-2">
                  Bạn có chắc chắn muốn xóa nhóm <strong>"{group.name}"</strong>?
                </p>
                <p className="text-sm text-red-600">
                  Tất cả tin nhắn, thành viên và dữ liệu của nhóm sẽ bị xóa vĩnh viễn.
                </p>
              </div>
              
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={deleteGroup}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Đang xóa...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Xóa nhóm</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input for Group Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            updateGroupImage(file);
          }
        }}
        className="hidden"
      />

      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        groupId={group.id}
        existingMembers={members}
        onMemberAdded={handleMemberAdded}
      />
    </div>
  );
};