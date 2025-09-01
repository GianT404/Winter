import { HubConnection, HubConnectionBuilder, LogLevel, HubConnectionState, HttpTransportType } from '@microsoft/signalr';
import { Message, Conversation, SendMessageDto, Group } from '../types';
import config from '../config';

// Event handler types
type MessageHandler = (message: Message) => void;
type ConversationHandler = (conversation: Conversation) => void;
type UserStatusHandler = (userId: string, isOnline: boolean) => void;
type TypingHandler = (userId: string, conversationId: string, isTyping: boolean) => void;
type BlockStatusHandler = (userId: string, isBlocked: boolean) => void;
type FriendRequestHandler = (data: { SenderId: string }) => void;
type ErrorHandler = (error: string) => void;
type ConnectionStateHandler = (state: string) => void;
type UnsubscribeFunction = () => void;

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

class SignalRService {
  [x: string]: any;
  private connection: HubConnection | null = null;
  private eventHandlers = new Map<string, Set<Function>>();
  private activeGroups = new Map<string, boolean>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelayMs = 3000;
  private isReconnecting = false;
  private isInitializing = false;
  private debouncedStopTypings = new Map<string, Function>();
  private hasConnectedBefore = false;
  private pendingMessages = new Map<string, { resolve: (value: any) => void; reject: (error: any) => void; timeout: NodeJS.Timeout }>();
  // Calculate retry delay with exponential backoff
  private getRetryDelay(): number {
    const baseDelay = this.reconnectDelayMs;
    const exponentialDelay = baseDelay * Math.pow(1.5, this.reconnectAttempts);
    // Add some jitter to avoid reconnection storms
    return Math.min(exponentialDelay + (Math.random() * 1000), 30000);
  }

  // Create a debounced version of stopTyping for each conversation
  private getDebouncedStopTyping(conversationId: string): Function {
    if (!this.debouncedStopTypings.has(conversationId)) {
      this.debouncedStopTypings.set(
        conversationId,
        debounce((convId: string) => this.stopTyping(convId), 1000)
      );
    }
    return this.debouncedStopTypings.get(conversationId)!;
  }

  // Event subscription methods
  private on<T>(eventName: string, callback: (data: T) => void): UnsubscribeFunction {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, new Set());
    }
    this.eventHandlers.get(eventName)!.add(callback);

    return () => {
      const handlers = this.eventHandlers.get(eventName);
      if (handlers) {
        handlers.delete(callback);
      }
    };
  }

  // Event emission
  private emit<T>(eventName: string, data: T): void {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${eventName}:`, error);
        }      });
    }
  }

  // Handle delivery confirmations from the server
  private setupDeliveryConfirmations(): void {
    if (!this.connection) return;

    this.connection.on('MessageDelivered', (messageId: string) => {
      const pending = this.pendingMessages.get(messageId);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.resolve({ messageId, delivered: true });
        this.pendingMessages.delete(messageId);
      }
      this.emit('messageDelivered', messageId);
    });

    this.connection.on('MessageDeliveryFailed', (messageId: string, error: string) => {
      const pending = this.pendingMessages.get(messageId);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.resolve({ messageId, delivered: false });
        this.pendingMessages.delete(messageId);
      }
      this.emit('messageDeliveryFailed', { messageId, error });
    });
  }
  // Initialize connection with resilience
  async initialize(token?: string): Promise<void> {
    if (this.isInitializing) {
      console.log('SignalR initialization already in progress...');
      return;
    }

    if (this.connection?.state === HubConnectionState.Connected) {
      console.log('SignalR already connected');
      return;
    }

    this.isInitializing = true;
    console.log('Initializing SignalR connection...');

    try {
      // Get token from parameter or localStorage
      const storedToken = token || localStorage.getItem('token');
      if (!storedToken) {
        throw new Error('No authentication token available');
      }

      // Stop existing connection if any
      if (this.connection) {
        await this.connection.stop();
        this.connection = null;
      }

      // Determine server URL with fallback options
      const port = process.env.REACT_APP_SERVER_PORT || '5195';
      const serverUrl = `http://${window.location.hostname}:${port}/chathub`;
      console.log('Connecting to SignalR hub at:', serverUrl);      // Create new connection with enhanced timeout settings
      this.connection = new HubConnectionBuilder()
        .withUrl(serverUrl, {
          accessTokenFactory: () => storedToken,
          transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling,
          skipNegotiation: false,
          withCredentials: false,
          timeout: 30000, // 30 second timeout for connection
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            // Enhanced exponential backoff with jitter
            const baseDelay = Math.min(
              this.reconnectDelayMs * Math.pow(1.5, retryContext.previousRetryCount),
              30000 // Max 30 seconds
            );
            const jitter = Math.random() * 2000; // 0-2 second jitter
            return baseDelay + jitter;
          }
        })
        .configureLogging(LogLevel.Information)
        .build();

      // Set up event handlers BEFORE starting connection
      this.setupConnectionEvents();
      this.setupHubEventHandlers();

      // Enhanced connection startup with multiple timeout attempts
      const connectionPromise = this.connection.start();
      const timeoutDuration = this.reconnectAttempts > 0 ? 30000 : 15000; // Longer timeout on retries
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error(`Connection timeout after ${timeoutDuration/1000} seconds`)), timeoutDuration);
      });
      
      await Promise.race([connectionPromise, timeoutPromise]);
      
      console.log('SignalR Connected successfully');
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.hasConnectedBefore = true;
      
      // Emit connection state change
      this.emit('connectionStateChanged', 'Connected');
      this.emit('connectionChange', { isConnected: true });

      // Rejoin active groups
      if (this.activeGroups.size > 0) {
        await this.rejoinActiveGroups();
      }

      // Join user group for notifications
      await this.joinUserGroup();
      
    } catch (error) {
      console.error('Failed to initialize SignalR connection:', error);
      this.connection = null;
      this.emit('connectionStateChanged', 'Disconnected');
      this.emit('connectionChange', { isConnected: false });
      this.emit('connectionFailed', error instanceof Error ? error.message : 'Unknown error');

      // Retry connection after delay if not too many attempts
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delayMs = this.getRetryDelay();
        console.log(`Retrying connection in ${delayMs/1000} seconds... (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
        setTimeout(() => {
          this.reconnectAttempts++;
          this.initialize(token);
        }, delayMs);
      }
    } finally {
      this.isInitializing = false;
    }
  }

  // Simplified start method
  async start(token?: string): Promise<void> {
    await this.initialize(token);
    
  }

  // Connection events setup
  private setupConnectionEvents(): void {
    if (!this.connection) return;

    this.connection.onreconnecting((error) => {
      console.log('SignalR reconnecting...', error);
      this.isReconnecting = true;
      this.emit('connectionStateChanged', 'Reconnecting');
      this.emit('connectionChange', { isConnected: false });
    });

    this.connection.onreconnected(async () => {
      console.log('SignalR reconnected');
      this.isReconnecting = false;
      this.reconnectAttempts = 0;
      
      this.emit('connectionStateChanged', 'Connected');
      this.emit('connectionChange', { isConnected: true });
      
      // Rejoin groups and user group after reconnection
      await this.rejoinActiveGroups();
      await this.joinUserGroup();
    });

    this.connection.onclose((error) => {
      console.log('SignalR connection closed', error);
      this.emit('connectionStateChanged', 'Disconnected');
      this.emit('connectionChange', { isConnected: false });
      
      // Attempt manual reconnection if not already reconnecting
      if (!this.isReconnecting && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.attemptReconnection();
      }
    });
  }

  // Set up all event handlers from the SignalR hub
  private setupHubEventHandlers(): void {
    if (!this.connection) return;    // Clear existing handlers to prevent duplicates
    this.connection.off('ReceiveMessage');
    this.connection.off('MessageError');
    this.connection.off('MessageDelivered');
    this.connection.off('MessageDeliveryFailed');
    this.connection.off('ConversationUpdated');
    this.connection.off('UserOnline');
    this.connection.off('UserOffline');
    this.connection.off('UserStartTyping');
    this.connection.off('UserStopTyping');
    this.connection.off('MessagesMarkedAsRead');
    this.connection.off('UserBlocked');
    this.connection.off('UserUnblocked');
    this.connection.off('UserBlockedYou');
    this.connection.off('UserUnblockedYou');
    this.connection.off('FriendRequestReceived');
    this.connection.off('Error');
    
    // Group-specific events
    this.connection.off('ReceiveGroupMessage');
    this.connection.off('GroupUpdated');
    this.connection.off('UserJoinedGroup');
    this.connection.off('UserLeftGroup');
    this.connection.off('GroupMemberRoleChanged');
    this.connection.off('UserStartGroupTyping');
    this.connection.off('UserStopGroupTyping');
    this.connection.off('GroupMessagesMarkedAsRead');

    // Message events
    this.connection.on('ReceiveMessage', (message: Message) => {
      console.log('Real-time message received:', message);
      this.emit('messageReceived', message);
    });

    // Message delivery confirmation events
    this.connection.on('MessageDelivered', (messageId: string) => {
      console.log('Message delivery confirmed:', messageId);
      const pending = this.pendingMessages.get(messageId);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.resolve({ messageId, delivered: true });
        this.pendingMessages.delete(messageId);
      }
      this.emit('messageDelivered', messageId);
    });

    this.connection.on('MessageDeliveryFailed', (messageId: string, error: string) => {
      console.log('Message delivery failed:', messageId, error);
      const pending = this.pendingMessages.get(messageId);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.reject(new Error(error));
        this.pendingMessages.delete(messageId);
      }
      this.emit('messageDeliveryFailed', { messageId, error });
    });

    this.connection.on('MessageError', (error: string) => {
      console.error('Message Error:', error);
      this.emit('messageError', error);
    });

    // Conversation events
    this.connection.on('ConversationUpdated', (conversation: Conversation) => {
      console.log('Conversation updated:', conversation);
      this.emit('conversationUpdated', conversation);
    });

    // User status events
    this.connection.on('UserOnline', (userId: string) => {
      console.log('User online:', userId);
      this.emit('userOnline', userId);
    });

    this.connection.on('UserOffline', (userId: string) => {
      console.log('User offline:', userId);
      this.emit('userOffline', userId);
    });

    // Typing indicator events
    this.connection.on('UserStartTyping', (data: { conversationId: string; userId: string }) => {
      console.log('User started typing:', data);
      this.emit('userStartTyping', data);
    });

    this.connection.on('UserStopTyping', (data: { conversationId: string; userId: string }) => {
      console.log('User stopped typing:', data);
      this.emit('userStopTyping', data);
    });

    // Message read status
    this.connection.on('MessagesMarkedAsRead', (data: { conversationId: string; userId: string }) => {
      console.log('Messages marked as read:', data);
      this.emit('messagesRead', data);
    });

    // Block status events
    this.connection.on('UserBlocked', (data: { blockerId: string; blockedUserId: string }) => {
      console.log('User blocked:', data);
      this.emit('userBlocked', data);
    });

    this.connection.on('UserUnblocked', (data: { unblockerId: string; unblockedUserId: string }) => {
      console.log('User unblocked:', data);
      this.emit('userUnblocked', data);
    });

    this.connection.on('UserBlockedYou', (blockerId: string) => {
      console.log('You were blocked by:', blockerId);
      this.emit('userBlockedYou', blockerId);
    });

    this.connection.on('UserUnblockedYou', (unblockerId: string) => {
      console.log('You were unblocked by:', unblockerId);
      this.emit('userUnblockedYou', unblockerId);
    });

    // Friend request event
    this.connection.on('FriendRequestReceived', (data: { SenderId: string }) => {
      console.log('Friend request received from:', data.SenderId);
      this.emit('friendRequestReceived', data);
    });    // General error event
    this.connection.on('Error', (error: string) => {
      console.error('SignalR Hub Error:', error);
      this.emit('error', error);
    });    // Group message events
    this.connection.on('ReceiveGroupMessage', (message: Message) => {
      console.log('Real-time group message received:', message);
      this.emit('groupMessageReceived', message);
    });

    // Group update events
    this.connection.on('GroupUpdated', (group: Group) => {
      console.log('Group updated:', group);
      this.emit('groupUpdated', group);
    });

    // Group membership events
    this.connection.on('UserJoinedGroup', (data: { groupId: string; userId: string; userName: string }) => {
      console.log('User joined group:', data);
      this.emit('userJoinedGroup', data);
    });

    this.connection.on('UserLeftGroup', (data: { groupId: string; userId: string; userName: string }) => {
      console.log('User left group:', data);
      this.emit('userLeftGroup', data);
    });

    this.connection.on('GroupMemberRoleChanged', (data: { groupId: string; userId: string; newRole: string }) => {
      console.log('Group member role changed:', data);
      this.emit('groupMemberRoleChanged', data);
    });

    // Group typing indicator events
    this.connection.on('UserStartGroupTyping', (data: { groupId: string; userId: string; userName: string }) => {
      console.log('User started typing in group:', data);
      this.emit('userStartGroupTyping', data);
    });

    this.connection.on('UserStopGroupTyping', (data: { groupId: string; userId: string; userName: string }) => {
      console.log('User stopped typing in group:', data);
      this.emit('userStopGroupTyping', data);
    });

    // Group message read status
    this.connection.on('GroupMessagesMarkedAsRead', (data: { groupId: string; userId: string }) => {
      console.log('Group messages marked as read:', data);
      this.emit('groupMessagesRead', data);
    });
  }

  // Manual reconnection with exponential backoff
  private async attemptReconnection(): Promise<void> {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) return;
    
    this.reconnectAttempts++;
    this.isReconnecting = true;
    
    console.log(`Attempting manual reconnection... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    try {
      const delayMs = this.getRetryDelay();
      await new Promise(resolve => setTimeout(resolve, delayMs));
      await this.initialize();
    } catch (error) {
      console.error('Reconnection attempt failed:', error);
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => this.attemptReconnection(), this.reconnectDelayMs);
      } else {
        console.error('Max reconnection attempts reached');
        this.emit('reconnectionFailed', null);
      }
    } finally {
      this.isReconnecting = false;
    }
  }
  // Rejoin all active groups after reconnection
  private async rejoinActiveGroups(): Promise<void> {
    console.log('Rejoining active groups:', Array.from(this.activeGroups.keys()));
    for (const [groupKey] of this.activeGroups) {
      try {
        if (this.connection?.state === HubConnectionState.Connected) {
          // Check if it's a conversation or group
          if (groupKey.startsWith('group_')) {
            // It's a group - use the key as is
            await this.connection.invoke('JoinGroup', groupKey);
            console.log(`Rejoined group: ${groupKey}`);
          } else {
            // It's a conversation - add conversation_ prefix
            await this.connection.invoke('JoinGroup', `conversation_${groupKey}`);
            console.log(`Rejoined conversation: ${groupKey}`);
          }
        }
      } catch (error) {
        console.error(`Failed to rejoin group ${groupKey}:`, error);
      }
    }
  }

  // Stop connection
  async stop(): Promise<void> {
    try {
      if (this.connection) {
        await this.connection.stop();
        console.log('SignalR connection stopped');
      }
    } catch (error) {
      console.error('Error stopping SignalR connection:', error);
    } finally {
      this.connection = null;
      this.activeGroups.clear();
      this.eventHandlers.clear();
      this.debouncedStopTypings.clear();
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
    }
  }

  // Disconnect - alias for stop for backward compatibility
  async disconnect(): Promise<void> {
    return this.stop();
  }

  // Public API: Check connection state
  isConnected(): boolean {
    return this.connection?.state === HubConnectionState.Connected;
  }

  // Public API: Check if initialization is in progress
  isConnectionInitializing(): boolean {
    return this.isInitializing;
  }

  // Public API: Get connection state as string
  get connectionState(): string {
    return this.connection?.state.toString() || 'Disconnected';
  }

  // Public API: Join a conversation group
  async joinConversation(conversationId: string): Promise<void> {
    try {
      // Ensure connection is ready
      if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
        await this.initialize();
      }

      if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
        throw new Error('SignalR connection not available');
      }

      await this.connection.invoke('JoinGroup', `conversation_${conversationId}`);
      this.activeGroups.set(conversationId, true);
      console.log(`Joined conversation: ${conversationId}`);
    } catch (error) {
      console.error(`Error joining conversation ${conversationId}:`, error);
      throw error;
    }
  }
  // Public API: Leave a conversation group
  async leaveConversation(conversationId: string): Promise<void> {
    try {
      if (this.connection && this.connection.state === HubConnectionState.Connected) {
        await this.connection.invoke('LeaveGroup', `conversation_${conversationId}`);
        this.activeGroups.delete(conversationId);
        this.debouncedStopTypings.delete(conversationId);
        console.log(`Left conversation: ${conversationId}`);
      }
    } catch (error) {
      console.error(`Error leaving conversation ${conversationId}:`, error);
    }
  }

  // Public API: Join a group
  async joinGroup(groupId: string): Promise<void> {
    try {
      // Ensure connection is ready
      if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
        await this.initialize();
      }

      if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
        throw new Error('SignalR connection not available');
      }

      await this.connection.invoke('JoinGroup', `group_${groupId}`);
      this.activeGroups.set(`group_${groupId}`, true);
      console.log(`Joined group: ${groupId}`);
    } catch (error) {
      console.error(`Error joining group ${groupId}:`, error);
      throw error;
    }
  }

  // Public API: Leave a group
  async leaveGroup(groupId: string): Promise<void> {
    try {
      if (this.connection && this.connection.state === HubConnectionState.Connected) {
        await this.connection.invoke('LeaveGroup', `group_${groupId}`);
        this.activeGroups.delete(`group_${groupId}`);
        this.debouncedStopTypings.delete(`group_${groupId}`);
        console.log(`Left group: ${groupId}`);
      }
    } catch (error) {
      console.error(`Error leaving group ${groupId}:`, error);
    }
  }

  // Public API: Send a group message
  async sendGroupMessage(groupId: string, content: string, messageType: string = 'Text'): Promise<void> {
    try {
      // Ensure connection is ready
      if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
        throw new Error('SignalR connection not available. Please wait for connection.');
      }

      // Make sure we're in the group
      if (!this.activeGroups.has(`group_${groupId}`)) {
        await this.joinGroup(groupId);
      }      const messageDto: SendMessageDto = {
        groupId,
        content,
        messageType
      };

      // Send the message through SignalR hub
      await this.connection.invoke('SendMessage', messageDto);
      console.log(`Group message sent via SignalR to group: ${groupId}`);
      
      // Auto-stop typing after sending a message
      await this.stopGroupTyping(groupId);
    } catch (error) {
      console.error(`Error sending group message to ${groupId}:`, error);
      this.emit('messageError', 'Could not send group message. Please check your connection and try again.');
      throw error;
    }
  }
  // Enhanced group message sending with delivery confirmation
  async sendGroupMessageWithConfirmation(groupId: string, content: string, messageType: string = 'Text', tempId?: string): Promise<{ messageId: string; delivered: boolean }> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      throw new Error('SignalR connection not available. Please wait for connection.');
    }

    try {
      // Make sure we're in the group
      if (!this.activeGroups.has(`group_${groupId}`)) {
        await this.joinGroup(groupId);
      }

      // Create a promise that resolves when the message is confirmed delivered
      const deliveryPromise = new Promise<{ messageId: string; delivered: boolean }>((resolve, reject) => {
        const messageId = tempId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Set up timeout for delivery confirmation
        const timeout = setTimeout(() => {
          this.pendingMessages.delete(messageId);
          resolve({ messageId, delivered: false });
        }, 5000); // 5 second timeout
        
        this.pendingMessages.set(messageId, { resolve, reject, timeout });
        
        const messageDto: SendMessageDto = {
          groupId,
          content,
          messageType
        };

        // Send the message
        this.connection!.invoke('SendMessage', messageDto)
          .catch((error) => {
            clearTimeout(timeout);
            this.pendingMessages.delete(messageId);
            reject(error);
          });
      });

      // Auto-stop typing after sending a message
      await this.stopGroupTyping(groupId);

      return await deliveryPromise;
    } catch (error) {
      console.error('Error sending group message with confirmation:', error);
      throw error;
    }
  }

  // Public API: Start typing indicator in group
  async startGroupTyping(groupId: string): Promise<void> {
    try {
      if (this.connection && this.connection.state === HubConnectionState.Connected) {
        await this.connection.invoke('StartTypingInGroup', groupId);
        console.log(`Started typing in group: ${groupId}`);
        
        // Auto-stop typing after 1 second of inactivity
        this.getDebouncedStopTyping(`group_${groupId}`)(`group_${groupId}`);
      }
    } catch (error) {
      console.error(`Error starting typing indicator in group ${groupId}:`, error);
    }
  }
  // Public API: Stop typing indicator in group
  async stopGroupTyping(groupId: string): Promise<void> {
    try {
      if (this.connection && this.connection.state === HubConnectionState.Connected) {
        await this.connection.invoke('StopTypingInGroup', groupId);
        console.log(`Stopped typing in group: ${groupId}`);
      }
    } catch (error) {
      console.error('Error stopping group typing indicator:', error);
    }
  }

  // Public API: Mark group messages as read
  async markGroupMessagesAsRead(groupId: string): Promise<void> {
    try {
      if (this.connection && this.connection.state === HubConnectionState.Connected) {
        await this.connection.invoke('MarkGroupMessagesAsRead', groupId);
        console.log(`Marked group messages as read in group: ${groupId}`);
      }
    } catch (error) {
      console.error('Error marking group messages as read:', error);
    }
  }
  // Public API: Send a message with delivery confirmation
  async sendMessage(conversationId: string, content: string, messageType: string = 'Text'): Promise<void> {
    try {
      // Ensure connection is ready
      if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
        throw new Error('SignalR connection not available. Please wait for connection.');
      }

      // Make sure we're in the conversation group
      if (!this.activeGroups.has(conversationId)) {
        await this.joinConversation(conversationId);
      }

      const messageDto: SendMessageDto = {
        conversationId,
        content,
        messageType
      };

      // Send the message through SignalR hub
      await this.connection.invoke('SendMessage', messageDto);
      console.log(`Message sent via SignalR to conversation: ${conversationId}`);
      
      // Auto-stop typing after sending a message
      await this.stopTyping(conversationId);
    } catch (error) {
      console.error(`Error sending message to ${conversationId}:`, error);
      this.emit('messageError', 'Could not send message. Please check your connection and try again.');
      throw error;
    }
  }

  // Enhanced message sending with delivery confirmation
  async sendMessageWithConfirmation(conversationId: string, content: string, messageType: string = 'Text', tempId?: string, replyToMessageId?: string): Promise<{ messageId: string; delivered: boolean }> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      throw new Error('SignalR connection not available. Please wait for connection.');
    }

    try {
      // Make sure we're in the conversation group
      if (!this.activeGroups.has(conversationId)) {
        await this.joinConversation(conversationId);
      }

      // Create a promise that resolves when the message is confirmed delivered
      const deliveryPromise = new Promise<{ messageId: string; delivered: boolean }>((resolve, reject) => {
        const messageId = tempId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Set up timeout for delivery confirmation
        const timeout = setTimeout(() => {
          this.pendingMessages.delete(messageId);
          resolve({ messageId, delivered: false });
        }, 5000); // 5 second timeout
          this.pendingMessages.set(messageId, { resolve, reject, timeout });
        
        const messageDto: SendMessageDto = {
          conversationId,
          content,
          messageType,
          replyToMessageId
        };

        // Send the message
        this.connection!.invoke('SendMessage', messageDto)
          .catch((error) => {
            clearTimeout(timeout);
            this.pendingMessages.delete(messageId);
            reject(error);
          });
      });

      // Auto-stop typing after sending a message
      await this.stopTyping(conversationId);

      return await deliveryPromise;
    } catch (error) {
      console.error('Error sending message with confirmation:', error);
      throw error;
    }
  }

  // Public API: Start typing indicator
  async startTyping(conversationId: string): Promise<void> {
    try {
      if (this.connection && this.connection.state === HubConnectionState.Connected) {
        await this.connection.invoke('StartTyping', conversationId);
        console.log(`Started typing in conversation: ${conversationId}`);
        
        // Auto-stop typing after 1 second of inactivity
        this.getDebouncedStopTyping(conversationId)(conversationId);
      }
    } catch (error) {
      console.error(`Error starting typing indicator in ${conversationId}:`, error);
    }
  }

  // Public API: Stop typing indicator
  async stopTyping(conversationId: string): Promise<void> {
    try {
      if (this.connection && this.connection.state === HubConnectionState.Connected) {
        await this.connection.invoke('StopTyping', conversationId);
        console.log(`Stopped typing in conversation: ${conversationId}`);
      }
    } catch (error) {
      console.error('Error stopping typing indicator:', error);
    }
  }

  // Public API: Mark messages as read
  async markMessagesAsRead(conversationId: string): Promise<void> {
    try {
      if (this.connection && this.connection.state === HubConnectionState.Connected) {
        await this.connection.invoke('MarkMessagesAsRead', conversationId);
        console.log(`Marked messages as read in conversation: ${conversationId}`);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  // Public API: Join user group for notifications
  async joinUserGroup(): Promise<void> {
    try {
      if (this.connection && this.connection.state === HubConnectionState.Connected) {
        await this.connection.invoke('JoinUserGroup');
        console.log('Joined user group for notifications');
      }
    } catch (error) {
      console.error('Error joining user group:', error);
    }
  }

  // Public API: Leave user group
  async leaveUserGroup(): Promise<void> {
    try {
      if (this.connection && this.connection.state === HubConnectionState.Connected) {
        await this.connection.invoke('LeaveUserGroup');
        console.log('Left user group');
      }
    } catch (error) {
      console.error('Error leaving user group:', error);
    }
  }  // Public API: Notify when a user is blocked
  async notifyUserBlocked(targetUserId: string): Promise<void> {
    try {
      if (this.connection && this.connection.state === HubConnectionState.Connected) {
        // Fixed to match backend method signature: NotifyUserBlocked(targetUserId)
        await this.connection.invoke('NotifyUserBlocked', targetUserId);
        console.log(`Notified that user ${targetUserId} is blocked`);
      }
    } catch (error) {
      console.error('Error notifying user blocked:', error);
      // Don't throw error to prevent blocking the UI
    }
  }

  // Public API: Notify when a user is unblocked
  async notifyUserUnblocked(targetUserId: string): Promise<void> {
    try {
      if (this.connection && this.connection.state === HubConnectionState.Connected) {
        await this.connection.invoke('NotifyUserUnblocked', targetUserId);
        console.log(`Notified that user ${targetUserId} is unblocked`);
      }
    } catch (error) {
      console.error('Error notifying user unblocked:', error);
    }
  }

  // Public event subscription methods
  onMessageReceived(handler: MessageHandler): UnsubscribeFunction {
    return this.on<Message>('messageReceived', handler);
  }

  onConversationUpdated(handler: ConversationHandler): UnsubscribeFunction {
    return this.on<Conversation>('conversationUpdated', handler);
  }

  onUserStatusChanged(handler: UserStatusHandler): UnsubscribeFunction {
    const unsubscribeOnline = this.on<string>('userOnline', (userId: string) => 
      handler(userId, true));
    
    const unsubscribeOffline = this.on<string>('userOffline', (userId: string) => 
      handler(userId, false));
    
    return () => {
      unsubscribeOnline();
      unsubscribeOffline();
    };
  }

  onTypingIndicator(handler: TypingHandler): UnsubscribeFunction {
    const unsubscribeStart = this.on<{ userId: string; conversationId: string }>('userStartTyping', 
      (data) => handler(data.userId, data.conversationId, true));
    
    const unsubscribeStop = this.on<{ userId: string; conversationId: string }>('userStopTyping', 
      (data) => handler(data.userId, data.conversationId, false));
    
    return () => {
      unsubscribeStart();
      unsubscribeStop();
    };
  }

  onBlockStatusChanged(handler: BlockStatusHandler): UnsubscribeFunction {
    const unsubscribeBlocked = this.on<{ blockerId: string; blockedUserId: string }>('userBlocked', 
      (data) => handler(data.blockedUserId, true));
    
    const unsubscribeUnblocked = this.on<{ unblockerId: string; unblockedUserId: string }>('userUnblocked', 
      (data) => handler(data.unblockedUserId, false));
    
    return () => {
      unsubscribeBlocked();
      unsubscribeUnblocked();
    };
  }

  onFriendRequestReceived(handler: FriendRequestHandler): UnsubscribeFunction {
    return this.on<{ SenderId: string }>('friendRequestReceived', handler);
  }

  onMessageError(handler: ErrorHandler): UnsubscribeFunction {
    return this.on<string>('messageError', handler);
  }

  onConnectionStateChanged(handler: ConnectionStateHandler): UnsubscribeFunction {
    const unsubscribeStateChanged = this.on<string>('connectionStateChanged', handler);
    const unsubscribeConnectionChange = this.on<{ isConnected: boolean }>('connectionChange', 
      (data) => handler(data.isConnected ? 'Connected' : 'Disconnected'));
    
    // Call immediately with current state
    setTimeout(() => handler(this.connectionState), 0);
      return () => {
      unsubscribeStateChanged();
      unsubscribeConnectionChange();
    };
  }

  // Additional method to listen for connection changes
  onConnectionChange(handler: (data: { isConnected: boolean }) => void): UnsubscribeFunction {
    return this.on<{ isConnected: boolean }>('connectionChange', handler);
  }
  // Delivery confirmation event handlers
  onDeliveryConfirmation(handler: (messageId: string) => void): UnsubscribeFunction {
    return this.on<string>('messageDelivered', handler);
  }
  
  // Alias for onDeliveryConfirmation
  onMessageDelivered(handler: (messageId: string) => void): UnsubscribeFunction {
    return this.onDeliveryConfirmation(handler);
  }
  
  onDeliveryFailure(handler: (messageId: string, error: string) => void): UnsubscribeFunction {
    return this.on<{ messageId: string; error: string }>('messageDeliveryFailed', 
      (data) => handler(data.messageId, data.error));
  }
  // Group event subscription methods
  onGroupMessageReceived(handler: (message: Message) => void): UnsubscribeFunction {
    return this.on<Message>('groupMessageReceived', handler);
  }

  onGroupUpdated(handler: (group: Group) => void): UnsubscribeFunction {
    return this.on<Group>('groupUpdated', handler);
  }

  onUserJoinedGroup(handler: (data: { groupId: string; userId: string; userName: string }) => void): UnsubscribeFunction {
    return this.on<{ groupId: string; userId: string; userName: string }>('userJoinedGroup', handler);
  }

  onUserLeftGroup(handler: (data: { groupId: string; userId: string; userName: string }) => void): UnsubscribeFunction {
    return this.on<{ groupId: string; userId: string; userName: string }>('userLeftGroup', handler);
  }

  onGroupMemberRoleChanged(handler: (data: { groupId: string; userId: string; newRole: string }) => void): UnsubscribeFunction {
    return this.on<{ groupId: string; userId: string; newRole: string }>('groupMemberRoleChanged', handler);
  }

  onGroupTypingIndicator(handler: (data: { groupId: string; userId: string; userName: string; isTyping: boolean }) => void): UnsubscribeFunction {
    const unsubscribeStart = this.on<{ groupId: string; userId: string; userName: string }>('userStartGroupTyping', 
      (data) => handler({ ...data, isTyping: true }));
    
    const unsubscribeStop = this.on<{ groupId: string; userId: string; userName: string }>('userStopGroupTyping', 
      (data) => handler({ ...data, isTyping: false }));
    
    return () => {
      unsubscribeStart();
      unsubscribeStop();
    };
  }

  onGroupMessagesRead(handler: (data: { groupId: string; userId: string }) => void): UnsubscribeFunction {
    return this.on<{ groupId: string; userId: string }>('groupMessagesRead', handler);
  }

  // Set online status (mostly for compatibility)
  setOnlineStatus(isOnline: boolean): void {
    console.log(`Online status: ${isOnline}`);
    // Actual online status is handled by the server based on connection
  }
}

// Export singleton instance
const signalRService = new SignalRService();
export { signalRService };
export default signalRService;