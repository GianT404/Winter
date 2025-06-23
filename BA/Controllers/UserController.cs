using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BA.Services;
using BA.DTOs;
using System.Security.Claims;
using Microsoft.Extensions.Logging;

namespace BA.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UserController : ControllerBase
{
    private readonly IUserService _userService;

    public UserController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet("profile")]
    public async Task<ActionResult<UserDto>> GetProfile()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var user = await _userService.GetUserByIdAsync(userId.Value);
        return user == null ? NotFound() : Ok(user);
    }

    [HttpPut("profile")]
    public async Task<ActionResult<UserDto>> UpdateProfile([FromBody] UpdateUserDto updateUserDto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var user = await _userService.UpdateUserAsync(userId.Value, updateUserDto);
        return user == null ? NotFound() : Ok(user);
    }

    [HttpPost("profile/avatar")]
    public async Task<ActionResult<UserDto>> UpdateAvatar([FromForm] UpdateAvatarDto updateAvatarDto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var user = await _userService.UpdateAvatarAsync(userId.Value, updateAvatarDto.Avatar);
            return user == null ? NotFound() : Ok(user);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception)
        {
            return StatusCode(500, "An error occurred while updating avatar");
        }
    }    [HttpPut("profile/update")]
    public async Task<ActionResult<UserDto>> UpdateProfileInfo([FromBody] UpdateUserProfileDto updateProfileDto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var user = await _userService.UpdateProfileAsync(userId.Value, updateProfileDto);
        return user == null ? NotFound() : Ok(user);
    }

    [HttpPut("change-password")]
    public async Task<ActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var success = await _userService.ChangePasswordAsync(userId.Value, request.CurrentPassword, request.NewPassword);
        
        if (!success)
            return BadRequest(new { message = "Current password is incorrect" });

        return Ok(new { message = "Password changed successfully" });
    }

    [HttpGet("search")]
    public async Task<ActionResult<IEnumerable<UserDto>>> SearchUsers([FromQuery] string email)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        if (string.IsNullOrEmpty(email) || email.Length < 3)
            return BadRequest("Email query must be at least 3 characters long"); var users = await _userService.SearchUsersByEmailAsync(email, userId.Value);
        return Ok(users);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<UserDto>> GetUserById(Guid id)
    {
        var user = await _userService.GetUserByIdAsync(id);
        return user == null ? NotFound() : Ok(user);
    }

    [HttpPost]
    [AllowAnonymous]
    public async Task<ActionResult<UserDto>> CreateUser([FromBody] CreateUserDto createUserDto)
    {
        try
        {
            var user = await _userService.CreateUserAsync(createUserDto);
            return CreatedAtAction(nameof(GetProfile), new { id = user.Id }, user);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    private Guid? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : null;
    }
    
}
