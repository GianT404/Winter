using BA.Data;
using BA.DTOs;
using BA.Models;
using Microsoft.EntityFrameworkCore;

namespace BA.Services;

public interface IBlockService
{
    Task<BlockStatusDto> BlockUserAsync(Guid blockerId, Guid blockedUserId);
    Task<BlockStatusDto> UnblockUserAsync(Guid blockerId, Guid blockedUserId);
    Task<BlockStatusDto> GetBlockStatusAsync(Guid userId1, Guid userId2);
    Task<bool> IsUserBlockedAsync(Guid checkerId, Guid targetUserId);
    Task<List<UserDto>> GetBlockedUsersAsync(Guid userId);
    Task<bool> HasBlockedAsync(Guid userId, Guid blockedUser);
}

public class BlockService : IBlockService
{
    private readonly ChatDbContext _context;

    public BlockService(ChatDbContext context)
    {
        _context = context;
    }
    /// <summary>
    /// Block a user
    /// </summary>
    public async Task<BlockStatusDto> BlockUserAsync(Guid blockerId, Guid blockedUserId)
    {
        if (blockerId == blockedUserId)
        {
            throw new InvalidOperationException("Cannot block yourself");
        }

        // Check if users exist
        var blocker = await _context.Users.FindAsync(blockerId);
        var blockedUser = await _context.Users.FindAsync(blockedUserId);

        if (blocker == null || blockedUser == null)
        {
            throw new ArgumentException("One or both users not found");
        }

        // Check if block already exists
        var existingBlock = await _context.Blocks
            .FirstOrDefaultAsync(b => b.BlockerUserId == blockerId && b.BlockedUserId == blockedUserId);

        if (existingBlock != null)
        {
            // Update existing block
            existingBlock.Status = "Blocked";
            existingBlock.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            // Create new block
            var block = new Block
            {
                BlockerUserId = blockerId,
                BlockedUserId = blockedUserId,
                Status = "Blocked",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Blocks.Add(block);
        }

        await _context.SaveChangesAsync();

        return new BlockStatusDto
        {
            BlockerUserId = blockerId,
            BlockedUserId = blockedUserId,
            Status = "Blocked",
            CreatedAt = existingBlock?.CreatedAt ?? DateTime.UtcNow,
            IsBlocked = false,
            HasBlocked = true
        };
    }

    /// <summary>
    /// Unblock a user
    /// </summary>
    public async Task<BlockStatusDto> UnblockUserAsync(Guid blockerId, Guid blockedUserId)
    {
        var existingBlock = await _context.Blocks
            .FirstOrDefaultAsync(b => b.BlockerUserId == blockerId && b.BlockedUserId == blockedUserId && b.Status == "Blocked");

        if (existingBlock == null)
        {
            throw new InvalidOperationException("No active block found");
        }

        existingBlock.Status = "Unblocked";
        existingBlock.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return new BlockStatusDto
        {
            BlockerUserId = blockerId,
            BlockedUserId = blockedUserId,
            Status = "Unblocked",
            CreatedAt = existingBlock.CreatedAt,
            IsBlocked = false,
            HasBlocked = false
        };
    }

    /// <summary>
    /// Get block status between two users
    /// </summary>
    public async Task<BlockStatusDto> GetBlockStatusAsync(Guid userId1, Guid userId2)
    {
        var block1 = await _context.Blocks
            .FirstOrDefaultAsync(b => b.BlockerUserId == userId1 && b.BlockedUserId == userId2 && b.Status == "Blocked");

        var block2 = await _context.Blocks
            .FirstOrDefaultAsync(b => b.BlockerUserId == userId2 && b.BlockedUserId == userId1 && b.Status == "Blocked");

        return new BlockStatusDto
        {
            BlockerUserId = block1?.BlockerUserId ?? Guid.Empty,
            BlockedUserId = block1?.BlockedUserId ?? Guid.Empty,
            Status = block1?.Status ?? "None",
            CreatedAt = block1?.CreatedAt ?? DateTime.MinValue,
            IsBlocked = block2 != null, // Current user is blocked by the other user
            HasBlocked = block1 != null  // Current user has blocked the other user
        };
    }

    /// <summary>
    /// Check if a user is blocked by another user
    /// </summary>
    public async Task<bool> IsBlockedAsync(Guid userId, Guid blockedBy)
        {
            return await _context.Blocks.AnyAsync(b => 
                b.BlockerUserId == blockedBy && b.BlockedUserId == userId);
        }

    /// <summary>
    /// Get list of users blocked by the current user
    /// </summary>
    public async Task<List<UserDto>> GetBlockedUsersAsync(Guid userId)
    {
        var blockedUsers = await _context.Blocks
            .Where(b => b.BlockerUserId == userId && b.Status == "Blocked")
            .Include(b => b.BlockedUser)
            .Select(b => new UserDto
            {
                Id = b.BlockedUser.Id,
                Name = b.BlockedUser.Name,
                Email = b.BlockedUser.Email,
                Avatar = b.BlockedUser.Avatar,
                IsOnline = b.BlockedUser.IsOnline,
                LastSeen = b.BlockedUser.LastSeen
            })
            .ToListAsync();

        return blockedUsers;
    }
    public async Task<bool> HasBlockedAsync(Guid userId, Guid blockedUser)
        {
            return await _context.Blocks.AnyAsync(b => 
                b.BlockerUserId == userId && b.BlockedUserId == blockedUser);
        }

    public Task<bool> IsUserBlockedAsync(Guid checkerId, Guid targetUserId)
    {
        throw new NotImplementedException();
    }
}
