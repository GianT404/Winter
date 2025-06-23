using Microsoft.EntityFrameworkCore;
using BA.Data;
using BA.Models;
using BA.DTOs;

namespace BA.Services;

public interface IMessageService
{
    Task<MessageDto> SendMessageAsync(Guid senderId, SendMessageDto sendMessageDto);
    Task<IEnumerable<MessageDto>> GetConversationMessagesAsync(Guid conversationId, Guid userId, int page = 1, int pageSize = 50);
    Task<IEnumerable<MessageDto>> GetGroupMessagesAsync(Guid groupId, Guid userId, int page = 1, int pageSize = 50);
    
    // New optimized methods with cursor-based pagination
    Task<PaginatedMessageDto> GetConversationMessagesPaginatedAsync(Guid conversationId, Guid userId, MessagePaginationDto pagination);
    Task<PaginatedMessageDto> GetGroupMessagesPaginatedAsync(Guid groupId, Guid userId, MessagePaginationDto pagination);
    
    Task<bool> MarkMessagesAsReadAsync(Guid conversationId, Guid userId);
    Task<bool> MarkGroupMessagesAsReadAsync(Guid groupId, Guid userId);
    Task<bool> DeleteMessageAsync(Guid messageId, Guid userId);
}

public class MessageService : IMessageService
{
    private readonly ChatDbContext _context;
    private readonly IBlockService _blockService;

    public MessageService(ChatDbContext context, IBlockService blockService)
    {
        _context = context;
        _blockService = blockService;
    }    public async Task<MessageDto> SendMessageAsync(Guid senderId, SendMessageDto sendMessageDto)
    {
        // Validate that either ConversationId or GroupId is set, but not both
        if ((sendMessageDto.ConversationId == null && sendMessageDto.GroupId == null) ||
            (sendMessageDto.ConversationId != null && sendMessageDto.GroupId != null))
        {
            throw new ArgumentException("Either ConversationId or GroupId must be set, but not both");
        }

        Message message;

        if (sendMessageDto.ConversationId != null)
        {
            // Handle conversation message
            var conversation = await _context.Conversations
                .FirstOrDefaultAsync(c => c.Id == sendMessageDto.ConversationId 
                                       && (c.User1Id == senderId || c.User2Id == senderId));

            if (conversation == null)
                throw new UnauthorizedAccessException("User is not part of this conversation");

            // Get the other user in the conversation
            var otherUserId = conversation.User1Id == senderId ? conversation.User2Id : conversation.User1Id;

            // Check if either user has blocked the other
            var blockStatus = await _blockService.GetBlockStatusAsync(senderId, otherUserId);
            
            if (blockStatus.IsBlocked)
            {
                throw new InvalidOperationException("You have been blocked by this user and cannot send messages");
            }
            
            if (blockStatus.HasBlocked)
            {
                throw new InvalidOperationException("You have blocked this user. Unblock them to send messages");
            }            message = new Message
            {
                ConversationId = sendMessageDto.ConversationId,
                SenderId = senderId,
                Content = sendMessageDto.Content,
                MessageType = sendMessageDto.MessageType,
                ReplyToMessageId = sendMessageDto.ReplyToMessageId
            };

            // Update conversation's UpdatedAt
            conversation.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            // Handle group message
            var groupMember = await _context.GroupMembers
                .Include(gm => gm.Group)
                .FirstOrDefaultAsync(gm => gm.GroupId == sendMessageDto.GroupId && gm.UserId == senderId);

            if (groupMember == null)
                throw new UnauthorizedAccessException("User is not a member of this group");            message = new Message
            {
                GroupId = sendMessageDto.GroupId,
                SenderId = senderId,
                Content = sendMessageDto.Content,
                MessageType = sendMessageDto.MessageType,
                ReplyToMessageId = sendMessageDto.ReplyToMessageId
            };

            // Update group's UpdatedAt
            groupMember.Group.UpdatedAt = DateTime.UtcNow;
        }

        _context.Messages.Add(message);        await _context.SaveChangesAsync();

        // Reload with sender information
        var savedMessage = await _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.ReplyToMessage)
            .ThenInclude(rm => rm != null ? rm.Sender : null)
            .FirstAsync(m => m.Id == message.Id);

        return MapToDto(savedMessage);
    }

    public async Task<IEnumerable<MessageDto>> GetConversationMessagesAsync(Guid conversationId, Guid userId, int page = 1, int pageSize = 50)
    {
        // Verify user is part of the conversation
        var conversation = await _context.Conversations
            .FirstOrDefaultAsync(c => c.Id == conversationId 
                                   && (c.User1Id == userId || c.User2Id == userId));

        if (conversation == null)
            return new List<MessageDto>();        var messages = await _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.ReplyToMessage)
            .ThenInclude(rm => rm != null ? rm.Sender : null)
            .Where(m => m.ConversationId == conversationId)
            .OrderByDescending(m => m.SentAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return messages.Select(MapToDto).Reverse();
    }

    public async Task<bool> MarkMessagesAsReadAsync(Guid conversationId, Guid userId)
    {
        // Verify user is part of the conversation
        var conversation = await _context.Conversations
            .FirstOrDefaultAsync(c => c.Id == conversationId 
                                   && (c.User1Id == userId || c.User2Id == userId));

        if (conversation == null) return false;

        var unreadMessages = await _context.Messages
            .Where(m => m.ConversationId == conversationId 
                      && m.SenderId != userId 
                      && !m.IsRead)
            .ToListAsync();

        foreach (var message in unreadMessages)
        {
            message.IsRead = true;
        }        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<IEnumerable<MessageDto>> GetGroupMessagesAsync(Guid groupId, Guid userId, int page = 1, int pageSize = 50)
    {
        // Verify user is member of the group
        var groupMember = await _context.GroupMembers
            .FirstOrDefaultAsync(gm => gm.GroupId == groupId && gm.UserId == userId);

        if (groupMember == null)
            return new List<MessageDto>();        var messages = await _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.ReplyToMessage)
            .ThenInclude(rm => rm != null ? rm.Sender : null)
            .Where(m => m.GroupId == groupId)
            .OrderByDescending(m => m.SentAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return messages.Select(MapToDto).Reverse();
    }

    public async Task<bool> MarkGroupMessagesAsReadAsync(Guid groupId, Guid userId)
    {
        // Verify user is member of the group
        var groupMember = await _context.GroupMembers
            .FirstOrDefaultAsync(gm => gm.GroupId == groupId && gm.UserId == userId);

        if (groupMember == null) return false;

        var unreadMessages = await _context.Messages
            .Where(m => m.GroupId == groupId 
                      && m.SenderId != userId 
                      && !m.IsRead)
            .ToListAsync();

        foreach (var message in unreadMessages)
        {
            message.IsRead = true;
        }        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteMessageAsync(Guid messageId, Guid userId)
    {
        var message = await _context.Messages
            .Include(m => m.Group)
            .Include(m => m.Conversation)
            .FirstOrDefaultAsync(m => m.Id == messageId);

        if (message == null) return false;

        // Check permissions
        bool canDelete = false;

        if (message.ConversationId.HasValue)
        {
            // For conversation messages, only the sender can delete
            canDelete = message.SenderId == userId;
        }
        else if (message.GroupId.HasValue)
        {
            // For group messages, sender or group admin can delete
            if (message.SenderId == userId)
            {
                canDelete = true;
            }
            else
            {
                // Check if user is group admin
                var group = await _context.Groups
                    .FirstOrDefaultAsync(g => g.Id == message.GroupId);
                canDelete = group?.CreatedById == userId;
            }
        }

        if (!canDelete) return false;

        // Instead of deleting, mark as deleted by changing the content and type
        message.Content = "Tin nhắn này đã bị xóa";
        message.MessageType = "Deleted";

        await _context.SaveChangesAsync();
        return true;
    }    private static MessageDto MapToDto(Message message)
    {
        return new MessageDto
        {
            Id = message.Id,
            ConversationId = message.ConversationId,
            GroupId = message.GroupId,
            SenderId = message.SenderId,
            Content = message.Content,
            MessageType = message.MessageType,
            IsRead = message.IsRead,
            SentAt = message.SentAt,
            ReplyToMessageId = message.ReplyToMessageId,
            Sender = message.Sender == null ? null : new UserDto
            {
                Id = message.Sender.Id,
                Email = message.Sender.Email,
                Name = message.Sender.Name,
                Avatar = message.Sender.Avatar,
                IsOnline = message.Sender.IsOnline,
                LastSeen = message.Sender.LastSeen,
                CreatedAt = message.Sender.CreatedAt
            },
            ReplyToMessage = message.ReplyToMessage == null ? null : new MessageDto
            {
                Id = message.ReplyToMessage.Id,
                ConversationId = message.ReplyToMessage.ConversationId,
                GroupId = message.ReplyToMessage.GroupId,
                SenderId = message.ReplyToMessage.SenderId,
                Content = message.ReplyToMessage.Content,
                MessageType = message.ReplyToMessage.MessageType,
                IsRead = message.ReplyToMessage.IsRead,
                SentAt = message.ReplyToMessage.SentAt,
                Sender = message.ReplyToMessage.Sender == null ? null : new UserDto
                {
                    Id = message.ReplyToMessage.Sender.Id,
                    Email = message.ReplyToMessage.Sender.Email,
                    Name = message.ReplyToMessage.Sender.Name,
                    Avatar = message.ReplyToMessage.Sender.Avatar,
                    IsOnline = message.ReplyToMessage.Sender.IsOnline,
                    LastSeen = message.ReplyToMessage.Sender.LastSeen,
                    CreatedAt = message.ReplyToMessage.Sender.CreatedAt
                }
            }
        };
    }

    /// <summary>
    /// Get conversation messages with optimized cursor-based pagination
    /// </summary>
    public async Task<PaginatedMessageDto> GetConversationMessagesPaginatedAsync(Guid conversationId, Guid userId, MessagePaginationDto pagination)
    {
        // Verify user is part of conversation
        var conversation = await _context.Conversations
            .FirstOrDefaultAsync(c => c.Id == conversationId && (c.User1Id == userId || c.User2Id == userId));

        if (conversation == null)
            throw new UnauthorizedAccessException("User is not part of this conversation");

        var query = _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.ReplyToMessage)
            .ThenInclude(rm => rm!.Sender)
            .Where(m => m.ConversationId == conversationId);

        // Apply cursor-based filtering for infinite scroll
        if (!string.IsNullOrEmpty(pagination.Cursor) && DateTime.TryParse(pagination.Cursor, out var cursorTime))
        {
            if (pagination.Direction == "older")
            {
                query = query.Where(m => m.SentAt < cursorTime);
            }
            else // newer
            {
                query = query.Where(m => m.SentAt > cursorTime);
            }
        }

        // Order by SentAt DESC for latest first (utilizes our composite index)
        query = query.OrderByDescending(m => m.SentAt);

        // Limit page size for performance (max 50)
        var pageSize = Math.Min(pagination.PageSize, 50);
        var messages = await query
            .Take(pageSize + 1) // Take one extra to check if there are more
            .ToListAsync();

        var hasMore = messages.Count > pageSize;
        if (hasMore) messages.RemoveAt(messages.Count - 1);        // Convert to DTOs
        var messageDtos = messages.Select(MapToDto).ToList();

        // Calculate cursors
        string? nextCursor = null;
        string? previousCursor = null;

        if (messageDtos.Any())
        {
            if (hasMore)
            {
                nextCursor = messageDtos.Last().SentAt.ToString("O"); // ISO 8601 format
            }
            if (!string.IsNullOrEmpty(pagination.Cursor) || pagination.Direction == "newer")
            {
                previousCursor = messageDtos.First().SentAt.ToString("O");
            }
        }

        return new PaginatedMessageDto
        {
            Messages = messageDtos,
            TotalCount = -1, // Not calculated for performance (expensive query)
            PageNumber = pagination.PageNumber,
            PageSize = pageSize,
            HasNextPage = hasMore,
            HasPreviousPage = !string.IsNullOrEmpty(pagination.Cursor),
            NextCursor = nextCursor,
            PreviousCursor = previousCursor
        };
    }

    /// <summary>
    /// Get group messages with optimized cursor-based pagination  
    /// </summary>
    public async Task<PaginatedMessageDto> GetGroupMessagesPaginatedAsync(Guid groupId, Guid userId, MessagePaginationDto pagination)
    {
        // Verify user is group member
        var groupMember = await _context.GroupMembers
            .FirstOrDefaultAsync(gm => gm.GroupId == groupId && gm.UserId == userId);

        if (groupMember == null)
            throw new UnauthorizedAccessException("User is not a member of this group");

        var query = _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.ReplyToMessage)
            .ThenInclude(rm => rm!.Sender)
            .Where(m => m.GroupId == groupId);

        // Apply cursor-based filtering
        if (!string.IsNullOrEmpty(pagination.Cursor) && DateTime.TryParse(pagination.Cursor, out var cursorTime))
        {
            if (pagination.Direction == "older")
            {
                query = query.Where(m => m.SentAt < cursorTime);
            }
            else // newer
            {
                query = query.Where(m => m.SentAt > cursorTime);
            }
        }

        // Order by SentAt DESC (utilizes our composite index)
        query = query.OrderByDescending(m => m.SentAt);

        var pageSize = Math.Min(pagination.PageSize, 50);
        var messages = await query
            .Take(pageSize + 1)
            .ToListAsync();

        var hasMore = messages.Count > pageSize;
        if (hasMore) messages.RemoveAt(messages.Count - 1);

        var messageDtos = messages.Select(MapToDto).ToList();

        string? nextCursor = null;
        string? previousCursor = null;

        if (messageDtos.Any())
        {
            if (hasMore)
            {
                nextCursor = messageDtos.Last().SentAt.ToString("O");
            }
            if (!string.IsNullOrEmpty(pagination.Cursor) || pagination.Direction == "newer")
            {
                previousCursor = messageDtos.First().SentAt.ToString("O");
            }
        }

        return new PaginatedMessageDto
        {
            Messages = messageDtos,
            TotalCount = -1,
            PageNumber = pagination.PageNumber,
            PageSize = pageSize,
            HasNextPage = hasMore,
            HasPreviousPage = !string.IsNullOrEmpty(pagination.Cursor),
            NextCursor = nextCursor,
            PreviousCursor = previousCursor        };
    }
}