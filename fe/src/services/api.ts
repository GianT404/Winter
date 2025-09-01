import axios from 'axios';
import { 
  AuthResponse, 
  LoginDto, 
  RegisterDto,
  User, 
  Conversation, 
  Message, 
  Friendship,
  CreateMessageDto,
  CreateConversationDto,
  SendFriendRequestDto,
  BlockStatusDto,
  UpdateUserProfileDto,
  Group,
  CreateGroupDto,
  UpdateGroupDto,
  GroupMember,
  AddGroupMemberDto,
  UpdateGroupMemberDto,
  GroupJoinRequest,
  GroupJoinRequestDto,
  RespondToJoinRequestDto,
  MessagePagination,
  PaginatedMessageResponse
} from '../types';

import config from '../config';

const API_BASE_URL = `${config.api.baseUrl}/api`;
console.log('Using API base URL:', API_BASE_URL);

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Increased timeout to avoid timeout errors
  timeout: 60000, // Increased to 60 seconds for large uploads
  // Enhanced retry configuration
  validateStatus: (status) => {
    // Accept 2xx status codes and 404
    return (status >= 200 && status < 300) || status === 404;
  },
  // Add connection settings
  maxRedirects: 5,
  // Set max content length to handle large file uploads
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Thêm xử lý retry khi gặp lỗi
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response = {} } = error;
    
    // Enhanced error logging
    console.error('API Error:', {
      url: config?.url,
      method: config?.method,
      status: response.status,
      statusText: response?.statusText,
      errorMessage: error.message,
      errorCode: error.code,
      timeout: config?.timeout,
      retryCount: config?._retryCount || 0
    });
    
    // Skip retry if no config, already retried, or max retries reached
    if (!config || config._retry || config._retryCount >= 3) {
      // Show user-friendly error message for timeout
      if (error.code === 'ECONNABORTED' || response.status === 408 || error.message.includes('timeout')) {
        console.error('Request timeout after retries. This may indicate server or network issues.');
      }
      return Promise.reject(error);
    }

    // Enhanced timeout and network error handling
    if (error.code === 'ECONNABORTED' || 
        response.status === 408 || 
        error.message.includes('timeout') ||
        error.message.includes('Network Error') ||
        response.status === 0) {
      
      console.warn(`Request failed (${error.code || response.status}), retrying... (${(config._retryCount || 0) + 1}/3)`, config.url);
      
      // Mark as retry and increment counter
      config._retry = true;
      config._retryCount = (config._retryCount || 0) + 1;
      
      // Increase timeout for retry attempts
      if (config.timeout) {
        config.timeout = Math.min(config.timeout * 1.5, 120000); // Max 2 minutes
      }
        // For large POST requests, try to optimize the request
      if (config.method?.toLowerCase() === 'post' && config.data) {
        if (typeof config.data === 'string' && config.data.length > 50000) {
          console.warn('Large request detected, optimizing for retry');
          // Enable compression if not already set
          config.headers['Accept-Encoding'] = 'gzip, deflate';
        }
      }
      
      // Wait before retrying with exponential backoff
      return new Promise((resolve) => {
        const retryDelay = 1000 * Math.pow(2, config._retryCount - 1); // Exponential backoff
        setTimeout(() => resolve(apiClient(config)), retryDelay);
      });
    }
    
    return Promise.reject(error);
  }
);

// Auth Service
export const authService = {
  login: async (loginDto: LoginDto): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', loginDto);
    return response.data;
  },

  register: async (registerDto: RegisterDto): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/register', registerDto);
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get('/user/profile');
    return response.data;
  },
};

// User Service
export const userService = {
  
  getUserById: async (id: string): Promise<User | null> => {
    try {
      const response = await apiClient.get(`/user/${id}`);
      return response.data;
    } catch (error) {
      return null;
    }
  },

  updateProfile: async (updateDto: Partial<User>): Promise<User> => {
    const response = await apiClient.put('/user/profile', updateDto);
    return response.data;
  },
  updateProfileInfo: async (updateDto: UpdateUserProfileDto): Promise<User> => {
    const response = await apiClient.put('/user/profile/update', updateDto);
    return response.data;
  },
   changePassword: (passwordData: { currentPassword: string; newPassword: string }) => 
    apiClient.put('/user/change-password', passwordData)
      .then(response => response.data),
  searchUsers: async (email: string): Promise<User[]> => {
    const response = await apiClient.get(`/user/search?email=${encodeURIComponent(email)}`);
    return response.data;
  },  updateAvatar: async (avatarFile: File): Promise<User> => {
    const formData = new FormData();
    formData.append('Avatar', avatarFile); // Capital 'A' to match backend DTO property
    
    const response = await apiClient.post<User>('/user/profile/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// Friendship Service
export const friendshipService = {
  getFriends: async (): Promise<User[]> => {
    try {
      console.log('Calling API to get friends...');
      const response = await apiClient.get<User[]>('/friendship/friends', {
        // Add a specific timeout for this request
        timeout: 5000
      });
      console.log('API response for friends:', response);
      return response.data;
    } catch (error) {
      console.error('Error in getFriends API call:', error);
      throw error;
    }
  },
  
  getFriendRequests: async (): Promise<Friendship[]> => {
    try {
      console.log('Calling API to get friend requests...');
      const response = await apiClient.get<Friendship[]>('/friendship/requests', {
        timeout: 5000
      });
      console.log('API response for friend requests:', response);
      return response.data;
    } catch (error) {
      console.error('Error in getFriendRequests API call:', error);
      throw error;
    }
  },
    sendFriendRequest: async (data: { email: string }): Promise<void> => {
    // Make sure we're using application/json content type and correct property name
    await apiClient.post('/friendship/send-request', { receiverEmail: data.email }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },
  
  acceptFriendRequest: async (requestId: string): Promise<void> => {
    await apiClient.post('/friendship/respond', {
      friendshipId: requestId,
      action: 'accept'
    });
  },
  
  declineFriendRequest: async (requestId: string): Promise<void> => {
    await apiClient.post('/friendship/respond', {
      friendshipId: requestId,
      action: 'decline'
    });
  }
};

// Conversation Service
export const conversationService = {
  getConversations: async (): Promise<Conversation[]> => {
    const response = await apiClient.get('/conversation');
    return response.data;
  },

  createConversation: async (dto: CreateConversationDto): Promise<Conversation> => {
    const response = await apiClient.post('/conversation', dto);
    return response.data;
  },

  getConversation: async (id: string): Promise<Conversation> => {
    const response = await apiClient.get(`/conversation/${id}`);
    return response.data;
  },
};

// Message Service
export const messageService = {
  getMessages: async (conversationId: string, page = 1, pageSize = 50): Promise<Message[]> => {
    const response = await apiClient.get(`/message/conversation/${conversationId}?page=${page}&pageSize=${pageSize}`);
    return response.data;
  },

  // New optimized paginated method
  getMessagesPaginated: async (conversationId: string, pagination: MessagePagination): Promise<PaginatedMessageResponse> => {
    const params = new URLSearchParams();
    
    if (pagination.pageNumber) params.set('pageNumber', pagination.pageNumber.toString());
    if (pagination.pageSize) params.set('pageSize', pagination.pageSize.toString());
    if (pagination.cursor) params.set('cursor', pagination.cursor);
    if (pagination.useInfiniteScroll !== undefined) params.set('useInfiniteScroll', pagination.useInfiniteScroll.toString());
    if (pagination.direction) params.set('direction', pagination.direction);

    const response = await apiClient.get(`/message/conversation/${conversationId}/paginated?${params.toString()}`);
    return response.data;
  },

  // Group messages paginated
  getGroupMessagesPaginated: async (groupId: string, pagination: MessagePagination): Promise<PaginatedMessageResponse> => {
    const params = new URLSearchParams();
    
    if (pagination.pageNumber) params.set('pageNumber', pagination.pageNumber.toString());
    if (pagination.pageSize) params.set('pageSize', pagination.pageSize.toString());
    if (pagination.cursor) params.set('cursor', pagination.cursor);
    if (pagination.useInfiniteScroll !== undefined) params.set('useInfiniteScroll', pagination.useInfiniteScroll.toString());
    if (pagination.direction) params.set('direction', pagination.direction);

    const response = await apiClient.get(`/message/group/${groupId}/paginated?${params.toString()}`);
    return response.data;
  },

  sendMessage: async (dto: CreateMessageDto): Promise<Message> => {
    const response = await apiClient.post('/message', dto);
    return response.data;
  },
  
  deleteMessage: async (messageId: string): Promise<void> => {
    await apiClient.delete(`/message/${messageId}`);
  },
  
  markAsRead: async (conversationId: string): Promise<void> => {
    await apiClient.post('/message/mark-as-read', { conversationId });
  },
};

// Block Service
export const blockService = {
  blockUser: async (blockedUserId: string): Promise<any> => {
    const response = await apiClient.post('/block/block', { blockedUserId });
    return response.data;
  },

  unblockUser: async (blockedUserId: string): Promise<any> => {
    const response = await apiClient.post('/block/unblock', { blockedUserId });
    return response.data;
  },

  getBlockStatus: async (targetUserId: string): Promise<any> => {
    const response = await apiClient.get(`/block/status/${targetUserId}`);
    return response.data;
  },

  isUserBlocked: async (targetUserId: string): Promise<boolean> => {
    const response = await apiClient.get(`/block/is-blocked/${targetUserId}`);
    return response.data;
  },

  getBlockedUsers: async (): Promise<User[]> => {
    const response = await apiClient.get('/block/blocked-users');
    return response.data;
  },
};

export const getBlockStatus = async (userId: string): Promise<BlockStatusDto> => {
  const response = await apiClient.get<BlockStatusDto>(`/block/status/${userId}`);
  return response.data;
};

// Block a user
export const blockUser = async (blockedUserId: string) => {
  const response = await apiClient.post<{message: string}>(`/block/${blockedUserId}`);
  return response.data;
};

export const unblockUser = async (blockedUserId: string) => {
  const response = await apiClient.delete<{message: string}>(`/block/${blockedUserId}`);
  return response.data;
};
export const friendshipApi = {
  sendFriendRequest: (receiverEmail: string) => 
    friendshipService.sendFriendRequest({ email: receiverEmail }),
  respondToFriendRequest: (friendshipId: string, action: 'accept' | 'decline') => 
    action === 'accept' 
      ? friendshipService.acceptFriendRequest(friendshipId)
      : friendshipService.declineFriendRequest(friendshipId),
  getPendingRequests: friendshipService.getFriendRequests,
  getFriends: friendshipService.getFriends,
};

export const conversationApi = {
  getConversations: conversationService.getConversations,
  createConversation: (participantId: string) => 
    conversationService.createConversation({ friendId: participantId }),
  getConversation: conversationService.getConversation,
};

export const messageApi = {
  getMessages: messageService.getMessages,
  sendMessage: messageService.sendMessage,
  markAsRead: messageService.markAsRead,
};

// Group API
const groupService = {
  getGroups: async (): Promise<Group[]> => {
    const response = await apiClient.get('/group');
    return response.data;
  },

  getGroup: async (groupId: string): Promise<Group> => {
    const response = await apiClient.get(`/group/${groupId}`);
    return response.data;
  },

  createGroup: async (groupData: CreateGroupDto): Promise<Group> => {
    const response = await apiClient.post('/group', groupData);
    return response.data;
  },

  updateGroup: async (groupId: string, groupData: UpdateGroupDto): Promise<Group> => {
    const response = await apiClient.put(`/group/${groupId}`, groupData);
    return response.data;
  },

  deleteGroup: async (groupId: string): Promise<void> => {
    await apiClient.delete(`/group/${groupId}`);
  },

  getGroupMembers: async (groupId: string): Promise<GroupMember[]> => {
    const response = await apiClient.get(`/group/${groupId}/members`);
    return response.data;
  },

  addGroupMember: async (groupId: string, memberData: AddGroupMemberDto): Promise<GroupMember> => {
    const response = await apiClient.post(`/group/${groupId}/members`, memberData);
    return response.data;
  },

  removeGroupMember: async (groupId: string, memberId: string): Promise<void> => {
    await apiClient.delete(`/group/${groupId}/members/${memberId}`);
  },
  updateGroupMember: async (groupId: string, memberId: string, memberData: UpdateGroupMemberDto): Promise<GroupMember> => {
    const response = await apiClient.put(`/group/${groupId}/members/${memberId}/role`, memberData);
    return response.data;
  },

  getJoinRequests: async (groupId: string): Promise<GroupJoinRequest[]> => {
    const response = await apiClient.get(`/group/${groupId}/join-requests`);
    return response.data;
  },

  submitJoinRequest: async (groupId: string, requestData: GroupJoinRequestDto): Promise<GroupJoinRequest> => {
    const response = await apiClient.post(`/group/${groupId}/join-request`, requestData);
    return response.data;
  },

  respondToJoinRequest: async (groupId: string, requestId: string, responseData: RespondToJoinRequestDto): Promise<void> => {
    await apiClient.post(`/group/${groupId}/join-requests/${requestId}/respond`, responseData);
  },

  searchGroups: async (query: string): Promise<Group[]> => {
    const response = await apiClient.get(`/group/search?query=${encodeURIComponent(query)}`);
    return response.data;
  },
  getGroupMessages: async (groupId: string, page: number = 1, pageSize: number = 50): Promise<Message[]> => {
    const response = await apiClient.get(`/message/group/${groupId}?page=${page}&pageSize=${pageSize}`);
    return response.data;
  },

  markGroupMessagesAsRead: async (groupId: string): Promise<void> => {
    await apiClient.post(`/message/group/${groupId}/mark-read`);
  }
};

export const groupApi = {
  getGroups: groupService.getGroups,
  getGroup: groupService.getGroup,
  createGroup: groupService.createGroup,
  updateGroup: groupService.updateGroup,
  deleteGroup: groupService.deleteGroup,
  getGroupMembers: groupService.getGroupMembers,
  addGroupMember: groupService.addGroupMember,
  removeGroupMember: groupService.removeGroupMember,
  updateGroupMember: groupService.updateGroupMember,
  getJoinRequests: groupService.getJoinRequests,
  submitJoinRequest: groupService.submitJoinRequest,
  respondToJoinRequest: groupService.respondToJoinRequest,
  searchGroups: groupService.searchGroups,
  getGroupMessages: groupService.getGroupMessages,
  markGroupMessagesAsRead: groupService.markGroupMessagesAsRead,
};