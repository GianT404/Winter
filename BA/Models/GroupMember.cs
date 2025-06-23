using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BA.Models;

/// <summary>
/// Represents a user's membership in a group
/// </summary>
public class GroupMember
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public Guid Id { get; set; }

    [Required]
    public Guid GroupId { get; set; }

    [Required]
    public Guid UserId { get; set; }

    [Required]
    [MaxLength(20)]
    public string Role { get; set; } = "Member"; // Admin, Member

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey("GroupId")]
    public virtual Group Group { get; set; } = null!;

    [ForeignKey("UserId")]
    public virtual User User { get; set; } = null!;
}
