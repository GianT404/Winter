namespace BA.DTOs;

/// <summary>
/// DTO for block status information
/// </summary>
public class BlockStatusDto
{
    /// <summary>
    /// The ID of the user who initiated the block
    /// </summary>
    public Guid BlockerUserId { get; set; }

    /// <summary>
    /// The ID of the user who was blocked
    /// </summary>
    public Guid BlockedUserId { get; set; }

    /// <summary>
    /// Current status of the block
    /// </summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// When the block was created
    /// </summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// Whether the current user is blocked by another user
    /// </summary>
    public bool IsBlocked { get; set; }

    /// <summary>
    /// Whether the current user has blocked another user
    /// </summary>
    public bool HasBlocked { get; set; }
}
