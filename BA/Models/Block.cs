using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BA.Models;

/// <summary>
/// Represents a user block relationship in the chat application.
/// Stores information about which user blocked whom and when.
/// </summary>
public class Block
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public Guid Id { get; set; }

    /// <summary>
    /// The ID of the user who initiated the block
    /// </summary>
    [Required]
    public Guid BlockerUserId { get; set; }

    /// <summary>
    /// The ID of the user who was blocked
    /// </summary>
    [Required]
    public Guid BlockedUserId { get; set; }

    /// <summary>
    /// Current status of the block relationship
    /// Values: "Blocked", "Unblocked"
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string Status { get; set; } = "Blocked";

    /// <summary>
    /// When the block was created or last updated
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// When the block status was last updated
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey("BlockerUserId")]
    public virtual User Blocker { get; set; } = null!;

    [ForeignKey("BlockedUserId")]
    public virtual User BlockedUser { get; set; } = null!;
}
