using Microsoft.EntityFrameworkCore;
using BA.Data;
using BA.Models;
using BA.DTOs;

namespace BA.Services;

public interface IFriendshipService
{
    Task<FriendshipDto?> SendFriendRequestAsync(Guid requesterId, string receiverEmail);
    Task<bool> RespondToFriendRequestAsync(Guid friendshipId, Guid userId, string action);
    Task<IEnumerable<FriendshipDto>> GetPendingFriendRequestsAsync(Guid userId);
    Task<IEnumerable<UserDto>> GetFriendsAsync(Guid userId);
    Task<IEnumerable<FriendshipDto>> GetFriendRequestsAsync(Guid userId);
}

public class FriendshipService : IFriendshipService
{
    private readonly ChatDbContext _context;

    public FriendshipService(ChatDbContext context)
    {
        _context = context;
    }

    public async Task<FriendshipDto?> SendFriendRequestAsync(Guid requesterId, string receiverEmail)
    {
        var receiver = await _context.Users.FirstOrDefaultAsync(u => u.Email == receiverEmail);
        if (receiver == null || receiver.Id == requesterId) return null;

        // Check if friendship already exists
        var existingFriendship = await _context.Friendships
            .FirstOrDefaultAsync(f => 
                (f.RequesterId == requesterId && f.ReceiverId == receiver.Id) ||
                (f.RequesterId == receiver.Id && f.ReceiverId == requesterId));

        if (existingFriendship != null) return null;

        var friendship = new Friendship
        {
            RequesterId = requesterId,
            ReceiverId = receiver.Id,
            Status = "Pending"
        };

        _context.Friendships.Add(friendship);
        await _context.SaveChangesAsync();

        return await GetFriendshipDtoAsync(friendship.Id);
    }

    public async Task<bool> RespondToFriendRequestAsync(Guid friendshipId, Guid userId, string action)
    {
        var friendship = await _context.Friendships.FindAsync(friendshipId);
        if (friendship == null || friendship.ReceiverId != userId) return false;

        friendship.Status = action.ToLower() == "accept" ? "Accepted" : "Declined";
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<IEnumerable<FriendshipDto>> GetPendingFriendRequestsAsync(Guid userId)
    {
        var friendships = await _context.Friendships
            .Include(f => f.Requester)
            .Include(f => f.Receiver)
            .Where(f => f.ReceiverId == userId && f.Status == "Pending")
            .ToListAsync();

        return friendships.Select(MapToDto);
    }

    public async Task<IEnumerable<UserDto>> GetFriendsAsync(Guid userId)
    {
        var friendships = await _context.Friendships
            .Include(f => f.Requester)
            .Include(f => f.Receiver)
            .Where(f => (f.RequesterId == userId || f.ReceiverId == userId) && f.Status == "Accepted")
            .ToListAsync();

        var friends = friendships.Select(f => f.RequesterId == userId ? f.Receiver : f.Requester);
        return friends.Select(MapUserToDto);
    }

    private async Task<FriendshipDto?> GetFriendshipDtoAsync(Guid friendshipId)
    {
        var friendship = await _context.Friendships
            .Include(f => f.Requester)
            .Include(f => f.Receiver)
            .FirstOrDefaultAsync(f => f.Id == friendshipId);

        return friendship == null ? null : MapToDto(friendship);
    }

    private static FriendshipDto MapToDto(Friendship friendship)
    {
        return new FriendshipDto
        {
            Id = friendship.Id,
            RequesterId = friendship.RequesterId,
            ReceiverId = friendship.ReceiverId,
            Status = friendship.Status,
            CreatedAt = friendship.CreatedAt,
            Requester = MapUserToDto(friendship.Requester),
            Receiver = MapUserToDto(friendship.Receiver)
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
    }    public async Task<IEnumerable<FriendshipDto>> GetFriendRequestsAsync(Guid userId)
    {
        return await GetPendingFriendRequestsAsync(userId);
    }
}
