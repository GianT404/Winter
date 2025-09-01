import React, { useState, useEffect, useCallback } from 'react';
import { User, Conversation, Message, Friendship, BlockStatusDto, Group } from '../../types';
import { Sidebar } from '../Layout/Sidebar';
import { ChatHeader } from '../Chat/ChatHeader';
import { MessageList } from '../Chat/MessageList';
import { MessageInput } from '../Chat/MessageInput';
import { FriendList } from '../Friends/FriendList';
import { GroupList } from '../Groups/GroupList';
import { GroupChat } from '../Groups/GroupChat';
import Avatar from '../UI/Avatar';
import { useAuth } from '../../hooks/useAuth';
import { signalRService } from '../../services/signalRService';
import {
  conversationService,
  messageService,
  friendshipService,
  userService,
  blockService,
} from '../../services/api';
import toast from 'react-hot-toast';
import Setting from '../UI/Setting';
import config from '../../config';

export const ChatApp: React.FC = () => {
  const { user, logout } = useAuth();  const [activeSection, setActiveSection] = useState<'chats' | 'friends' | 'groups' | 'settings'>('chats');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<Friendship[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [blockStatuses, setBlockStatuses] = useState<Record<string, BlockStatusDto>>({});
  const [blockStatus, setBlockStatus] = useState<{ isBlocked: boolean; hasBlocked: boolean }>({
    isBlocked: false,
    hasBlocked: false,
  });
  
  // Reply functionality state
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  
  // Pagination state for conversations
  const [conversationPage, setConversationPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const convs = await conversationService.getConversations();
      setConversations(convs);

      // Load user data for all participants
      const userIds = new Set<string>();
      convs.forEach((conv) => {
        userIds.add(conv.user1Id);
        userIds.add(conv.user2Id);
      });

      const userData: Record<string, User> = {};
      for (const userId of userIds) {
        if (userId !== user?.id) {
          try {
            const userData_ = await userService.getUserById(userId);
            if (userData_) userData[userId] = userData_;
          } catch (error) {
            console.error('Failed to load user:', userId);
          }
        }
      }
      setUsers(userData);
    } catch (error) {
      toast.error('Failed to load conversations');
    }
  }, [user?.id]);
  const loadMessages = useCallback(async (conversationId: string, page = 1, pageSize = 50) => {
    try {
      const msgs = await messageService.getMessages(conversationId, page, pageSize);
      
      if (page === 1) {
        // Initial load - replace all messages
        setMessages(msgs);
        setConversationPage(1);
        setHasMoreMessages(msgs.length >= pageSize);
      } else {
        // Load more - prepend older messages
        setMessages(prev => [...msgs, ...prev]);
        setHasMoreMessages(msgs.length >= pageSize);
      }

      // Join conversation room on initial load
      if (page === 1) {
        await signalRService.joinConversation(conversationId);
      }
    } catch (error) {
      toast.error('Failed to load messages');
    }
  }, []);

  const loadMoreConversationMessages = useCallback(async () => {
    if (!activeConversation || isLoadingMoreMessages || !hasMoreMessages) return;
    
    try {
      setIsLoadingMoreMessages(true);
      const nextPage = conversationPage + 1;
      await loadMessages(activeConversation.id, nextPage);
      setConversationPage(nextPage);
    } catch (error) {
      toast.error('Failed to load more messages');
    } finally {
      setIsLoadingMoreMessages(false);
    }
  }, [activeConversation, conversationPage, isLoadingMoreMessages, hasMoreMessages, loadMessages]);

  // FIX 1: Separate useEffect for SignalR initialization
  useEffect(() => {
    if (!user) return;

    let isConnected = false;

    const initializeSignalR = async () => {
      try {
        // Initialize SignalR connection
        await signalRService.start();
        isConnected = true;

        // Join user-specific group for notifications
        await signalRService.joinUserGroup();

        console.log('SignalR connected successfully');
      } catch (error) {
        console.error('Failed to initialize SignalR:', error);
        // Retry connection after 3 seconds
        setTimeout(initializeSignalR, 3000);
      }
    };

    initializeSignalR();

    return () => {
      if (isConnected) {
        signalRService.stop();
      }
    };
  }, [user]);  // FIX 2: Separate useEffect for SignalR event listeners
  useEffect(() => {
    if (!user) return;    // Set up event listeners with proper cleanup
    const messageHandler = (message: Message) => {
      console.log('New message received:', message);
      
      // Only add message if it belongs to current conversation
      if (activeConversation && message.conversationId === activeConversation.id) {
        setMessages((prev) => {
          // Enhanced duplicate detection - check both ID and content
          const existsById = prev.some(m => m.id === message.id);
          if (existsById) {
            console.log('Duplicate message detected by ID, skipping:', message.id);
            return prev;
          }
          
          // ENHANCED: Skip own messages that were recently sent (optimistic update already added them)
          if (user && message.senderId === user.id) {
            const now = new Date().getTime();
            const messageTime = new Date(message.sentAt || message.timestamp).getTime();
            if (Math.abs(now - messageTime) < 10000) { // Within 10 seconds
              console.log('Skipping own message from SignalR (already added via optimistic update)');
              return prev;
            }
          }
          
          // Additional check for content duplicate (helps with receiver duplicate issue)
          const existsByContent = prev.some(m => 
            m.senderId === message.senderId &&
            m.content === message.content &&
            m.replyToMessageId === message.replyToMessageId &&
            !m.id.startsWith('temp-') && // Don't compare with temp messages
            Math.abs(new Date(m.sentAt || m.timestamp).getTime() - new Date(message.sentAt || message.timestamp).getTime()) < 3000 // Within 3 seconds
          );
          
          if (existsByContent) {
            console.log('Duplicate message detected by content, skipping:', message.id);
            return prev;
          }
          
          return [...prev, message];
        });
      }
      
      // Update conversation list to show latest message
      loadConversations();
    };

    const typingStartHandler = (userId: string, conversationId: string) => {
      if (activeConversation?.id === conversationId && userId !== user.id) {
        setTypingUsers((prev) => {
          const filtered = prev.filter((id) => id !== userId);
          return [...filtered, userId];
        });
        
        // Auto-remove typing indicator after 3 seconds
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((id) => id !== userId));
        }, 3000);
      }
    };

    const typingStopHandler = (userId: string, conversationId: string) => {
      if (activeConversation?.id === conversationId) {
        setTypingUsers((prev) => prev.filter((id) => id !== userId));
      }
    };

    const userOnlineHandler = (userId: string) => {
      setOnlineUsers((prev) => new Set([...prev, userId]));
    };

    const userOfflineHandler = (userId: string) => {
      setOnlineUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    };

    const userBlockedHandler = (data: { blockedBy: string }) => {
      const { blockedBy } = data;
      if (blockedBy) {
        toast.error('Bạn đã bị chặn bởi người dùng này');
        loadBlockStatus();
      }
    };

    const userUnblockedHandler = (data: { unblockedBy: string }) => {
      const { unblockedBy } = data;
      if (unblockedBy) {
        toast.success('Bạn đã được gỡ chặn bởi người dùng này');
        loadBlockStatus();
      }
    };    // Register event listeners using the new signalRService API
    const unsubscribeMessage = signalRService.onMessageReceived(messageHandler);
    const unsubscribeTyping = signalRService.onTypingIndicator((userId, conversationId, isTyping) => {
      if (isTyping) {
        typingStartHandler(userId, conversationId);
      } else {
        typingStopHandler(userId, conversationId);
      }
    });
    const unsubscribeUserStatus = signalRService.onUserStatusChanged((userId, isOnline) => {
      if (isOnline) {
        userOnlineHandler(userId);
      } else {
        userOfflineHandler(userId);
      }
    });    const unsubscribeBlockStatus = signalRService.onBlockStatusChanged((userId, isBlocked) => {
      if (isBlocked) {
        userBlockedHandler({ blockedBy: userId });
      } else {
        userUnblockedHandler({ unblockedBy: userId });
      }
    });    // Handle delivery confirmations
    const unsubscribeDeliveryConfirmation = signalRService.onDeliveryConfirmation((messageId: string) => {
      console.log('Message delivery confirmed:', messageId);
      setMessages((prev) => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, deliveryStatus: 'delivered' as const }
            : msg
        )
      );
    });

    // Handle delivery failures  
    const unsubscribeDeliveryFailure = signalRService.onDeliveryFailure((messageId: string, error: string) => {
      console.log('Message delivery failed:', messageId, error);
      setMessages((prev) => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, deliveryStatus: 'failed' as const }
            : msg
        )
      );
      toast.error(`Message failed to deliver: ${error}`);
    });// Cleanup function
    return () => {
      unsubscribeMessage();
      unsubscribeTyping();
      unsubscribeUserStatus();
      unsubscribeBlockStatus();
      unsubscribeDeliveryConfirmation();
      unsubscribeDeliveryFailure();
    };
  }, [user, activeConversation?.id, loadConversations]);

  // FIX 4: Load initial data in separate useEffect
  useEffect(() => {
    if (!user) return;

    loadConversations();
    loadFriends();
    loadFriendRequests();
  }, [user, loadConversations]);

  // Thêm state để quản lý thông báo
  const [notification, setNotification] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({
    show: false,
    message: '',
    type: 'info',
  });

  // Hàm để hiển thị thông báo
  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info'
  ) => {
    setNotification({
      show: true,
      message,
      type,
    });

    // Tự động ẩn thông báo sau 3 giây
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  const loadFriends = async () => {
    try {
      const friendsList = await friendshipService.getFriends();
      setFriends(friendsList);
    } catch (error) {
      toast.error('Failed to load friends');
    }
  };

  const loadFriendRequests = async () => {
    try {
      const requests = await friendshipService.getFriendRequests();
      setFriendRequests(requests);
    } catch (error) {
      toast.error('Failed to load friend requests');
    }
  };  // Enhanced message sending with delivery confirmation system
  const handleSendMessage = async (content: string, messageType?: 'Text' | 'Image' | 'File', file?: File, replyToMessageId?: string) => {
    if (!activeConversation || !user) return;

    // Check if user is blocked or has blocked the recipient
    const recipientId = getRecipient(activeConversation)?.id;
    if (recipientId) {
      const blockStatus = blockStatuses[recipientId];
      if (blockStatus?.isBlocked) {
        toast.error('Bạn không thể gửi tin nhắn. Bạn đã bị chặn bởi người dùng này.');
        return;
      }
      if (blockStatus?.hasBlocked) {
        toast.error('Bạn không thể gửi tin nhắn. Bạn đã chặn người dùng này.');
        return;
      }
    }

    let finalContent = content;
    let finalMessageType = messageType || 'Text';

    // Handle file upload
    if (file && (messageType === 'Image' || messageType === 'File')) {      try {
        // Upload file first with enhanced timeout handling
        const formData = new FormData();
        formData.append('file', file);
        
        // Calculate timeout based on file size (minimum 30s, +10s per MB)
        const timeoutMs = Math.max(30000, 30000 + (file.size / (1024 * 1024)) * 10000);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          try {
          const uploadResponse = await fetch(`${config.api.baseUrl}/api/file/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`File upload failed: ${uploadResponse.status} ${errorText}`);
          }

          const uploadResult = await uploadResponse.json();
          finalContent = uploadResult.url || uploadResult.fileName || uploadResult.filename; // Use uploaded file reference
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            throw new Error(`File upload timed out after ${timeoutMs/1000} seconds. Try a smaller file.`);
          }
          throw fetchError;
        }
      } catch (error: any) {
        console.error('File upload error:', error);
        toast.error(error.message || 'Tải file lên thất bại');
        return;
      }
    }

    // Create temporary message ID for tracking
    const tempMessageId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;    // Create temporary message for optimistic UI with delivery status
    const tempMessage: Message & { deliveryStatus?: 'sending' | 'sent' | 'delivered' | 'failed' } = {
      id: tempMessageId,
      conversationId: activeConversation.id,
      senderId: user.id,
      content: finalContent,
      messageType: finalMessageType,
      sentAt: new Date().toISOString(),
      isRead: false,
      createdAt: '',
      timestamp: '',
      readByRecipient: false,
      deliveryStatus: 'sending',
      replyToMessageId: replyToMessageId,
      replyToMessage: replyToMessageId && replyToMessage ? replyToMessage : undefined
    };

    // Add message to UI immediately with "sending" status
    setMessages((prev) => [...prev, tempMessage]);    try {      // Send via SignalR with delivery confirmation (SignalR also saves to database)
      const result = await signalRService.sendMessageWithConfirmation(
        activeConversation.id, 
        finalContent, 
        finalMessageType,
        tempMessageId,
        replyToMessageId
      );      if (result.delivered) {
        // Update message status to delivered
        setMessages((prev) => 
          prev.map(msg => 
            msg.id === tempMessageId 
              ? { ...msg, deliveryStatus: 'delivered' as const }
              : msg
          )
        );
        console.log('Message delivered immediately via SignalR');
      } else {
        // Update message status to sent (but not yet delivered)
        setMessages((prev) => 
          prev.map(msg => 
            msg.id === tempMessageId 
              ? { ...msg, deliveryStatus: 'sent' as const }
              : msg
          )
        );
        console.log('Message sent but delivery confirmation timed out');
        
        // DON'T fallback to API - SignalR already saved to database
        // Just mark as sent and let SignalR handle the rest
        console.log('Message sent via SignalR, no API fallback needed');
      }

      // Clear reply state after sending (regardless of delivery status)
      if (replyToMessageId && replyToMessage) {
        setReplyToMessage(null);
      }

    } catch (error: any) {
      console.error('Message sending failed:', error);
      
      // Update message status to failed
      setMessages((prev) => 
        prev.map(msg => 
          msg.id === tempMessageId 
            ? { ...msg, deliveryStatus: 'failed' as const }
            : msg
        )
      );

      // Show appropriate error message
      if (error.message?.includes('block')) {
        toast.error('Tin nhắn không thể gửi do cài đặt chặn.');
      } else if (error.message?.includes('connection')) {
        toast.error('Mất kết nối. Đang thử kết nối lại...');
      } else {
        toast.error('Gửi tin nhắn thất bại. Nhấn để thử lại.');
      }
    }
  };

  // Retry failed messages
  const handleRetryMessage = async (messageId: string) => {
    const failedMessage = messages.find(msg => msg.id === messageId);
    if (!failedMessage || !activeConversation) return;

    // Reset message status to sending
    setMessages((prev) => 
      prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, deliveryStatus: 'sending' as const }
          : msg
      )
    );

    try {
      // Retry sending via SignalR with delivery confirmation
      const result = await signalRService.sendMessageWithConfirmation(
        activeConversation.id, 
        failedMessage.content, 
        failedMessage.messageType || 'Text',
        messageId
      );

      if (result.delivered) {
        setMessages((prev) => 
          prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, deliveryStatus: 'delivered' as const }
              : msg
          )
        );
        toast.success('Message resent successfully!');
      } else {
        setMessages((prev) => 
          prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, deliveryStatus: 'sent' as const }
              : msg
          )
        );
      }
    } catch (error: any) {
      console.error('Message retry failed:', error);
      setMessages((prev) => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, deliveryStatus: 'failed' as const }
            : msg
        )
      );
      toast.error('Retry failed. Please try again.');
    }
  };

  // Handle reply functionality
  const handleReply = useCallback((messageId: string) => {
    const messageToReply = messages.find(msg => msg.id === messageId);
    if (messageToReply) {
      setReplyToMessage(messageToReply);
    }
  }, [messages]);

  const handleCancelReply = useCallback(() => {
    setReplyToMessage(null);
  }, []);

  const handleReplyClick = useCallback((message: Message) => {
    // Scroll to the replied message or highlight it
    const messageElement = document.getElementById(`message-${message.id}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.classList.add('highlight-message');
      setTimeout(() => {
        messageElement.classList.remove('highlight-message');
      }, 2000);
    }
  }, []);

  // Handle delete message functionality
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!user) return;

    try {
      // Show confirmation dialog
      if (!window.confirm('Bạn có chắc chắn muốn xóa tin nhắn này không?')) {
        return;
      }

      // Call API to delete message
      await messageService.deleteMessage(messageId);

      // Update local state - mark message as deleted
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { 
              ...msg, 
              content: 'Tin nhắn này đã bị xóa',
              messageType: 'Deleted' as const
            }
          : msg
      ));

      toast.success('Tin nhắn đã được xóa');
    } catch (error: any) {
      console.error('Error deleting message:', error);
      toast.error('Không thể xóa tin nhắn. Vui lòng thử lại.');
    }
  }, [user]);

  const handleTyping = async () => {
    if (!activeConversation) return;
    await signalRService.startTyping(activeConversation.id);
  };

  const handleStartChat = async (friendId: string) => {
    try {
      // Find existing conversation or create new one
      let conversation = conversations.find(
        (conv) =>
          (conv.user1Id === user?.id && conv.user2Id === friendId) ||
          (conv.user1Id === friendId && conv.user2Id === user?.id)
      );

      if (!conversation) {
        conversation = await conversationService.createConversation({ friendId });
        setConversations((prev) => [...prev, conversation!]);
      }

      setActiveConversation(conversation);
      await loadMessages(conversation.id);
      setActiveSection('chats');
    } catch (error) {
      toast.error('Bắt đầu trò chuyện thất bại');
    }
  };

  const handleSendFriendRequest = async (email: string) => {
    try {
      await friendshipService.sendFriendRequest({ email });
      toast.success('Đã gửi lời mời kết bạn!');
    } catch (error) {
      toast.error('Gửi lời mời kết bạn thất bại');
    }
  };

  const handleAcceptFriendRequest = async (requestId: string) => {
    try {
      await friendshipService.acceptFriendRequest(requestId);
      toast.success('Đã chấp nhận lời mời kết bạn!');
      loadFriends();
      loadFriendRequests();
    } catch (error) {
      toast.error('Chấp nhận lời mời kết bạn thất bại');
    }
  };

  const handleDeclineFriendRequest = async (requestId: string) => {
    try {
      await friendshipService.declineFriendRequest(requestId);
      toast.success('Đã từ chối lời mời kết bạn');
      loadFriendRequests();
    } catch (error) {
      toast.error('Từ chối lời mời kết bạn thất bại');
    }
  };
  // Block functionality - ENHANCED ERROR HANDLING
  const loadBlockStatus = useCallback(async () => {
    if (!activeConversation || !user) return;

    const otherUserId =
      activeConversation.user1Id === user.id ? activeConversation.user2Id : activeConversation.user1Id;

    try {
      // Use the more reliable status endpoint instead of is-blocked
      const status = await blockService.getBlockStatus(otherUserId);
      console.log('Block status loaded successfully:', status);
      
      setBlockStatuses((prev) => ({
        ...prev,
        [otherUserId]: status,
      }));
      
      // Also update the direct blockStatus state
      setBlockStatus({
        isBlocked: status.isBlocked || false,
        hasBlocked: status.hasBlocked || false,
      });
        } catch (error: any) {
      console.error('Failed to load block status:', error);
      
      // Set default values on error to prevent UI issues
      const defaultStatus: BlockStatusDto = { 
        blockerUserId: '', 
        blockedUserId: '', 
        status: 'None', 
        createdAt: new Date().toISOString(),
        isBlocked: false, 
        hasBlocked: false 
      };
      setBlockStatuses((prev) => ({
        ...prev,
        [otherUserId]: defaultStatus,
      }));
      setBlockStatus({ isBlocked: false, hasBlocked: false });
      
      // Don't show toast for this error as it's not critical
      console.warn('Block status check failed, using default values');
    }
  }, [activeConversation, user]);

  useEffect(() => {
    if (activeConversation && user) {
      const otherUserId =
        activeConversation.user1Id === user.id ? activeConversation.user2Id : activeConversation.user1Id;
      const fetchBlockStatus = async () => {
        try {
          const status = await blockService.getBlockStatus(otherUserId);
          setBlockStatus(status);
        } catch (error) {
          console.error('Failed to fetch block status:', error);
        }
      };
      fetchBlockStatus();
    }
  }, [activeConversation, user]);

  useEffect(() => {
    if (activeConversation) {
      loadBlockStatus();
    }
  }, [activeConversation]);

  const handleBlockStatusChange = useCallback(
    (isBlocked: boolean, hasBlocked: boolean) => {
      setBlockStatus({ isBlocked, hasBlocked });
      loadBlockStatus();

      // Update SignalR connection
      if (activeConversation && user) {
        const otherUserId =
          activeConversation.user1Id === user.id ? activeConversation.user2Id : activeConversation.user1Id;
        if (hasBlocked) {
          signalRService.notifyUserBlocked(otherUserId);
        } else {
          signalRService.notifyUserUnblocked(otherUserId);
        }
      }
    },
    [loadBlockStatus, activeConversation, user]
  );

  if (!user) return null;

  const getRecipient = (conversation: Conversation): User | undefined => {
    const recipientId = conversation.user1Id === user.id ? conversation.user2Id : conversation.user1Id;
    return users[recipientId];
  };  // FIX 6: Handle conversation selection with proper cleanup
  const handleConversationSelect = async (conversation: Conversation) => {
    // Leave previous conversation room
    if (activeConversation) {
      await signalRService.leaveConversation(activeConversation.id);
    }

    // Clear active group when selecting conversation
    setActiveGroup(null);
    setActiveConversation(conversation);
    setMessages([]); // Clear previous messages
    
    // Reset pagination state
    setConversationPage(1);
    setHasMoreMessages(true);
    setIsLoadingMoreMessages(false);
    
    await loadMessages(conversation.id);

    // Check block status when selecting a conversation
    const recipientId = conversation.user1Id === user.id ? conversation.user2Id : conversation.user1Id;
    if (!blockStatuses[recipientId]) {
      loadBlockStatus();
    }
  };

  // Handle group selection
  const handleGroupSelect = async (group: Group) => {
    // Leave previous conversation room if any
    if (activeConversation) {
      await signalRService.leaveConversation(activeConversation.id);
    }

    // Clear active conversation when selecting group
    setActiveConversation(null);
    setActiveGroup(group);
    setMessages([]); // Clear previous messages
    
    // Join group room (this will be handled by GroupChat component)
    try {
      await signalRService.joinGroup(group.id);
    } catch (error) {
      console.error('Failed to join group room:', error);
    }
  };

  // Handle going back from group chat (for mobile view)
  const handleBackFromGroup = () => {
    setActiveGroup(null);
    if (activeGroup) {
      signalRService.leaveGroup(activeGroup.id);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 via-purple-400/10 to-pink-400/10"></div>

      <div className="relative z-10 flex w-full">
        {/* Sidebar */}
        <Sidebar user={user} activeSection={activeSection} onSectionChange={setActiveSection} onLogout={logout} />

        {/* Main Content */}
        <div className="flex-1 flex">
          {activeSection === 'chats' && (
            <>
              {/* Conversation List */}
              <div className="w-80 bg-white/10 backdrop-blur-md border-r border-white/20">
                <div className="p-4 border-b border-white/20">
                  <h2 className="text-lg font-semibold text-gray-900">Chats</h2>
                </div>
                <div className="overflow-y-auto">
                  {conversations.map((conversation) => {
                    const recipient = getRecipient(conversation);
                    if (!recipient) return null;

                    return (
                      <div
                        key={conversation.id}
                        onClick={() => handleConversationSelect(conversation)}
                        className={`p-4 border-b border-white/10 hover:bg-white/20 cursor-pointer transition-colors ${
                          activeConversation?.id === conversation.id ? 'bg-white/20' : ''
                        }`}
                      >                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <Avatar
                              src={recipient.avatar}
                              alt={recipient.name}
                              size="md"
                            />
                            {onlineUsers.has(recipient.id) && (
                              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <h3 className="font-medium text-gray-900 truncate">{recipient.name}</h3>
                              {blockStatuses[recipient.id]?.hasBlocked && (
                                <span className="text-xs bg-red-100 text-red-600 px-1 rounded">Đã chặn 😼</span>
                              )}
                              {blockStatuses[recipient.id]?.isBlocked && (
                                <span className="text-xs bg-orange-100 text-orange-600 px-1 rounded">Bạn đã chặn 😿</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 truncate">
                              {blockStatuses[recipient.id]?.hasBlocked || blockStatuses[recipient.id]?.isBlocked
                                ? 'Tin nhắn đã bị vô hiệu hóa'
                                : onlineUsers.has(recipient.id)
                                ? 'Đang trực tuyến'
                                : 'Ngoại tuyến'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {conversations.length === 0 && (
                    <div className="p-4 text-center text-gray-500">Chưa có cuộc trò chuyện nào. Hãy bắt đầu trò chuyện với một người bạn!</div>
                  )}
                </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 flex flex-col bg-white">
                {activeConversation ? (
                  <>
                    <ChatHeader
                      conversation={activeConversation}
                      recipient={getRecipient(activeConversation)!}
                      isOnline={onlineUsers.has(getRecipient(activeConversation)?.id || '')}
                      isBlocked={blockStatuses[getRecipient(activeConversation)?.id || '']?.isBlocked || false}
                      hasBlocked={blockStatuses[getRecipient(activeConversation)?.id || '']?.hasBlocked || false}
                      onBlockStatusChange={handleBlockStatusChange}
                      otherUser={getRecipient(activeConversation)!}
                    />                    <MessageList
                      messages={messages}
                      currentUserId={user.id}
                      users={users}
                      typingUsers={typingUsers}
                      onRetryMessage={handleRetryMessage}
                      onLoadMore={loadMoreConversationMessages}
                      hasMoreMessages={hasMoreMessages}
                      isLoadingMore={isLoadingMoreMessages}
                      onDelete={handleDeleteMessage}
                      onReply={handleReply}
                      onReplyClick={handleReplyClick}
                    />                    <MessageInput
                      onSendMessage={handleSendMessage}
                      onTyping={handleTyping}
                      disabled={
                        blockStatuses[getRecipient(activeConversation)?.id || '']?.isBlocked ||
                        blockStatuses[getRecipient(activeConversation)?.id || '']?.hasBlocked ||
                        false
                      }
                      replyToMessage={replyToMessage}
                      onCancelReply={handleCancelReply}
                    />
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-2xl">💬</span>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Chọn một cuộc trò chuyện😼</h3>
                      <p className="text-gray-600">Chọn một cuộc trò chuyện để bắt đầu nhắn tin</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}          {activeSection === 'friends' && (
            <div className="flex-1">
              <FriendList
                friends={friends}
                friendRequests={friendRequests}
                onSendFriendRequest={handleSendFriendRequest}
                onAcceptFriendRequest={handleAcceptFriendRequest}
                onDeclineFriendRequest={handleDeclineFriendRequest}
                onStartChat={handleStartChat}
                currentUserId={user.id}
              />
            </div>
          )}

          {activeSection === 'groups' && (
            <>
              {/* Group List - Mobile: hidden when group is selected, Desktop: always visible */}
              <div className={`w-80 bg-white/10 backdrop-blur-md border-r border-white/20 ${
                activeGroup ? 'hidden md:block' : 'block'
              }`}>
                <GroupList
                  onGroupSelect={handleGroupSelect}
                  selectedGroupId={activeGroup?.id}
                  currentUser={user}
                />
              </div>

              {/* Group Chat Area */}
              <div className="flex-1 flex flex-col">
                {activeGroup ? (
                  <GroupChat
                    group={activeGroup}
                    currentUser={user}
                    onBackClick={handleBackFromGroup}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-2xl">👥</span>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Chọn một nhóm chat</h3>
                      <p className="text-gray-600">Chọn nhóm để bắt đầu trò chuyện hoặc tạo nhóm mới</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {activeSection === 'settings' && (
            <Setting isOpen={activeSection === 'settings'} />
          )}
        </div>
      </div>
    </div>
  );
};