import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { Message, Conversation } from '../types';

class SignalRService {
  onBlockStatusChanged(blockStatusHandler: (userId: string, isBlocked: boolean) => void) {
    throw new Error('Method not implemented.');
  }
  onUserStatusChanged(statusHandler: (userId: string, isOnline: boolean) => void) {
    throw new Error('Method not implemented.');
  }
  onTypingIndicator(typingHandler: (userId: string, conversationId: string, isTyping: boolean) => void) {
    throw new Error('Method not implemented.');
  }
  setOnlineStatus(arg0: boolean) {
    throw new Error('Method not implemented.');
  }
  private connection: HubConnection | null = null;
  private listeners: Map<string, Function[]> = new Map();
  
  async connect(token: string): Promise<void> {
    if (this.connection?.state === 'Connected') {
      return;
    }    this.connection = new HubConnectionBuilder()
      .withUrl('http://localhost:5195/chathub', {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    // Set up event handlers
    this.setupEventHandlers();

    await this.connection.start();
    console.log('SignalR Connected');
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
  }
  private setupEventHandlers(): void {
    if (!this.connection) return;

    this.connection.on('ReceiveMessage', (message: any) => {
    console.log('Nhận tin nhắn mới qua SignalR:', message);
    
    // Emit event để components có thể lắng nghe
    this.emit('messageReceived', message);
  });
  
  // Thêm xử lý khi kết nối bị gián đoạn
  this.connection.onreconnecting(error => {
    console.log('SignalR đang kết nối lại:', error);
  });
  
  this.connection.onreconnected(connectionId => {
    console.log('SignalR đã kết nối lại:', connectionId);
  });

    this.connection.on('ConversationUpdated', (conversation: Conversation) => {
      this.emit('conversationUpdated', conversation);
    });

    this.connection.on('UserOnline', (userId: string) => {
      this.emit('userOnline', userId);
    });

    this.connection.on('UserOffline', (userId: string) => {
      this.emit('userOffline', userId);
    });
    
    // Block related events
    this.connection.on('UserBlocked', (data: any) => {
      this.emit('userBlocked', data);
    });
    
    this.connection.on('UserUnblocked', (data: any) => {
      this.emit('userUnblocked', data);
    });
    
    this.connection.on('MessageError', (errorMessage: string) => {
      this.emit('messageError', errorMessage);
    });

    this.connection.on('UserStartTyping', (data: { conversationId: string; userId: string }) => {
      this.emit('userStartTyping', data);
    });

    this.connection.on('UserStopTyping', (data: { conversationId: string; userId: string }) => {
      this.emit('userStopTyping', data);
    });

    this.connection.on('MessagesMarkedAsRead', (data: { conversationId: string; userId: string }) => {
      this.emit('messagesMarkedAsRead', data);
    });

    this.connection.on('Error', (error: string) => {
      console.error('SignalR Error:', error);
    });

    // Add block event handlers
    this.connection.on('UserBlockedYou', (blockerId: string) => {
      this.notifyListeners('UserBlockedYou', blockerId);
    });
    
    this.connection.on('UserUnblockedYou', (unblockerId: string) => {
      this.notifyListeners('UserUnblockedYou', unblockerId);
    });
  }
  notifyListeners(event: string, data: any): void {
  this.emit(event, data);
}

  // Event management
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
  const handlers = this.listeners.get(event);
  
  if (handlers && handlers.length > 0) {
    console.log(`Emitting event ${event} with data:`, data);
    
    // Gọi tất cả listeners đã đăng ký
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in listener for ${event}:`, error);
      }
    });
  } else {
    console.warn(`Không có listeners cho event: ${event}`);
  }
}

  // Hub methods
  async joinConversation(conversationId: string): Promise<void> {
    if (this.connection?.state === 'Connected') {
      await this.connection.invoke('JoinConversation', conversationId);
    }
  }

  async leaveConversation(conversationId: string): Promise<void> {
    if (this.connection?.state === 'Connected') {
      await this.connection.invoke('LeaveConversation', conversationId);
    }
  }

  async sendMessage(messageDto: any): Promise<void> {
    if (this.connection?.state === 'Connected') {
      await this.connection.invoke('SendMessage', messageDto);
    }
  }

  async startTyping(conversationId: string): Promise<void> {
    if (this.connection?.state === 'Connected') {
      await this.connection.invoke('StartTyping', conversationId);
    }
  }

  async stopTyping(conversationId: string): Promise<void> {
    if (this.connection?.state === 'Connected') {
      await this.connection.invoke('StopTyping', conversationId);
    }
  }

  async markMessagesAsRead(conversationId: string): Promise<void> {
    if (this.connection?.state === 'Connected') {
      await this.connection.invoke('MarkMessagesAsRead', conversationId);
    }
  }

  async joinUserGroup(): Promise<void> {
    if (this.connection?.state === 'Connected') {
      await this.connection.invoke('JoinUserGroup');
    }
  }

  async leaveUserGroup(): Promise<void> {
    if (this.connection?.state === 'Connected') {
      await this.connection.invoke('LeaveUserGroup');
    }
  }

  async notifyUserBlocked(targetUserId: string): Promise<void> {
    if (this.connection?.state === 'Connected') {
      await this.connection.invoke('NotifyUserBlocked', targetUserId);
    }
  }

  async notifyUserUnblocked(targetUserId: string): Promise<void> {
    if (this.connection?.state === 'Connected') {
      await this.connection.invoke('NotifyUserUnblocked', targetUserId);
    }
  }

  get isConnected(): boolean {
    return this.connection?.state === 'Connected';
  }

  // Public methods for components
  async start(): Promise<void> {
  // This will be called after authentication
  // The actual connection is done via connect() method with token
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('Cannot start SignalR: No authentication token found');
      throw new Error('Authentication token not found');
    }

    await this.connect(token);
    console.log('SignalR connection started successfully');
    
    // Automatically join user group after connection
    if (this.isConnected) {
      await this.joinUserGroup();
      console.log('Joined user group for notifications');
    }
  } catch (error) {
    console.error('Failed to start SignalR connection:', error);
    throw error;
  }
}

  async stop(): Promise<void> {
    await this.disconnect();
  }

  offMessageReceived(callback: (message: Message) => void): void {
  this.off('messageReceived', callback);
}
  onMessageReceived(callback: (message: Message) => void): void {
    this.on('messageReceived', callback);
  }

  onTypingStarted(callback: (userId: string, conversationId: string) => void): void {
    this.on('userStartTyping', (data: { userId: string; conversationId: string }) => {
      callback(data.userId, data.conversationId);
    });
  }

  onTypingStopped(callback: (userId: string, conversationId: string) => void): void {
    this.on('userStopTyping', (data: { userId: string; conversationId: string }) => {
      callback(data.userId, data.conversationId);
    });
  }

  onUserOnline(callback: (userId: string) => void): void {
    this.on('userOnline', callback);
  }

  onUserOffline(callback: (userId: string) => void): void {
    this.on('userOffline', callback);
  }
}

export const signalRService = new SignalRService();
