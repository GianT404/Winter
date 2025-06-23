using System.ComponentModel.DataAnnotations;

namespace BA.DTOs;

/// <summary>
/// DTO for unblocking a user
/// </summary>
public class UnblockUserDto
{
    /// <summary>
    /// The ID of the user to be unblocked
    /// </summary>
    [Required]
    public Guid BlockedUserId { get; set; }
}
