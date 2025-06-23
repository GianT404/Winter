namespace BA.DTOs;

public class UpdateAvatarDto
{
    public IFormFile Avatar { get; set; } = null!;
}

public class UpdateUserProfileDto
{
    public string? Name { get; set; }
    public string? Avatar { get; set; }
}
