using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BA.Models;

public class Message
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public Guid Id { get; set; }    // Either ConversationId OR GroupId should be set, not both
    public Guid? ConversationId { get; set; }
    
    public Guid? GroupId { get; set; }

    [Required]
    public Guid SenderId { get; set; }

    [Required]
    public string Content { get; set; } = string.Empty;

    [MaxLength(20)]
    public string MessageType { get; set; } = "Text"; // Text, Image, File

    public bool IsRead { get; set; } = false;    public DateTime SentAt { get; set; } = DateTime.UtcNow;

    // Reply functionality
    public Guid? ReplyToMessageId { get; set; }

    // Navigation properties
    [ForeignKey("ConversationId")]
    public virtual Conversation? Conversation { get; set; }

    [ForeignKey("GroupId")]
    public virtual Group? Group { get; set; }

    [ForeignKey("SenderId")]
    public virtual User Sender { get; set; } = null!;

    [ForeignKey("ReplyToMessageId")]
    public virtual Message? ReplyToMessage { get; set; }
}
