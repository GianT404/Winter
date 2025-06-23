namespace BA.DTOs;

public class UserDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Avatar { get; set; }
    public bool IsOnline { get; set; }
    public DateTime? LastSeen { get; set; }
    public DateTime CreatedAt { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
}

public class CreateUserDto
{
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? Avatar { get; set; }
}

public class UpdateUserDto
{
    public string? Name { get; set; }
    public string? Avatar { get; set; }
}
