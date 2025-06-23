using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using BA.Services;
using BA.Data;
using BA.Models;
using BA.DTOs;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;

namespace BA.Hubs
{    [Authorize]
    public class ChatHub : Hub
    {
        private readonly IBlockService _blockService;
        private readonly IMessageService _messageService;
        private readonly IUserService _userService;

        public ChatHub(IBlockService blockService, IMessageService messageService, IUserService userService)
        {
            _blockService = blockService;
            _messageService = messageService;
            _userService = userService;
        }

        public async Task JoinGroup(string groupName)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        }

        public async Task LeaveGroup(string groupName)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        }

        public async Task SendMessageToGroup(string groupName, string message)
        {
            var currentUserId = GetCurrentUserId();
            
            // Extract target user ID from group name (assuming format like "conversation_{userId1}_{userId2}")
            var userIds = ExtractUserIdsFromGroupName(groupName);
            if (userIds != null)
            {
                var targetUserId = userIds.FirstOrDefault(id => id != currentUserId);
                if (targetUserId != Guid.Empty)
                {                    // Check block status between users
                    var blockStatus = await _blockService.GetBlockStatusAsync(currentUserId, targetUserId);
                    if (blockStatus.IsBlocked)
                    {
                        // Send specific error when user is blocked by recipient
                        await Clients.Caller.SendAsync("MessageError", "You have been blocked by this user");
                        return;
                    }
                    
                    if (blockStatus.HasBlocked)
                    {
                        // Send specific error when user has blocked the recipient
                        await Clients.Caller.SendAsync("MessageError", "You have blocked this user. Unblock them to send messages");
                        return;
                    }
                }
            }

            await Clients.Group(groupName).SendAsync("ReceiveMessage", Context.User?.Identity?.Name, message);
        }        /// <summary>
        /// Send block notification to other user in realtime
        /// </summary>
        public async Task NotifyUserBlocked(string targetUserId)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                var targetUserGroup = $"user_{targetUserId}";
                var blockerUserId = Context.UserIdentifier;
                if (string.IsNullOrEmpty(blockerUserId))
                    return;

                await Clients.Group(targetUserGroup).SendAsync("UserBlocked", new
                {
                    blockedBy = currentUserId.ToString(),
                    timestamp = DateTime.UtcNow
                });
                // Send notification to the blocked user
                await Clients.User(targetUserId).SendAsync("UserBlockedYou", currentUserId.ToString());
            }
            catch (Exception ex)
            {
                // Log error but don't throw to prevent SignalR connection issues
                Console.WriteLine($"Error in NotifyUserBlocked: {ex.Message}");
            }
        }

        /// <summary>
        /// Join user-specific group for receiving notifications
        /// </summary>
        public async Task JoinUserGroup()
        {
            var currentUserId = GetCurrentUserId();
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{currentUserId}");
        }

        /// <summary>
        /// Leave user-specific group
        /// </summary>
        public async Task LeaveUserGroup()
        {
            var currentUserId = GetCurrentUserId();
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{currentUserId}");
        }        public override async Task OnConnectedAsync()
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                
                // Set user as online in the database
                await _userService.SetUserOnlineStatusAsync(currentUserId, true);
                
                // Automatically join user-specific group on connection
                await JoinUserGroup();
                
                // Broadcast to all other users that this user is now online
                await Clients.Others.SendAsync("UserOnline", new
                {
                    userId = currentUserId.ToString(),
                    timestamp = DateTime.UtcNow
                });
                
                await base.OnConnectedAsync();
            }
            catch (Exception ex)
            {
                // Log the exception but don't throw to avoid breaking the connection
                Console.Error.WriteLine($"Error in OnConnectedAsync: {ex.Message}");
                await base.OnConnectedAsync();
            }
        }        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                
                // Set user as offline in the database
                await _userService.SetUserOnlineStatusAsync(currentUserId, false);
                
                // Leave user-specific group on disconnection
                await LeaveUserGroup();
                
                // Broadcast to all other users that this user is now offline
                await Clients.Others.SendAsync("UserOffline", new
                {
                    userId = currentUserId.ToString(),
                    timestamp = DateTime.UtcNow
                });
                
                await base.OnDisconnectedAsync(exception);
            }
            catch (Exception ex)
            {
                // Log the exception but don't throw to avoid breaking the disconnection
                Console.Error.WriteLine($"Error in OnDisconnectedAsync: {ex.Message}");
                await base.OnDisconnectedAsync(exception);
            }
        }

        private Guid GetCurrentUserId()
        {
            var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null)
            {
                throw new UnauthorizedAccessException("User ID not found in token");
            }
            return Guid.Parse(userIdClaim.Value);
        }

        private List<Guid>? ExtractUserIdsFromGroupName(string groupName)
        {
            try
            {
                // Assuming group name format: "conversation_{userId1}_{userId2}"
                var parts = groupName.Split('_');
                if (parts.Length >= 3 && parts[0] == "conversation")
                {
                    var userIds = new List<Guid>();
                    for (int i = 1; i < parts.Length; i++)
                    {
                        if (Guid.TryParse(parts[i], out var userId))
                        {
                            userIds.Add(userId);
                        }
                    }
                    return userIds.Count >= 2 ? userIds : null;
                }
            }
            catch
            {
                // Return null if parsing fails
            }
            return null;
        }        public async Task SendMessage(SendMessageDto messageDto)
        {
            var currentUserId = GetCurrentUserId();
            
            // Check if this is a conversation or group message
            if (messageDto.ConversationId.HasValue)
            {
                // Handle conversation message
                await HandleConversationMessage(messageDto, currentUserId);
            }
            else if (messageDto.GroupId.HasValue)
            {
                // Handle group message
                await HandleGroupMessage(messageDto, currentUserId);
            }
            else
            {
                await Clients.Caller.SendAsync("MessageError", "Either ConversationId or GroupId must be specified");
            }
        }        private async Task HandleConversationMessage(SendMessageDto messageDto, Guid currentUserId)
        {
            var conversationId = messageDto.ConversationId!.Value;
            
            // Get conversation participants
            var conversation = await GetConversationParticipantsAsync(conversationId);
            if (conversation == null)
            {
                await Clients.Caller.SendAsync("MessageError", "Invalid conversation");
                return;
            }
            
            if (conversation.Value.User1Id != currentUserId && conversation.Value.User2Id != currentUserId)
            {
                await Clients.Caller.SendAsync("MessageError", "You are not a participant in this conversation");
                return;
            }
            
            // Determine the recipient
            var recipientId = conversation.Value.User1Id == currentUserId ? conversation.Value.User2Id : conversation.Value.User1Id;
                    
            // Check block status between users
            var blockStatus = await _blockService.GetBlockStatusAsync(currentUserId, recipientId);
            if (blockStatus.IsBlocked)
            {
                await Clients.Caller.SendAsync("MessageError", "You have been blocked by this user and cannot send messages");
                return;
            }
            
            if (blockStatus.HasBlocked)
            {
                await Clients.Caller.SendAsync("MessageError", "You have blocked this user. Unblock them to send messages");
                return;
            }
            
            try
            {
                // Save the message to database using MessageService
                var savedMessage = await _messageService.SendMessageAsync(currentUserId, messageDto);
                
                // Format group name for the conversation
                string groupName = $"conversation_{conversationId}";                // Create the message object that matches the frontend Message type
                var messageToSend = new
                {
                    id = savedMessage.Id,
                    conversationId = savedMessage.ConversationId,
                    senderId = savedMessage.SenderId,
                    content = savedMessage.Content,
                    messageType = savedMessage.MessageType,
                    sentAt = savedMessage.SentAt.ToString("o"),
                    isRead = savedMessage.IsRead,
                    createdAt = savedMessage.SentAt.ToString("o"),
                    timestamp = savedMessage.SentAt.ToString("o"),
                    readByRecipient = false,
                    sender = savedMessage.Sender,
                    replyToMessageId = savedMessage.ReplyToMessageId,
                    replyToMessage = savedMessage.ReplyToMessage
                };
                
                // Notify ONLY OTHER clients in the conversation group (exclude sender to prevent duplicates)
                await Clients.GroupExcept(groupName, Context.ConnectionId).SendAsync("ReceiveMessage", messageToSend);
                
                // Send delivery confirmation to the sender
                await Clients.Caller.SendAsync("MessageDelivered", savedMessage.Id);
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("MessageError", $"Failed to send message: {ex.Message}");
            }
        }        private async Task HandleGroupMessage(SendMessageDto messageDto, Guid currentUserId)
        {
            var groupId = messageDto.GroupId!.Value;
            
            // Verify user is a member of the group
            var groupMembership = await GetGroupMembershipAsync(groupId, currentUserId);
            if (groupMembership == null)
            {
                await Clients.Caller.SendAsync("MessageError", "You are not a member of this group");
                return;
            }
            
            try
            {
                // Save the message to database using MessageService
                var savedMessage = await _messageService.SendMessageAsync(currentUserId, messageDto);
                
                // Format group name for SignalR groups
                string signalRGroupName = $"group_{groupId}";
                  // Create the message object for group messages
                var messageToSend = new
                {
                    id = savedMessage.Id,
                    groupId = savedMessage.GroupId,
                    senderId = savedMessage.SenderId,
                    content = savedMessage.Content,
                    messageType = savedMessage.MessageType,
                    sentAt = savedMessage.SentAt.ToString("o"),
                    isRead = savedMessage.IsRead,
                    createdAt = savedMessage.SentAt.ToString("o"),
                    timestamp = savedMessage.SentAt.ToString("o"),
                    sender = savedMessage.Sender,
                    replyToMessageId = savedMessage.ReplyToMessageId,
                    replyToMessage = savedMessage.ReplyToMessage
                };
                  // Notify ONLY OTHER clients in the group (exclude sender to prevent duplicates)
                await Clients.GroupExcept(signalRGroupName, Context.ConnectionId).SendAsync("ReceiveGroupMessage", messageToSend);
                
                // Send delivery confirmation to the sender
                await Clients.Caller.SendAsync("MessageDelivered", savedMessage.Id);
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("MessageError", $"Failed to send group message: {ex.Message}");
            }
        }private async Task<(Guid User1Id, Guid User2Id)?> GetConversationParticipantsAsync(Guid conversationId)
        {
            try
            {
                using var scope = Context.GetHttpContext()?.RequestServices.CreateScope();
                if (scope == null) return null;
                
                var dbContext = scope.ServiceProvider.GetRequiredService<ChatDbContext>();
                
                var conversation = await dbContext.Conversations
                    .FirstOrDefaultAsync(c => c.Id == conversationId);
                    
                if (conversation != null)
                {
                    return (conversation.User1Id, conversation.User2Id);
                }
            }
            catch (Exception ex)
            {
                // Log the exception
                Console.Error.WriteLine($"Error getting conversation participants: {ex.Message}");
            }
            
            return null;
        }

        private async Task<GroupMember?> GetGroupMembershipAsync(Guid groupId, Guid userId)
        {
            try
            {
                using var scope = Context.GetHttpContext()?.RequestServices.CreateScope();
                if (scope == null) return null;
                
                var dbContext = scope.ServiceProvider.GetRequiredService<ChatDbContext>();
                
                var membership = await dbContext.GroupMembers
                    .FirstOrDefaultAsync(gm => gm.GroupId == groupId && gm.UserId == userId);
                    
                return membership;
            }
            catch (Exception ex)
            {
                // Log the exception
                Console.Error.WriteLine($"Error getting group membership: {ex.Message}");
            }
            
            return null;
        }
          /// <summary>
        /// Join a specific conversation for receiving messages
        /// </summary>
        public async Task JoinConversation(string conversationId)
        {
            var currentUserId = GetCurrentUserId();
            
            // Create the group name for the conversation
            var groupName = $"conversation_{conversationId}";
            
            // Join the group
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        }
        
        /// <summary>
        /// Leave a specific conversation
        /// </summary>
        public async Task LeaveConversation(string conversationId)
        {
            var groupName = $"conversation_{conversationId}";
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        }

        /// <summary>
        /// Join a specific group for receiving messages
        /// </summary>
        public async Task JoinChatGroup(string groupId)
        {
            var currentUserId = GetCurrentUserId();
            
            // Verify user is a member of the group
            if (Guid.TryParse(groupId, out var parsedGroupId))
            {
                var membership = await GetGroupMembershipAsync(parsedGroupId, currentUserId);
                if (membership != null)
                {
                    var signalRGroupName = $"group_{groupId}";
                    await Groups.AddToGroupAsync(Context.ConnectionId, signalRGroupName);
                }
            }
        }
        
        /// <summary>
        /// Leave a specific group
        /// </summary>
        public async Task LeaveChatGroup(string groupId)
        {
            var signalRGroupName = $"group_{groupId}";
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, signalRGroupName);
        }

        /// <summary>
        /// Notify group members when a user joins the group
        /// </summary>
        public async Task NotifyGroupMemberAdded(string groupId, string newMemberId, string newMemberName)
        {
            var signalRGroupName = $"group_{groupId}";
            await Clients.Group(signalRGroupName).SendAsync("GroupMemberAdded", new
            {
                groupId,
                userId = newMemberId,
                userName = newMemberName,
                timestamp = DateTime.UtcNow
            });
        }

        /// <summary>
        /// Notify group members when a user leaves the group
        /// </summary>
        public async Task NotifyGroupMemberRemoved(string groupId, string removedMemberId, string removedMemberName)
        {
            var signalRGroupName = $"group_{groupId}";
            await Clients.Group(signalRGroupName).SendAsync("GroupMemberRemoved", new
            {
                groupId,
                userId = removedMemberId,
                userName = removedMemberName,
                timestamp = DateTime.UtcNow
            });
        }

        /// <summary>
        /// Notify group members when group details are updated
        /// </summary>
        public async Task NotifyGroupUpdated(string groupId, object groupDetails)
        {
            var signalRGroupName = $"group_{groupId}";
            await Clients.Group(signalRGroupName).SendAsync("GroupUpdated", new
            {
                groupId,
                details = groupDetails,
                timestamp = DateTime.UtcNow
            });
        }
          /// <summary>
        /// Notify others that user started typing
        /// </summary>
        public async Task StartTyping(string conversationId)
        {
            var currentUserId = GetCurrentUserId();
            var groupName = $"conversation_{conversationId}";
            
            await Clients.GroupExcept(groupName, Context.ConnectionId).SendAsync(
                "UserStartTyping", 
                new { userId = currentUserId.ToString(), conversationId }
            );
        }
        
        /// <summary>
        /// Notify others that user stopped typing
        /// </summary>
        public async Task StopTyping(string conversationId)
        {
            var currentUserId = GetCurrentUserId();
            var groupName = $"conversation_{conversationId}";
            
            await Clients.GroupExcept(groupName, Context.ConnectionId).SendAsync(
                "UserStopTyping", 
                new { userId = currentUserId.ToString(), conversationId }
            );
        }

        /// <summary>
        /// Notify group members that user started typing in group
        /// </summary>
        public async Task StartTypingInGroup(string groupId)
        {
            var currentUserId = GetCurrentUserId();
            var signalRGroupName = $"group_{groupId}";
            
            await Clients.GroupExcept(signalRGroupName, Context.ConnectionId).SendAsync(
                "UserStartTypingInGroup", 
                new { userId = currentUserId.ToString(), groupId }
            );
        }
        
        /// <summary>
        /// Notify group members that user stopped typing in group
        /// </summary>
        public async Task StopTypingInGroup(string groupId)
        {
            var currentUserId = GetCurrentUserId();
            var signalRGroupName = $"group_{groupId}";
            
            await Clients.GroupExcept(signalRGroupName, Context.ConnectionId).SendAsync(
                "UserStopTypingInGroup", 
                new { userId = currentUserId.ToString(), groupId }
            );
        }
        
        /// <summary>
        /// Mark all messages in a conversation as read
        /// </summary>
        public async Task MarkMessagesAsRead(string conversationId)
        {
            var currentUserId = GetCurrentUserId();
            var groupName = $"conversation_{conversationId}";
            
            await Clients.GroupExcept(groupName, Context.ConnectionId).SendAsync(
                "MessagesMarkedAsRead", 
                new { conversationId, userId = currentUserId.ToString() }
            );
        }

        /// <summary>
        /// Mark all messages in a group as read
        /// </summary>
        public async Task MarkGroupMessagesAsRead(string groupId)
        {
            var currentUserId = GetCurrentUserId();
            var signalRGroupName = $"group_{groupId}";
            
            await Clients.GroupExcept(signalRGroupName, Context.ConnectionId).SendAsync(
                "GroupMessagesMarkedAsRead", 
                new { groupId, userId = currentUserId.ToString() }
            );
        }
    }
}