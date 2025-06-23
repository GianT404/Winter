using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BA.Models;

/// <summary>
/// Represents a request to join a public group
/// </summary>
public class GroupJoinRequest
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
    public string Status { get; set; } = "Pending"; // Pending, Approved, Rejected

    [MaxLength(500)]
    public string? Message { get; set; }

    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;

    public DateTime? RespondedAt { get; set; }

    public Guid? RespondedById { get; set; }

    // Navigation properties
    [ForeignKey("GroupId")]
    public virtual Group Group { get; set; } = null!;

    [ForeignKey("UserId")]
    public virtual User User { get; set; } = null!;

    [ForeignKey("RespondedById")]
    public virtual User? RespondedBy { get; set; }
}
