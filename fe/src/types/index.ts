export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen?: string;
  createdAt: string;
}

export interface Friendship {
  id: string;
  requesterId: string;
  receiverId: string;
  status: 'Pending' | 'Accepted' | 'Declined';
  createdAt: string;
  requester?: User;
  receiver?: User;
}

export interface Conversation {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: string;
  updatedAt: string;
  user1?: User;
  user2?: User;
  lastMessage?: Message;
  unreadCount: number;
}

export interface Message {
  createdAt: string | number | Date;
  id: string;
  conversationId?: string;
  groupId?: string;
  senderId: string;
  content: string;
  messageType: 'Text' | 'Image' | 'File' | 'Deleted';
  isRead: boolean;
  sentAt: string;
  sender?: User;
  timestamp: string;
  readByRecipient: boolean;
  deliveryStatus?: 'sending' | 'sent' | 'delivered' | 'failed';
  replyToMessageId?: string;
  replyToMessage?: Message;
}

// DTOs
export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
}

export interface CreateMessageDto {
  conversationId?: string;
  groupId?: string;
  content: string;
  messageType: 'Text' | 'Image' | 'File' | 'Deleted';
  replyToMessageId?: string;
}

export interface SendMessageDto {
  conversationId?: string;
  groupId?: string;
  content: string;
  messageType?: string;
  replyToMessageId?: string;
}

export interface SendFriendRequestDto {
  email: string;
}

export interface CreateConversationDto {
  friendId: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Block-related interfaces
export interface BlockUserDto {
  blockedUserId: string;
}

export interface UnblockUserDto {
  blockedUserId: string;
}

export interface BlockStatusDto {
  blockerUserId: string;
  blockedUserId: string;
  status: string;
  createdAt: string;
  isBlocked: boolean;
  hasBlocked: boolean;
}

// Avatar-related interfaces
export interface UpdateUserProfileDto {
  name?: string;
  avatar?: string;
}

export interface UpdateAvatarDto {
  avatar: File;
}

// Group-related interfaces
export interface Group {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  createdById: string;
  privacy: 'Public' | 'Private';
  createdAt: string;
  updatedAt: string;
  createdBy?: User;
  members?: GroupMember[];
  memberCount?: number;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: 'Admin' | 'Member';
  joinedAt: string;
  user?: User;
}

export interface GroupJoinRequest {
  id: string;
  groupId: string;
  userId: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  message?: string;
  requestedAt: string;
  respondedAt?: string;
  respondedById?: string;
  user?: User;
  respondedBy?: User;
}

export interface CreateGroupDto {
  name: string;
  description?: string;
  avatar?: string;
  privacy: 'Public' | 'Private';
  memberIds: string[]; // Backend now accepts strings and converts them to GUIDs
}

export interface UpdateGroupDto {
  name?: string;
  description?: string;
  avatar?: string;
  privacy?: 'Public' | 'Private';
}

export interface AddGroupMemberDto {
  userId: string;
  role?: 'Admin' | 'Member';
}

export interface UpdateGroupMemberDto {
  role: 'Admin' | 'Member';
}

export interface GroupJoinRequestDto {
  message?: string;
}

export interface RespondToJoinRequestDto {
  action: 'approve' | 'reject';
}

// Pagination interfaces
export interface PaginatedMessageResponse {
  messages: Message[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor?: string;
  previousCursor?: string;
}

export interface MessagePagination {
  pageNumber?: number;
  pageSize?: number;
  cursor?: string;
  useInfiniteScroll?: boolean;
  direction?: 'older' | 'newer';
}
