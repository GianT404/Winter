using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BA.Services;
using BA.DTOs;
using System.Security.Claims;

namespace BA.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MessageController : ControllerBase
{
    private readonly IMessageService _messageService;

    public MessageController(IMessageService messageService)
    {
        _messageService = messageService;
    }    [HttpGet("conversation/{conversationId}")]
    public async Task<ActionResult<IEnumerable<MessageDto>>> GetConversationMessages(Guid conversationId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var messages = await _messageService.GetConversationMessagesAsync(conversationId, userId.Value, page, pageSize);
        return Ok(messages);
    }

    /// <summary>
    /// Get conversation messages with optimized pagination
    /// </summary>
    [HttpGet("conversation/{conversationId}/paginated")]
    public async Task<ActionResult<PaginatedMessageDto>> GetConversationMessagesPaginated(
        Guid conversationId, 
        [FromQuery] MessagePaginationDto pagination)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var result = await _messageService.GetConversationMessagesPaginatedAsync(conversationId, userId.Value, pagination);
            return Ok(result);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized("You are not part of this conversation");
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }    [HttpGet("group/{groupId}")]
    public async Task<ActionResult<IEnumerable<MessageDto>>> GetGroupMessages(Guid groupId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var messages = await _messageService.GetGroupMessagesAsync(groupId, userId.Value, page, pageSize);
            return Ok(messages);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized("You are not a member of this group");
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>
    /// Get group messages with optimized pagination
    /// </summary>
    [HttpGet("group/{groupId}/paginated")]
    public async Task<ActionResult<PaginatedMessageDto>> GetGroupMessagesPaginated(
        Guid groupId, 
        [FromQuery] MessagePaginationDto pagination)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var result = await _messageService.GetGroupMessagesPaginatedAsync(groupId, userId.Value, pagination);
            return Ok(result);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized("You are not a member of this group");
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost]
    public async Task<ActionResult<MessageDto>> SendMessage([FromBody] SendMessageDto sendMessageDto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var message = await _messageService.SendMessageAsync(userId.Value, sendMessageDto);
            return Ok(message);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }    [HttpPost("mark-as-read")]
    public async Task<ActionResult> MarkAsRead([FromBody] MarkMessagesAsReadDto markAsReadDto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        try
        {
            bool success;
            
            if (markAsReadDto.ConversationId.HasValue)
            {
                success = await _messageService.MarkMessagesAsReadAsync(markAsReadDto.ConversationId.Value, userId.Value);
            }
            else if (markAsReadDto.GroupId.HasValue)
            {
                success = await _messageService.MarkGroupMessagesAsReadAsync(markAsReadDto.GroupId.Value, userId.Value);
            }
            else
            {
                return BadRequest("Either ConversationId or GroupId must be provided");
            }

            return success ? Ok() : BadRequest("Unable to mark messages as read");
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized("You don't have permission to mark messages as read in this conversation/group");
        }        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("{messageId}")]
    public async Task<ActionResult> DeleteMessage(Guid messageId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var success = await _messageService.DeleteMessageAsync(messageId, userId.Value);
            return success ? Ok() : BadRequest("Unable to delete message or insufficient permissions");
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized("You don't have permission to delete this message");
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
