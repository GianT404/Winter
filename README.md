# WinterX - Real-time Chat Application

## Overview

WinterX is a modern real-time chat application built with ASP.NET Core, React, and SignalR. It provides a seamless, performant messaging experience with features like instant messaging, group chats, user management, and real-time notifications.

## Core Features

### 1. Real-time Messaging
- Instant message delivery using SignalR
- Message delivery status (sending, sent, delivered, failed)
- Message retry mechanism
- Reply to messages
- Delete messages
- File sharing support (images, documents)

### 2. User Management
- User registration and authentication
- User profiles with avatars
- Friend system with friend requests
- Online/offline status indicators
- User blocking functionality
- Privacy settings

### 3. Group Chat
- Create and manage group chats
- Public and private groups
- Group member management
- Group avatars and descriptions
- Member roles and permissions

### 4. Performance Optimizations
- Instant message display (12 most recent messages)
- Message caching system
- Virtual list for efficient message rendering
- Background message refresh
- Duplicate message prevention
- Optimized API calls

## Technical Stack

### Backend (BA)
- ASP.NET Core 9.0
- Entity Framework Core
- SQL Server
- SignalR for real-time communications
- JWT Authentication
- Repository pattern
- Clean Architecture principles

### Frontend (fe)
- React 18
- TypeScript
- TailwindCSS for styling
- SignalR client
- React hooks for state management
- Custom hooks for optimized data handling
- Virtual scrolling for performance

## Performance Features

1. **Optimized Message Loading**
   - Instant display of recent messages
   - Background loading of older messages
   - Virtual list implementation
   - Message caching system

2. **Duplicate Prevention**
   - SignalR message deduplication
   - Optimistic updates with confirmation
   - Cache synchronization
   - Reload handling

3. **Real-time Updates**
   - Typing indicators
   - Online status updates
   - Message delivery status
   - Block status notifications

## Security Features

1. **User Authentication**
   - JWT token-based auth
   - Secure password hashing
   - Token refresh mechanism
   - Session management

2. **Privacy**
   - User blocking capability
   - Private/public group options
   - Message deletion
   - Profile privacy settings

## API Structure

### Authentication Endpoints
- POST `/api/auth/register`
- POST `/api/auth/login`
- POST `/api/auth/refresh-token`

### User Endpoints
- GET `/api/user/profile`
- PUT `/api/user/profile`
- GET `/api/user/{id}`

### Message Endpoints
- GET `/api/message/{conversationId}`
- POST `/api/message`
- DELETE `/api/message/{id}`

### Group Endpoints
- POST `/api/group`
- GET `/api/group/{id}`
- PUT `/api/group/{id}`
- DELETE `/api/group/{id}`

### Block Endpoints
- POST `/api/block/block`
- POST `/api/block/unblock`
- GET `/api/block/status/{userId}`

## Installation

1. **Backend Setup**
```bash
cd BA
dotnet restore
dotnet run
```

2. **Frontend Setup**
```bash
cd fe
npm install
npm start
```

3. **Database Setup**
- Update connection string in `appsettings.json`
- Run migrations:
```bash
dotnet ef database update
```

## Development Guidelines

1. **Code Style**
- Use TypeScript for frontend
- Follow C# coding conventions
- Use async/await for asynchronous operations
- Implement proper error handling

2. **Performance**
- Implement caching where appropriate
- Use virtual lists for large datasets
- Optimize API calls
- Monitor SignalR connections

3. **Testing**
- Unit tests for critical components
- Integration tests for API endpoints
- Performance testing for real-time features

## Recent Optimizations

1. **Message Loading Speed**
- Implemented instant message display
- Added message caching
- Optimized virtual list rendering

2. **Duplicate Message Prevention**
- Enhanced SignalR message handling
- Improved optimistic updates
- Fixed reload-related duplicates

3. **Block User Functionality**
- Fixed 500 Internal Server Error
- Improved error handling
- Enhanced status synchronization

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to your branch
5. Create a Pull Request

## Project Status

- ✅ Core chat functionality complete
- ✅ Group chat implementation
- ✅ Message optimizations
- ✅ Block user fixes
- 🚧 Additional features in development

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

© 2025 WinterX. Created with ❤️ by GianT404
