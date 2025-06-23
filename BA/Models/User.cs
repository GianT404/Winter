using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BA.Models;

public class User
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public Guid Id { get; set; }

    [Required]
    [MaxLength(255)]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;    public string? Avatar { get; set; }

    [Required]
    [MaxLength(255)]
    public string PasswordHash { get; set; } = string.Empty;

    public bool IsOnline { get; set; } = false;

    public DateTime? LastSeen { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;    // Navigation properties
    public virtual ICollection<Friendship> SentFriendRequests { get; set; } = new List<Friendship>();
    public virtual ICollection<Friendship> ReceivedFriendRequests { get; set; } = new List<Friendship>();
    public virtual ICollection<Conversation> ConversationsAsUser1 { get; set; } = new List<Conversation>();
    public virtual ICollection<Conversation> ConversationsAsUser2 { get; set; } = new List<Conversation>();
    public virtual ICollection<Message> SentMessages { get; set; } = new List<Message>();
    public virtual ICollection<Block> BlocksInitiated { get; set; } = new List<Block>();
    public virtual ICollection<Block> BlocksReceived { get; set; } = new List<Block>();
    
    // Group-related navigation properties
    public virtual ICollection<Group> CreatedGroups { get; set; } = new List<Group>();
    public virtual ICollection<GroupMember> GroupMemberships { get; set; } = new List<GroupMember>();
    public virtual ICollection<GroupJoinRequest> GroupJoinRequests { get; set; } = new List<GroupJoinRequest>();
    public virtual ICollection<GroupJoinRequest> RespondedGroupJoinRequests { get; set; } = new List<GroupJoinRequest>();
}
