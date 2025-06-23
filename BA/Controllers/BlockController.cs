using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BA.Services;
using BA.DTOs;
using System.Security.Claims;

namespace BA.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BlockController : ControllerBase
{
    private readonly IBlockService _blockService;
    private readonly IUserService _userService;
    public BlockController(IBlockService blockService, IUserService userService)
    {
        _blockService = blockService;
        _userService = userService;
    }

        // POST: api/block/{userId}
        [HttpPost("{userId}")]
        public async Task<ActionResult> BlockUser(Guid userId)
        {
            var currentUserId = _userService.GetUserIdFromClaims(User);
            
            if (currentUserId == Guid.Empty)
                return Unauthorized();

            if (currentUserId == userId)
                return BadRequest("You cannot block yourself");

            var result = await _blockService.BlockUserAsync(currentUserId, userId);
            
            if (result != null)
                return Ok(new { message = "User blocked successfully" });
            
            return BadRequest("Failed to block user");
        }

        // DELETE: api/block/{userId}
        [HttpDelete("{userId}")]
        public async Task<ActionResult> UnblockUser(Guid userId)
        {
            var currentUserId = _userService.GetUserIdFromClaims(User);
            
            if (currentUserId == Guid.Empty)
                return Unauthorized();

            var result = await _blockService.UnblockUserAsync(currentUserId, userId);
            
            if (result != null)
                return Ok(new { message = "User unblocked successfully" });
            
            return BadRequest("Failed to unblock user");
        }

    /// <summary>
    /// Block a user
    /// </summary>
    [HttpPost("block")]
    public async Task<ActionResult<BlockStatusDto>> BlockUser([FromBody] BlockUserDto blockUserDto)
    {
        try
        {
            var currentUserId = GetCurrentUserId();
            var result = await _blockService.BlockUserAsync(currentUserId, blockUserDto.BlockedUserId);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while blocking the user", details = ex.Message });
        }
    }

    /// <summary>
    /// Unblock a user
    /// </summary>
    [HttpPost("unblock")]
    public async Task<ActionResult<BlockStatusDto>> UnblockUser([FromBody] UnblockUserDto unblockUserDto)
    {
        try
        {
            var currentUserId = GetCurrentUserId();
            var result = await _blockService.UnblockUserAsync(currentUserId, unblockUserDto.BlockedUserId);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while unblocking the user", details = ex.Message });
        }
    }

    /// <summary>
    /// Get block status between current user and another user
    /// </summary>
    [HttpGet("status/{targetUserId}")]
    public async Task<ActionResult<BlockStatusDto>> GetBlockStatus(Guid targetUserId)
    {
        try
        {
            var currentUserId = GetCurrentUserId();
            var result = await _blockService.GetBlockStatusAsync(currentUserId, targetUserId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while retrieving block status", details = ex.Message });
        }
    }

    /// <summary>
    /// Check if a user is blocked
    /// </summary>
    [HttpGet("is-blocked/{targetUserId}")]
    public async Task<ActionResult<bool>> IsUserBlocked(Guid targetUserId)
    {
        try
        {
            var currentUserId = GetCurrentUserId();
            var isBlocked = await _blockService.IsUserBlockedAsync(currentUserId, targetUserId);
            return Ok(isBlocked);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while checking block status", details = ex.Message });
        }
    }

    /// <summary>
    /// Get list of blocked users
    /// </summary>
    [HttpGet("blocked-users")]
    public async Task<ActionResult<List<UserDto>>> GetBlockedUsers()
    {
        try
        {
            var currentUserId = GetCurrentUserId();
            var blockedUsers = await _blockService.GetBlockedUsersAsync(currentUserId);
            return Ok(blockedUsers);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while retrieving blocked users", details = ex.Message });
        }
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null)
        {
            throw new UnauthorizedAccessException("User ID not found in token");
        }
        return Guid.Parse(userIdClaim.Value);
    }
}
