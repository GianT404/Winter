using Microsoft.EntityFrameworkCore;
using BA.Data;
using BA.Models;
using BA.DTOs;

namespace BA.Services;

public interface IConversationService
{
    Task<ConversationDto?> CreateOrGetConversationAsync(Guid user1Id, Guid user2Id);
    Task<IEnumerable<ConversationDto>> GetUserConversationsAsync(Guid userId);
    Task<ConversationDto?> GetConversationByIdAsync(Guid conversationId, Guid userId);
}

public class ConversationService : IConversationService
{
    private readonly ChatDbContext _context;

    public ConversationService(ChatDbContext context)
    {
        _context = context;
    }

    public async Task<ConversationDto?> CreateOrGetConversationAsync(Guid user1Id, Guid user2Id)
    {
        // Check if conversation already exists
        var existingConversation = await _context.Conversations
            .Include(c => c.User1)
            .Include(c => c.User2)
            .FirstOrDefaultAsync(c => 
                (c.User1Id == user1Id && c.User2Id == user2Id) ||
                (c.User1Id == user2Id && c.User2Id == user1Id));

        if (existingConversation != null)
        {
            return await MapToDtoAsync(existingConversation, user1Id);
        }

        // Create new conversation
        var conversation = new Conversation
        {
            User1Id = user1Id,
            User2Id = user2Id
        };

        _context.Conversations.Add(conversation);
        await _context.SaveChangesAsync();

        // Reload with navigation properties
        var newConversation = await _context.Conversations
            .Include(c => c.User1)
            .Include(c => c.User2)
            .FirstAsync(c => c.Id == conversation.Id);

        return await MapToDtoAsync(newConversation, user1Id);
    }

    public async Task<IEnumerable<ConversationDto>> GetUserConversationsAsync(Guid userId)
    {
        var conversations = await _context.Conversations
            .Include(c => c.User1)
            .Include(c => c.User2)
            .Include(c => c.Messages.OrderByDescending(m => m.SentAt).Take(1))
                .ThenInclude(m => m.Sender)
            .Where(c => c.User1Id == userId || c.User2Id == userId)
            .OrderByDescending(c => c.UpdatedAt)
            .ToListAsync();

        var conversationDtos = new List<ConversationDto>();
        foreach (var conversation in conversations)
        {
            conversationDtos.Add(await MapToDtoAsync(conversation, userId));
        }

        return conversationDtos;
    }

    public async Task<ConversationDto?> GetConversationByIdAsync(Guid conversationId, Guid userId)
    {
        var conversation = await _context.Conversations
            .Include(c => c.User1)
            .Include(c => c.User2)
            .FirstOrDefaultAsync(c => c.Id == conversationId && (c.User1Id == userId || c.User2Id == userId));

        return conversation == null ? null : await MapToDtoAsync(conversation, userId);
    }

    private async Task<ConversationDto> MapToDtoAsync(Conversation conversation, Guid currentUserId)
    {
        var lastMessage = await _context.Messages
            .Include(m => m.Sender)
            .Where(m => m.ConversationId == conversation.Id)
            .OrderByDescending(m => m.SentAt)
            .FirstOrDefaultAsync();

        var unreadCount = await _context.Messages
            .CountAsync(m => m.ConversationId == conversation.Id 
                           && m.SenderId != currentUserId 
                           && !m.IsRead);

        return new ConversationDto
        {
            Id = conversation.Id,
            User1Id = conversation.User1Id,
            User2Id = conversation.User2Id,
            CreatedAt = conversation.CreatedAt,
            UpdatedAt = conversation.UpdatedAt,
            User1 = MapUserToDto(conversation.User1),
            User2 = MapUserToDto(conversation.User2),
            LastMessage = lastMessage == null ? null : MapMessageToDto(lastMessage),
            UnreadCount = unreadCount
        };
    }

    private static UserDto MapUserToDto(User user)
    {
        return new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            Name = user.Name,
            Avatar = user.Avatar,
            IsOnline = user.IsOnline,
            LastSeen = user.LastSeen,
            CreatedAt = user.CreatedAt
        };
    }

    private static MessageDto MapMessageToDto(Message message)
    {
        return new MessageDto
        {
            Id = message.Id,
            ConversationId = message.ConversationId,
            SenderId = message.SenderId,
            Content = message.Content,
            MessageType = message.MessageType,
            IsRead = message.IsRead,
            SentAt = message.SentAt,
            Sender = message.Sender == null ? null : new UserDto
            {
                Id = message.Sender.Id,
                Email = message.Sender.Email,
                Name = message.Sender.Name,
                Avatar = message.Sender.Avatar,
                IsOnline = message.Sender.IsOnline,
                LastSeen = message.Sender.LastSeen,
                CreatedAt = message.Sender.CreatedAt
            }
        };
    }
}
