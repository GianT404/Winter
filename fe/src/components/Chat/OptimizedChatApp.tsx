import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Conversation, Message, Friendship, BlockStatusDto, Group } from '../../types';
import { Sidebar } from '../Layout/Sidebar';
import { ChatHeader } from '../Chat/ChatHeader';
import { SuperOptimizedMessageList } from '../Chat/SuperOptimizedMessageList';
import { MessageInput } from '../Chat/MessageInput';
import { FriendList } from '../Friends/FriendList';
import { GroupList } from '../Groups/GroupList';
import { GroupChat } from '../Groups/GroupChat';
import Avatar from '../UI/Avatar';
import { useAuth } from '../../hooks/useAuth';
import { useOptimizedMessages } from '../../hooks/useOptimizedMessages';
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

export const OptimizedChatApp: React.FC = () => {
  const { user, logout } = useAuth();

  const [activeSection, setActiveSection] = useState<'chats' | 'friends' | 'groups' | 'settings'>('chats');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
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

  // Use optimized message hook
  const {
    messages,
    isLoading: isLoadingMessages,
    isLoadingMore: isLoadingMoreMessages,
    hasMoreOlder,
    error: messagesError,
    loadOlderMessages,
    addRealtimeMessage,
    updateMessage,
    removeMessage,
    refresh: refreshMessages,
    clearMessages  } = useOptimizedMessages({
    conversationId: activeConversation?.id,
    groupId: activeGroup?.id,
    pageSize: 12, // Giảm xuống 12 tin nhắn để load nhanh hơn
    autoLoadInitial: true
  });

  const loadConversations = useCallback(async () => {
    try {
      const fetchedConversations = await conversationService.getConversations();
      setConversations(fetchedConversations);
      
      // Create users map from conversations
      const usersMap: Record<string, User> = {};
      fetchedConversations.forEach(conv => {
        if (conv.user1) usersMap[conv.user1.id] = conv.user1;
        if (conv.user2) usersMap[conv.user2.id] = conv.user2;
      });
      
      setUsers(prev => ({ ...prev, ...usersMap }));
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast.error('Failed to load conversations');
    }
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      const fetchedFriends = await friendshipService.getFriends();
      setFriends(fetchedFriends);
      
      // Add friends to users map
      const usersMap: Record<string, User> = {};
      fetchedFriends.forEach(friend => {
        usersMap[friend.id] = friend;
      });
      setUsers(prev => ({ ...prev, ...usersMap }));
    } catch (error) {
      console.error('Error loading friends:', error);
      toast.error('Failed to load friends');
    }
  }, []);

  const loadFriendRequests = useCallback(async () => {
    try {
      const requests = await friendshipService.getFriendRequests();
      setFriendRequests(requests);
    } catch (error) {
      console.error('Error loading friend requests:', error);
    }
  }, []);

  const loadBlockStatus = useCallback(async () => {
    if (!activeConversation || !user) return;

    const otherUserId = activeConversation.user1Id === user.id 
      ? activeConversation.user2Id 
      : activeConversation.user1Id;

    try {
      const status = await blockService.getBlockStatus(otherUserId);
      setBlockStatus({
        isBlocked: status.isBlocked,
        hasBlocked: status.hasBlocked,
      });
      
      // Store in cache for quick access
      setBlockStatuses(prev => ({
        ...prev,
        [otherUserId]: status
      }));
    } catch (error) {
      console.error('Error loading block status:', error);
      // Set default values if API fails
      setBlockStatus({ isBlocked: false, hasBlocked: false });
    }
  }, [activeConversation, user]);

  // Memoized other user for current conversation
  const otherUser = useMemo(() => {
    if (!activeConversation || !user) return null;
    const otherUserId = activeConversation.user1Id === user.id 
      ? activeConversation.user2Id 
      : activeConversation.user1Id;
    return users[otherUserId] || null;
  }, [activeConversation, user, users]);
  // Handle conversation selection - OPTIMIZED for instant display
  const handleSelectConversation = useCallback(async (conversation: Conversation) => {
    if (activeConversation?.id === conversation.id) return;
    
    // KHÔNG clear messages ngay lập tức, để useOptimizedMessages tự handle cache
    setActiveConversation(conversation);
    setActiveGroup(null);
    setReplyToMessage(null);
    setTypingUsers([]);
    
    // Load block status for this conversation - check cache first
    if (user) {
      const otherUserId = conversation.user1Id === user.id 
        ? conversation.user2Id 
        : conversation.user1Id;
      
      // Check cache first để hiển thị ngay lập tức
      const cachedStatus = blockStatuses[otherUserId];
      if (cachedStatus) {
        setBlockStatus({
          isBlocked: cachedStatus.isBlocked,
          hasBlocked: cachedStatus.hasBlocked,
        });
      } else {
        // Load trong background
        loadBlockStatus();
      }
    }

    // Join SignalR group for this conversation
    if (conversation.id) {
      try {
        await signalRService.joinConversation(conversation.id);
      } catch (error) {
        console.error('Error joining conversation:', error);
      }
    }
  }, [activeConversation, user, blockStatuses, loadBlockStatus]);

  // Handle group selection
  const handleSelectGroup = useCallback(async (group: Group) => {
    if (activeGroup?.id === group.id) return;
    
    clearMessages();
    setActiveGroup(group);
    setActiveConversation(null);
    setReplyToMessage(null);
    setTypingUsers([]);
    
    // Join SignalR group
    if (group.id) {
      try {
        await signalRService.joinGroup(group.id);
      } catch (error) {
        console.error('Error joining group:', error);
      }
    }
  }, [activeGroup, clearMessages]);
  // Handle friend request actions
  const handleSendFriendRequest = useCallback(async (email: string) => {
    try {
      await friendshipService.sendFriendRequest({ email });
      // Optionally show success message
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  }, []);

  const handleAcceptFriendRequest = useCallback(async (requestId: string) => {
    try {
      await friendshipService.acceptFriendRequest(requestId);
      loadFriends();
      loadFriendRequests();
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  }, [loadFriends, loadFriendRequests]);

  const handleDeclineFriendRequest = useCallback(async (requestId: string) => {
    try {
      await friendshipService.declineFriendRequest(requestId);
      loadFriendRequests();
    } catch (error) {
      console.error('Error declining friend request:', error);
    }
  }, [loadFriendRequests]);

  const handleSelectFriend = useCallback(async (userId: string) => {
    if (!user) return;
    
    // Create or find conversation with this friend
    try {
      const conversations = await conversationService.getConversations();
      const existingConversation = conversations.find((c: Conversation) => 
        (c.user1Id === user.id && c.user2Id === userId) ||
        (c.user2Id === user.id && c.user1Id === userId)
      );
      
      if (existingConversation) {
        handleSelectConversation(existingConversation);
      } else {
        // Create new conversation
        const newConversation = await conversationService.createConversation({ friendId: userId });
        handleSelectConversation(newConversation);
      }
      setActiveSection('chats');
    } catch (error) {
      console.error('Error creating conversation with friend:', error);
    }
  }, [user, handleSelectConversation]);

  // Handle sending messages
  const handleSendMessage = useCallback(async (content: string, messageType: 'Text' | 'Image' | 'File' = 'Text') => {
    if (!user || (!activeConversation && !activeGroup)) return;

    // Check if blocked
    if (activeConversation && blockStatus.isBlocked) {
      toast.error('You cannot send messages to this user');
      return;
    }

    if (activeConversation && blockStatus.hasBlocked) {
      toast.error('You have blocked this user. Unblock them to send messages');
      return;
    }

    try {
      const messageData = {
        content,
        messageType,
        conversationId: activeConversation?.id,
        groupId: activeGroup?.id,
        replyToMessageId: replyToMessage?.id,
      };      // Send message via API
      const sentMessage = await messageService.sendMessage(messageData);
      
      // Add to local state immediately (optimistic update) - ONLY for sender
      addRealtimeMessage(sentMessage);
      
      // Clear reply state
      setReplyToMessage(null);
      
      // Send via SignalR for real-time delivery to OTHER participants
      // Note: We DON'T need to send back to ourselves since we already have optimistic update
      if (activeConversation) {
        await signalRService.sendMessage(activeConversation.id, sentMessage.content, sentMessage.messageType);
      } else if (activeGroup) {
        await signalRService.sendGroupMessage(activeGroup.id, sentMessage.content, sentMessage.messageType);
      }

    } catch (error: any) {
      console.error('Error sending message:', error);
      
      if (error.message?.includes('blocked')) {
        toast.error('Cannot send message: User has blocked you');
      } else {
        toast.error('Failed to send message');
      }
    }
  }, [user, activeConversation, activeGroup, blockStatus, replyToMessage, addRealtimeMessage]);

  // Handle message reactions and actions
  const handleRetryMessage = useCallback(async (messageId: string) => {
    try {
      // Find the failed message and retry sending
      const message = messages.find(m => m.id === messageId);
      if (!message) return;

      await handleSendMessage(message.content, message.messageType as any);
      removeMessage(messageId);
    } catch (error) {
      console.error('Error retrying message:', error);
      toast.error('Failed to retry message');
    }
  }, [messages, handleSendMessage, removeMessage]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      await messageService.deleteMessage(messageId);
      removeMessage(messageId);
      toast.success('Message deleted');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  }, [removeMessage]);

  const handleReply = useCallback((messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      setReplyToMessage(message);
    }
  }, [messages]);

  const handleReplyClick = useCallback((message: Message) => {
    // Scroll to the original message
    // Implementation depends on your virtualization setup
    console.log('Navigate to message:', message.id);
  }, []);

  // Initialize SignalR and load data
  useEffect(() => {
    if (!user) return;

    const initializeApp = async () => {
      try {
        // Start SignalR connection
        await signalRService.start();

        // Load initial data
        await Promise.all([
          loadConversations(),
          loadFriends(),
          loadFriendRequests(),
        ]);        // Set up SignalR event handlers
        signalRService.onMessageReceived((message: Message) => {
          // Check if message belongs to current conversation/group
          if (
            (activeConversation && message.conversationId === activeConversation.id) ||
            (activeGroup && message.groupId === activeGroup.id)
          ) {
            // ENHANCED: Skip if this is our own message that we just sent (optimistic update already added it)
            // This prevents duplicate when sender receives their own message back from server
            if (user && message.senderId === user.id) {
              // Check if we recently sent a similar message (within 10 seconds)
              const now = new Date().getTime();
              const messageTime = new Date(message.timestamp).getTime();
              if (Math.abs(now - messageTime) < 10000) {
                console.log('Skipping own message from SignalR (already added via optimistic update)');
                return;
              }
            }
            
            addRealtimeMessage(message);
          }
        });

        signalRService.onUserStatusChanged((userId: string, isOnline: boolean) => {
          setOnlineUsers(prev => {
            const newSet = new Set(prev);
            if (isOnline) {
              newSet.add(userId);
            } else {
              newSet.delete(userId);
            }
            return newSet;
          });
        });

        signalRService.onTypingIndicator((userId: string, conversationId: string, isTyping: boolean) => {
          if (conversationId === activeConversation?.id) {
            setTypingUsers(prev => {
              if (isTyping) {
                return prev.includes(userId) ? prev : [...prev, userId];
              } else {
                return prev.filter(id => id !== userId);
              }
            });
          }
        });

      } catch (error) {
        console.error('Error initializing app:', error);
        toast.error('Failed to connect to chat service');
      }
    };

    initializeApp();

    return () => {
      signalRService.stop();
    };
  }, [user, activeConversation, activeGroup, loadConversations, loadFriends, loadFriendRequests, addRealtimeMessage]);

  // Load block status when active conversation changes
  useEffect(() => {
    if (activeConversation && user) {
      loadBlockStatus();
    }
  }, [activeConversation, user, loadBlockStatus]);

  // Show error message if messages failed to load
  useEffect(() => {
    if (messagesError) {
      toast.error(messagesError);
    }
  }, [messagesError]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Avatar src={user.avatar} alt={user.name} size="md" />
                <div>
                  <h2 className="font-semibold text-gray-900">{user.name}</h2>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </div>
            <Setting isOpen={activeSection === 'settings'} onClose={() => setActiveSection('chats')} />
          </div>
        </div>        <Sidebar
          user={user}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          onLogout={logout}
        />
      </div>      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeSection === 'chats' && (activeConversation || activeGroup) ? (
          <>
            {/* Chat Header */}
            {activeConversation && otherUser && (
              <ChatHeader
                conversation={activeConversation}
                otherUser={otherUser}
                recipient={otherUser}
                isOnline={onlineUsers.has(otherUser.id)}
                isBlocked={blockStatus.isBlocked}
                hasBlocked={blockStatus.hasBlocked}
                onBlockStatusChange={(isBlocked, hasBlocked) => {
                  setBlockStatus({ isBlocked, hasBlocked });
                  const blockStatusDto: BlockStatusDto = {
                    blockerUserId: user.id,
                    blockedUserId: otherUser.id,
                    isBlocked,
                    hasBlocked,
                    status: 'Active',
                    createdAt: new Date().toISOString()
                  };
                  setBlockStatuses(prev => ({
                    ...prev,
                    [otherUser.id]: blockStatusDto
                  }));
                }}
              />
            )}

            {/* Messages List with Optimized Loading */}
            <SuperOptimizedMessageList
              messages={messages}
              currentUserId={user.id}
              users={users}
              typingUsers={typingUsers}
              onRetryMessage={handleRetryMessage}
              onLoadMore={loadOlderMessages}
              hasMoreMessages={hasMoreOlder}
              isLoadingMore={isLoadingMoreMessages}
              onDelete={handleDeleteMessage}
              onReply={handleReply}
              onReplyClick={handleReplyClick}
            />            {/* Message Input */}
            <MessageInput
              onSendMessage={handleSendMessage}
              onTyping={() => {}} // Add empty typing handler if needed
              disabled={blockStatus.isBlocked || blockStatus.hasBlocked}
              replyToMessage={replyToMessage}
              onCancelReply={() => setReplyToMessage(null)}
            />
          </>        ) : activeSection === 'friends' ? (
          <FriendList
            friends={friends}
            friendRequests={friendRequests}
            onSendFriendRequest={handleSendFriendRequest}
            onAcceptFriendRequest={handleAcceptFriendRequest}
            onDeclineFriendRequest={handleDeclineFriendRequest}
            onStartChat={handleSelectFriend}
            currentUserId={user.id}
          />        ) : activeSection === 'groups' ? (
          <GroupList
            onGroupSelect={handleSelectGroup}
            selectedGroupId={activeGroup?.id}
            currentUser={user}
          />
        ) : activeSection === 'settings' ? (
          <Setting isOpen={activeSection === 'settings'} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="text-xl font-medium text-gray-900 mb-2">Welcome to WinterX Chat</h3>
              <p className="text-gray-600">Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
