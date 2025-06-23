using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BA.Services;
using BA.DTOs;
using System.Security.Claims;

namespace BA.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ConversationController : ControllerBase
{
    private readonly IConversationService _conversationService;

    public ConversationController(IConversationService conversationService)
    {
        _conversationService = conversationService;
    }    [HttpGet]
    public async Task<ActionResult<IEnumerable<ConversationDto>>> GetConversations()
    {
        try
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var conversations = await _conversationService.GetUserConversationsAsync(userId.Value);
            return Ok(conversations);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error in GetConversations: {ex.Message}");
            Console.WriteLine($"Stack trace: {ex.StackTrace}");
            return StatusCode(500, new { message = "An error occurred while retrieving conversations", details = ex.Message });
        }
    }[HttpPost]
    public async Task<ActionResult<ConversationDto>> CreateConversation([FromBody] CreateConversationDto createConversationDto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var conversation = await _conversationService.CreateOrGetConversationAsync(userId.Value, createConversationDto.FriendId);
        return conversation == null ? BadRequest("Unable to create conversation") : Ok(conversation);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ConversationDto>> GetConversation(Guid id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var conversation = await _conversationService.GetConversationByIdAsync(id, userId.Value);
        return conversation == null ? NotFound() : Ok(conversation);
    }

    private Guid? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : null;
    }
}
