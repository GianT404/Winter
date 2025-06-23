using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BA.Models;

public class Friendship
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public Guid Id { get; set; }

    [Required]
    public Guid RequesterId { get; set; }

    [Required]
    public Guid ReceiverId { get; set; }

    [Required]
    [MaxLength(20)]
    public string Status { get; set; } = "Pending"; // Pending, Accepted, Declined

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey("RequesterId")]
    public virtual User Requester { get; set; } = null!;

    [ForeignKey("ReceiverId")]
    public virtual User Receiver { get; set; } = null!;
}
