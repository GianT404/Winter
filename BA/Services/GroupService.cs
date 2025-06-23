using Microsoft.EntityFrameworkCore;
using BA.Data;
using BA.Models;
using BA.DTOs;

namespace BA.Services;

public interface IGroupService
{
    Task<GroupDto?> CreateGroupAsync(CreateGroupDto createGroupDto, Guid userId);
    Task<IEnumerable<GroupDto>> GetUserGroupsAsync(Guid userId);
    Task<GroupDto?> GetGroupByIdAsync(Guid groupId, Guid userId);
    Task<GroupDto?> UpdateGroupAsync(Guid groupId, UpdateGroupDto updateGroupDto, Guid userId);
    Task<bool> DeleteGroupAsync(Guid groupId, Guid userId);
    Task<bool> AddMemberAsync(Guid groupId, Guid userId, Guid memberUserId);
    Task<bool> RemoveMemberAsync(Guid groupId, Guid userId, Guid memberUserId);
    Task<bool> UpdateMemberRoleAsync(Guid groupId, Guid userId, Guid memberUserId, string role);
    Task<IEnumerable<GroupMemberDto>> GetGroupMembersAsync(Guid groupId, Guid userId);
    Task<IEnumerable<GroupDto>> SearchPublicGroupsAsync(string searchTerm, Guid userId);
    Task<GroupJoinRequestDto?> CreateJoinRequestAsync(CreateGroupJoinRequestDto createRequestDto, Guid userId);
    Task<bool> RespondToJoinRequestAsync(RespondToGroupJoinRequestDto respondDto, Guid userId);
    Task<IEnumerable<GroupJoinRequestDto>> GetGroupJoinRequestsAsync(Guid groupId, Guid userId);
    Task<bool> IsUserMemberAsync(Guid groupId, Guid userId);
    Task<string?> GetUserRoleInGroupAsync(Guid groupId, Guid userId);
}

public class GroupService : IGroupService
{
    private readonly ChatDbContext _context;

    public GroupService(ChatDbContext context)
    {
        _context = context;
    }

    public async Task<GroupDto?> CreateGroupAsync(CreateGroupDto createGroupDto, Guid userId)
    {
        // Validate group name
        if (string.IsNullOrWhiteSpace(createGroupDto.Name) || 
            createGroupDto.Name.Length < 3 || 
            createGroupDto.Name.Length > 50)
        {
            return null;
        }        // Convert string IDs to GUIDs if any members provided
        var memberGuids = createGroupDto.GetMemberGuids();
        
        // Verify conversion was successful
        if (memberGuids.Count != createGroupDto.MemberIds.Count)
        {
            throw new ArgumentException("One or more member IDs are not valid GUIDs");
        }

        // Verify all member IDs exist (only if there are any to check)
        List<Guid> validMemberIds = new List<Guid>();
        if (memberGuids.Count > 0)
        {
            validMemberIds = await _context.Users
                .Where(u => memberGuids.Contains(u.Id))
                .Select(u => u.Id)
                .ToListAsync();

            if (validMemberIds.Count != memberGuids.Count)
            {
                throw new ArgumentException("One or more member IDs do not exist");
            }
        }

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // Create group
            var group = new Group
            {
                Name = createGroupDto.Name.Trim(),
                Description = createGroupDto.Description?.Trim(),
                Avatar = createGroupDto.Avatar,
                CreatedById = userId,
                Privacy = createGroupDto.Privacy
            };

            _context.Groups.Add(group);
            await _context.SaveChangesAsync();

            // Add creator as admin
            var creatorMembership = new GroupMember
            {
                GroupId = group.Id,
                UserId = userId,
                Role = "Admin"
            };
            _context.GroupMembers.Add(creatorMembership);

            // Add other members
            foreach (var memberId in validMemberIds)
            {
                if (memberId != userId) // Don't add creator twice
                {
                    var membership = new GroupMember
                    {
                        GroupId = group.Id,
                        UserId = memberId,
                        Role = "Member"
                    };
                    _context.GroupMembers.Add(membership);
                }
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return await GetGroupByIdAsync(group.Id, userId);
        }
        catch
        {
            await transaction.RollbackAsync();
            return null;
        }
    }

    public async Task<IEnumerable<GroupDto>> GetUserGroupsAsync(Guid userId)
    {
        var groups = await _context.GroupMembers
            .Include(gm => gm.Group)
                .ThenInclude(g => g.CreatedBy)
            .Include(gm => gm.Group)
                .ThenInclude(g => g.Members)
                .ThenInclude(m => m.User)
            .Include(gm => gm.Group)
                .ThenInclude(g => g.Messages.OrderByDescending(m => m.SentAt).Take(1))
                .ThenInclude(m => m.Sender)
            .Where(gm => gm.UserId == userId)
            .Select(gm => gm.Group)
            .OrderByDescending(g => g.UpdatedAt)
            .ToListAsync();

        var groupDtos = new List<GroupDto>();
        foreach (var group in groups)
        {
            groupDtos.Add(await MapToDtoAsync(group, userId));
        }

        return groupDtos;
    }

    public async Task<GroupDto?> GetGroupByIdAsync(Guid groupId, Guid userId)
    {
        var group = await _context.Groups
            .Include(g => g.CreatedBy)
            .Include(g => g.Members)
                .ThenInclude(m => m.User)
            .Include(g => g.Messages.OrderByDescending(m => m.SentAt).Take(1))
                .ThenInclude(m => m.Sender)
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group == null) return null;

        // Check if user has access (member or public group)
        var isMember = await IsUserMemberAsync(groupId, userId);
        if (!isMember && group.Privacy != "Public")
        {
            return null;
        }

        return await MapToDtoAsync(group, userId);
    }

    public async Task<GroupDto?> UpdateGroupAsync(Guid groupId, UpdateGroupDto updateGroupDto, Guid userId)
    {
        var group = await _context.Groups.FirstOrDefaultAsync(g => g.Id == groupId);
        if (group == null) return null;

        // Check if user is admin
        var userRole = await GetUserRoleInGroupAsync(groupId, userId);
        if (userRole != "Admin") return null;

        // Update fields
        if (!string.IsNullOrWhiteSpace(updateGroupDto.Name) && 
            updateGroupDto.Name.Length >= 3 && 
            updateGroupDto.Name.Length <= 50)
        {
            group.Name = updateGroupDto.Name.Trim();
        }

        if (updateGroupDto.Description != null)
        {
            group.Description = updateGroupDto.Description.Trim();
        }

        if (updateGroupDto.Avatar != null)
        {
            group.Avatar = updateGroupDto.Avatar;
        }

        if (!string.IsNullOrWhiteSpace(updateGroupDto.Privacy) && 
            (updateGroupDto.Privacy == "Public" || updateGroupDto.Privacy == "Private"))
        {
            group.Privacy = updateGroupDto.Privacy;
        }

        group.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return await GetGroupByIdAsync(groupId, userId);
    }

    public async Task<bool> DeleteGroupAsync(Guid groupId, Guid userId)
    {
        var group = await _context.Groups.FirstOrDefaultAsync(g => g.Id == groupId);
        if (group == null) return false;

        // Only creator can delete group
        if (group.CreatedById != userId) return false;

        _context.Groups.Remove(group);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> AddMemberAsync(Guid groupId, Guid userId, Guid memberUserId)
    {
        // Check if user is admin
        var userRole = await GetUserRoleInGroupAsync(groupId, userId);
        if (userRole != "Admin") return false;

        // Check if target user exists
        var userExists = await _context.Users.AnyAsync(u => u.Id == memberUserId);
        if (!userExists) return false;

        // Check if already a member
        var existingMembership = await _context.GroupMembers
            .FirstOrDefaultAsync(gm => gm.GroupId == groupId && gm.UserId == memberUserId);
        if (existingMembership != null) return false;

        var membership = new GroupMember
        {
            GroupId = groupId,
            UserId = memberUserId,
            Role = "Member"
        };

        _context.GroupMembers.Add(membership);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RemoveMemberAsync(Guid groupId, Guid userId, Guid memberUserId)
    {
        // Check if user is admin
        var userRole = await GetUserRoleInGroupAsync(groupId, userId);
        if (userRole != "Admin") return false;

        // Don't allow removing the creator
        var group = await _context.Groups.FirstOrDefaultAsync(g => g.Id == groupId);
        if (group?.CreatedById == memberUserId) return false;

        var membership = await _context.GroupMembers
            .FirstOrDefaultAsync(gm => gm.GroupId == groupId && gm.UserId == memberUserId);
        if (membership == null) return false;

        _context.GroupMembers.Remove(membership);
        await _context.SaveChangesAsync();
        return true;
    }    public async Task<bool> UpdateMemberRoleAsync(Guid groupId, Guid userId, Guid memberUserId, string role)
    {
        // Check if user is admin
        var userRole = await GetUserRoleInGroupAsync(groupId, userId);
        if (userRole != "Admin") return false;

        // Validate role
        if (role != "Admin" && role != "Member") return false;

        // Don't allow changing creator's role
        var group = await _context.Groups.FirstOrDefaultAsync(g => g.Id == groupId);
        if (group?.CreatedById == memberUserId) return false;

        var membership = await _context.GroupMembers
            .FirstOrDefaultAsync(gm => gm.GroupId == groupId && gm.UserId == memberUserId);
        if (membership == null) return false;

        membership.Role = role;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<IEnumerable<GroupMemberDto>> GetGroupMembersAsync(Guid groupId, Guid userId)
    {
        // Check if user has access to group (must be member or public group)
        var group = await _context.Groups.FirstOrDefaultAsync(g => g.Id == groupId);
        if (group == null) return new List<GroupMemberDto>();

        var isMember = await IsUserMemberAsync(groupId, userId);
        if (!isMember && group.Privacy != "Public")
        {
            return new List<GroupMemberDto>();
        }

        var members = await _context.GroupMembers
            .Include(gm => gm.User)
            .Where(gm => gm.GroupId == groupId)
            .OrderBy(gm => gm.Role == "Admin" ? 0 : 1) // Admins first
            .ThenBy(gm => gm.JoinedAt)
            .ToListAsync();

        return members.Select(MapMemberToDto);
    }

    public async Task<IEnumerable<GroupDto>> SearchPublicGroupsAsync(string searchTerm, Guid userId)
    {
        var query = _context.Groups
            .Include(g => g.CreatedBy)
            .Include(g => g.Members)
                .ThenInclude(m => m.User)
            .Where(g => g.Privacy == "Public");

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            query = query.Where(g => g.Name.Contains(searchTerm) || 
                                    (g.Description != null && g.Description.Contains(searchTerm)));
        }

        var groups = await query
            .OrderByDescending(g => g.CreatedAt)
            .Take(50)
            .ToListAsync();

        var groupDtos = new List<GroupDto>();
        foreach (var group in groups)
        {
            groupDtos.Add(await MapToDtoAsync(group, userId));
        }

        return groupDtos;
    }

    public async Task<GroupJoinRequestDto?> CreateJoinRequestAsync(CreateGroupJoinRequestDto createRequestDto, Guid userId)
    {
        var group = await _context.Groups.FirstOrDefaultAsync(g => g.Id == createRequestDto.GroupId);
        if (group == null || group.Privacy != "Public") return null;

        // Check if already a member
        var isMember = await IsUserMemberAsync(createRequestDto.GroupId, userId);
        if (isMember) return null;

        // Check if already has pending request
        var existingRequest = await _context.GroupJoinRequests
            .FirstOrDefaultAsync(gjr => gjr.GroupId == createRequestDto.GroupId && 
                                       gjr.UserId == userId && 
                                       gjr.Status == "Pending");
        if (existingRequest != null) return null;

        var joinRequest = new GroupJoinRequest
        {
            GroupId = createRequestDto.GroupId,
            UserId = userId,
            Message = createRequestDto.Message?.Trim(),
            Status = "Pending"
        };

        _context.GroupJoinRequests.Add(joinRequest);
        await _context.SaveChangesAsync();

        return await MapJoinRequestToDtoAsync(joinRequest);
    }

    public async Task<bool> RespondToJoinRequestAsync(RespondToGroupJoinRequestDto respondDto, Guid userId)
    {
        var joinRequest = await _context.GroupJoinRequests
            .Include(gjr => gjr.Group)
            .FirstOrDefaultAsync(gjr => gjr.Id == respondDto.RequestId && gjr.Status == "Pending");
        if (joinRequest == null) return false;

        // Check if user is admin of the group
        var userRole = await GetUserRoleInGroupAsync(joinRequest.GroupId, userId);
        if (userRole != "Admin") return false;

        // Validate status
        if (respondDto.Status != "Approved" && respondDto.Status != "Rejected") return false;

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            joinRequest.Status = respondDto.Status;
            joinRequest.RespondedAt = DateTime.UtcNow;
            joinRequest.RespondedById = userId;

            // If approved, add user to group
            if (respondDto.Status == "Approved")
            {
                var membership = new GroupMember
                {
                    GroupId = joinRequest.GroupId,
                    UserId = joinRequest.UserId,
                    Role = "Member"
                };
                _context.GroupMembers.Add(membership);
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            return true;
        }
        catch
        {
            await transaction.RollbackAsync();
            return false;
        }
    }

    public async Task<IEnumerable<GroupJoinRequestDto>> GetGroupJoinRequestsAsync(Guid groupId, Guid userId)
    {
        // Check if user is admin
        var userRole = await GetUserRoleInGroupAsync(groupId, userId);
        if (userRole != "Admin") return new List<GroupJoinRequestDto>();

        var requests = await _context.GroupJoinRequests
            .Include(gjr => gjr.User)
            .Include(gjr => gjr.Group)
            .Include(gjr => gjr.RespondedBy)
            .Where(gjr => gjr.GroupId == groupId)
            .OrderByDescending(gjr => gjr.RequestedAt)
            .ToListAsync();

        return requests.Select(MapJoinRequestToDtoAsync).Select(t => t.Result);
    }

    public async Task<bool> IsUserMemberAsync(Guid groupId, Guid userId)
    {
        return await _context.GroupMembers
            .AnyAsync(gm => gm.GroupId == groupId && gm.UserId == userId);
    }

    public async Task<string?> GetUserRoleInGroupAsync(Guid groupId, Guid userId)
    {
        var membership = await _context.GroupMembers
            .FirstOrDefaultAsync(gm => gm.GroupId == groupId && gm.UserId == userId);
        return membership?.Role;
    }

    private async Task<GroupDto> MapToDtoAsync(Group group, Guid currentUserId)
    {
        var lastMessage = group.Messages.FirstOrDefault();
        var unreadCount = await _context.Messages
            .CountAsync(m => m.GroupId == group.Id && 
                           m.SenderId != currentUserId && 
                           !m.IsRead);

        var userRole = await GetUserRoleInGroupAsync(group.Id, currentUserId);

        return new GroupDto
        {
            Id = group.Id,
            Name = group.Name,
            Description = group.Description,
            Avatar = group.Avatar,
            CreatedById = group.CreatedById,
            Privacy = group.Privacy,
            CreatedAt = group.CreatedAt,
            UpdatedAt = group.UpdatedAt,
            CreatedBy = MapUserToDto(group.CreatedBy),
            Members = group.Members.Select(MapMemberToDto).ToList(),
            LastMessage = lastMessage == null ? null : MapMessageToDto(lastMessage),
            UnreadCount = unreadCount,
            MemberCount = group.Members.Count,
            UserRole = userRole
        };
    }

    private async Task<GroupJoinRequestDto> MapJoinRequestToDtoAsync(GroupJoinRequest request)
    {
        return new GroupJoinRequestDto
        {
            Id = request.Id,
            GroupId = request.GroupId,
            UserId = request.UserId,
            Status = request.Status,
            Message = request.Message,
            RequestedAt = request.RequestedAt,
            RespondedAt = request.RespondedAt,
            RespondedById = request.RespondedById,
            User = request.User == null ? null : MapUserToDto(request.User),
            Group = request.Group == null ? null : await MapToDtoAsync(request.Group, request.UserId),
            RespondedBy = request.RespondedBy == null ? null : MapUserToDto(request.RespondedBy)
        };
    }

    private static GroupMemberDto MapMemberToDto(GroupMember member)
    {
        return new GroupMemberDto
        {
            Id = member.Id,
            GroupId = member.GroupId,
            UserId = member.UserId,
            Role = member.Role,
            JoinedAt = member.JoinedAt,
            User = member.User == null ? null : MapUserToDto(member.User)
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
            GroupId = message.GroupId,
            SenderId = message.SenderId,
            Content = message.Content,
            MessageType = message.MessageType,
            IsRead = message.IsRead,
            SentAt = message.SentAt,
            Sender = message.Sender == null ? null : MapUserToDto(message.Sender)
        };
    }
}
