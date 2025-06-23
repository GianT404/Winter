using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using BA.Services;
using BA.DTOs;
using Microsoft.AspNetCore.SignalR;
using System;
using System.Threading.Tasks;
using System.Collections.Generic;
using BA.Hubs;

namespace BA.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FriendshipController : ControllerBase
{    private readonly IFriendshipService _friendshipService;
    private readonly IUserService _userService;
    private readonly IHubContext<ChatHub> _hubContext;

    public FriendshipController(
        IFriendshipService friendshipService,
        IUserService userService,
        IHubContext<ChatHub> hubContext)
    {
        _friendshipService = friendshipService;
        _userService = userService;
        _hubContext = hubContext;
    }

    [HttpGet("test")]
    public ActionResult<string> Test()
    {
        return Ok("Friendship controller is working!");
    }

    [HttpPost("send-request")]
    [Authorize]
    // public async Task<ActionResult<FriendshipDto>> SendFriendRequest([FromBody] SendFriendRequestDto sendFriendRequestDto)
    // {
    //     var userId = GetUserId();
    //     if (userId == null) return Unauthorized();

    //     var friendship = await _friendshipService.SendFriendRequestAsync(userId.Value, sendFriendRequestDto.ReceiverEmail);
    //     return friendship == null ? BadRequest("Unable to send friend request") : Ok(friendship);
    // }
    public async Task<ActionResult> SendFriendRequest([FromBody] SendFriendRequestDto dto)
{
    try 
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();
        
        var senderId = userId.Value;
        await _friendshipService.SendFriendRequestAsync(senderId, dto.ReceiverEmail);
        
        // Send real-time notification
        var receiver = await _userService.GetUserByEmailAsync(dto.ReceiverEmail);
        if (receiver != null)
        {
            await _hubContext.Clients.User(receiver.Id.ToString())
                .SendAsync("FriendRequestReceived", new { SenderId = senderId });
        }
        
        return Ok(new { message = "Friend request sent successfully" });
    }
    catch (Exception ex)
    {
        return BadRequest(new { message = ex.Message });
    }
}

    [HttpGet("requests")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<FriendshipDto>>> GetFriendRequests()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var requests = await _friendshipService.GetFriendRequestsAsync(userId.Value);
        return Ok(requests);
    }

    [HttpPost("respond")]
    [Authorize]
    public async Task<ActionResult> RespondToFriendRequest([FromBody] RespondToFriendRequestDto respondDto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var success = await _friendshipService.RespondToFriendRequestAsync(respondDto.FriendshipId, userId.Value, respondDto.Action);
        return success ? Ok() : BadRequest("Unable to respond to friend request");
    }
    
    [HttpGet("pending-requests")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<FriendshipDto>>> GetPendingRequests()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var requests = await _friendshipService.GetPendingFriendRequestsAsync(userId.Value);
        return Ok(requests);
    }

    [HttpGet("friends")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetFriends()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var friends = await _friendshipService.GetFriendsAsync(userId.Value);
        return Ok(friends);
    }

    private Guid? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : null;
    }
}
