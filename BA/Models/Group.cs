using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BA.Models;

/// <summary>
/// Represents a chat group in the application
/// </summary>
public class Group
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public Guid Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public string? Avatar { get; set; }

    [Required]
    public Guid CreatedById { get; set; }

    [Required]
    [MaxLength(20)]
    public string Privacy { get; set; } = "Private"; // Public, Private

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey("CreatedById")]
    public virtual User CreatedBy { get; set; } = null!;

    public virtual ICollection<GroupMember> Members { get; set; } = new List<GroupMember>();
    public virtual ICollection<Message> Messages { get; set; } = new List<Message>();
    public virtual ICollection<GroupJoinRequest> JoinRequests { get; set; } = new List<GroupJoinRequest>();
}
