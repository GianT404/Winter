using System.ComponentModel.DataAnnotations;

namespace BA.DTOs;

/// <summary>
/// DTO for blocking a user
/// </summary>
public class BlockUserDto
{
    /// <summary>
    /// The ID of the user to be blocked
    /// </summary>
    [Required]
    public Guid BlockedUserId { get; set; }
}
