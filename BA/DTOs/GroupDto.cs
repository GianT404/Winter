namespace BA.DTOs;

public class GroupDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Avatar { get; set; }
    public Guid CreatedById { get; set; }
    public string Privacy { get; set; } = "Private";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public UserDto? CreatedBy { get; set; }
    public List<GroupMemberDto> Members { get; set; } = new();
    public MessageDto? LastMessage { get; set; }
    public int UnreadCount { get; set; }
    public int MemberCount { get; set; }
    public string? UserRole { get; set; } // Current user's role in this group
}

public class GroupMemberDto
{
    public Guid Id { get; set; }
    public Guid GroupId { get; set; }
    public Guid UserId { get; set; }
    public string Role { get; set; } = "Member";
    public DateTime JoinedAt { get; set; }
    public UserDto? User { get; set; }
}

public class CreateGroupDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Avatar { get; set; }
    public string Privacy { get; set; } = "Private";
    public List<string> MemberIds { get; set; } = new();
    
    // Helper property to convert string IDs to GUIDs
    public List<Guid> GetMemberGuids()
    {
        var guids = new List<Guid>();
        foreach (var memberId in MemberIds)
        {
            if (Guid.TryParse(memberId, out var guid))
            {
                guids.Add(guid);
            }
        }
        return guids;
    }
}

public class UpdateGroupDto
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Avatar { get; set; }
    public string? Privacy { get; set; }
}

public class AddGroupMemberDto
{
    public Guid GroupId { get; set; }
    public Guid UserId { get; set; }
}

public class RemoveGroupMemberDto
{
    public Guid GroupId { get; set; }
    public Guid UserId { get; set; }
}

public class GroupJoinRequestDto
{
    public Guid Id { get; set; }
    public Guid GroupId { get; set; }
    public Guid UserId { get; set; }
    public string Status { get; set; } = "Pending";
    public string? Message { get; set; }
    public DateTime RequestedAt { get; set; }
    public DateTime? RespondedAt { get; set; }
    public Guid? RespondedById { get; set; }
    public UserDto? User { get; set; }
    public GroupDto? Group { get; set; }
    public UserDto? RespondedBy { get; set; }
}

public class CreateGroupJoinRequestDto
{
    public Guid GroupId { get; set; }
    public string? Message { get; set; }
}

public class RespondToGroupJoinRequestDto
{
    public Guid RequestId { get; set; }
    public string Status { get; set; } = "Approved"; // Approved, Rejected
}
