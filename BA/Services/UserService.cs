using Microsoft.EntityFrameworkCore;
using BA.Data;
using BA.Models;
using BA.DTOs;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace BA.Services;

public interface IUserService
{
    Task<UserDto?> GetUserByIdAsync(Guid id);
    Task<UserDto?> GetUserByEmailAsync(string email);
    Task<IEnumerable<UserDto>> SearchUsersByEmailAsync(string email, Guid currentUserId);
    Task<UserDto> CreateUserAsync(CreateUserDto createUserDto);
    Task<UserDto?> UpdateUserAsync(Guid id, UpdateUserDto updateUserDto);
    Task<UserDto?> UpdateAvatarAsync(Guid userId, IFormFile avatarFile);
    Task<UserDto?> UpdateProfileAsync(Guid userId, UpdateUserProfileDto updateProfileDto);
    Task<bool> SetUserOnlineStatusAsync(Guid userId, bool isOnline);
    Task<bool> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword);
    bool VerifyPassword(UserDto user, string password);
    Guid GetUserIdFromClaims(ClaimsPrincipal user);
}

public class UserService : IUserService
{
    private readonly ChatDbContext _context;

    public UserService(ChatDbContext context)
    {
        _context = context;
    }

    public async Task<UserDto?> GetUserByIdAsync(Guid id)
    {
        var user = await _context.Users.FindAsync(id);
        return user == null ? null : MapToDto(user);
    }

    public async Task<UserDto?> GetUserByEmailAsync(string email)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        return user == null ? null : MapToDto(user);
    }

    public async Task<IEnumerable<UserDto>> SearchUsersByEmailAsync(string email, Guid currentUserId)
    {
        var users = await _context.Users
            .Where(u => u.Email.Contains(email) && u.Id != currentUserId)
            .Take(10)
            .ToListAsync(); return users.Select(MapToDto);
    }

    public async Task<UserDto> CreateUserAsync(CreateUserDto createUserDto)
    {
        var user = new User
        {
            Email = createUserDto.Email,
            Name = createUserDto.Name,
            Avatar = createUserDto.Avatar,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(createUserDto.Password)
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return MapToDto(user);
    }

    public async Task<UserDto?> UpdateUserAsync(Guid id, UpdateUserDto updateUserDto)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return null;

        if (!string.IsNullOrEmpty(updateUserDto.Name))
            user.Name = updateUserDto.Name;

        if (updateUserDto.Avatar != null)
            user.Avatar = updateUserDto.Avatar;

        await _context.SaveChangesAsync();
        return MapToDto(user);
    }

    public async Task<UserDto?> UpdateAvatarAsync(Guid userId, IFormFile avatarFile)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return null;

        // Validate file
        if (avatarFile == null || avatarFile.Length == 0)
            throw new ArgumentException("Avatar file is required");

        // Validate file size (max 5MB)
        if (avatarFile.Length > 5 * 1024 * 1024)
            throw new ArgumentException("Avatar file size cannot exceed 5MB");

        // Validate file type
        var allowedTypes = new[] { "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp" };
        if (!allowedTypes.Contains(avatarFile.ContentType.ToLower()))
            throw new ArgumentException("Only image files (JPEG, PNG, GIF, WebP) are allowed");

        // Convert to base64
        using var memoryStream = new MemoryStream();
        await avatarFile.CopyToAsync(memoryStream);
        var fileBytes = memoryStream.ToArray();
        var base64String = Convert.ToBase64String(fileBytes);
        var avatarUrl = $"data:{avatarFile.ContentType};base64,{base64String}";

        user.Avatar = avatarUrl;
        await _context.SaveChangesAsync();
        return MapToDto(user);
    }

    public async Task<UserDto?> UpdateProfileAsync(Guid userId, UpdateUserProfileDto updateProfileDto)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return null;

        if (!string.IsNullOrEmpty(updateProfileDto.Name))
            user.Name = updateProfileDto.Name;

        if (!string.IsNullOrEmpty(updateProfileDto.Avatar))
            user.Avatar = updateProfileDto.Avatar;

        await _context.SaveChangesAsync();
        return MapToDto(user);
    }    public async Task<bool> SetUserOnlineStatusAsync(Guid userId, bool isOnline)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return false;

        user.IsOnline = isOnline;
        if (!isOnline)
            user.LastSeen = DateTime.UtcNow; await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return false;

        // Verify current password
        if (!BCrypt.Net.BCrypt.Verify(currentPassword, user.PasswordHash))
            return false;

        // Hash new password and update
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        await _context.SaveChangesAsync();
        return true;
    }

    private static UserDto MapToDto(User user)
    {
        return new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            Name = user.Name,
            Avatar = user.Avatar,
            IsOnline = user.IsOnline,
            LastSeen = user.LastSeen,
            CreatedAt = user.CreatedAt,
            PasswordHash = user.PasswordHash
        };
    }

    public bool VerifyPassword(UserDto user, string password)
    {
        return BCrypt.Net.BCrypt.Verify(password, user.PasswordHash);
    }

    public Guid GetUserIdFromClaims(ClaimsPrincipal user)
    {
        throw new NotImplementedException();
    }

    private async Task<string> UploadFileAsync(IFormFile file)
    {
        // Implement file upload logic here
        // This is just a placeholder implementation
        return await Task.FromResult("http://example.com/your-uploaded-file.jpg");
    }
    
}
