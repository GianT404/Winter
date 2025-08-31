using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using BA.Services;
using BA.DTOs;

namespace BA.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GroupController : ControllerBase
{
    private readonly IGroupService _groupService;

    public GroupController(IGroupService groupService)
    {
        _groupService = groupService;
    }    [HttpPost]
    public async Task<ActionResult<GroupDto>> CreateGroup([FromBody] CreateGroupDto createGroupDto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        try
        {
            Console.WriteLine($"Received CreateGroup request: Name={createGroupDto.Name}, Privacy={createGroupDto.Privacy}, MemberIds={string.Join(",", createGroupDto.MemberIds)}");
            var group = await _groupService.CreateGroupAsync(createGroupDto, userId.Value);
            return group == null ? BadRequest("Unable to create group") : Ok(group);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error creating group: {ex.Message}");
            return BadRequest($"Error creating group: {ex.Message}");
        }
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<GroupDto>>> GetUserGroups()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var groups = await _groupService.GetUserGroupsAsync(userId.Value);
        return Ok(groups);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<GroupDto>> GetGroup(Guid id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var group = await _groupService.GetGroupByIdAsync(id, userId.Value);
        return group == null ? NotFound() : Ok(group);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<GroupDto>> UpdateGroup(Guid id, [FromBody] UpdateGroupDto updateGroupDto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var group = await _groupService.UpdateGroupAsync(id, updateGroupDto, userId.Value);
        return group == null ? BadRequest("Unable to update group") : Ok(group);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteGroup(Guid id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var success = await _groupService.DeleteGroupAsync(id, userId.Value);
        return success ? Ok() : BadRequest("Unable to delete group");
    }    [HttpPost("{id}/members")]
    public async Task<ActionResult> AddMember(Guid id, [FromBody] AddGroupMemberDto addMemberDto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var success = await _groupService.AddMemberAsync(id, userId.Value, addMemberDto.UserId);
        return success ? Ok() : BadRequest("Unable to add member");
    }

    [HttpGet("{id}/members")]
    public async Task<ActionResult<IEnumerable<GroupMemberDto>>> GetGroupMembers(Guid id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var members = await _groupService.GetGroupMembersAsync(id, userId.Value);
        return Ok(members);
    }

    [HttpDelete("{id}/members/{memberId}")]
    public async Task<ActionResult> RemoveMember(Guid id, Guid memberId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var success = await _groupService.RemoveMemberAsync(id, userId.Value, memberId);
        return success ? Ok() : BadRequest("Unable to remove member");
    }

    [HttpPut("{id}/members/{memberId}/role")]
    public async Task<ActionResult> UpdateMemberRole(Guid id, Guid memberId, [FromBody] UpdateMemberRoleDto roleDto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var success = await _groupService.UpdateMemberRoleAsync(id, userId.Value, memberId, roleDto.Role);
        return success ? Ok() : BadRequest("Unable to update member role");
    }

    [HttpGet("search")]
    public async Task<ActionResult<IEnumerable<GroupDto>>> SearchPublicGroups([FromQuery] string? searchTerm = null)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var groups = await _groupService.SearchPublicGroupsAsync(searchTerm ?? "", userId.Value);
        return Ok(groups);
    }

    [HttpPost("join-requests")]
    public async Task<ActionResult<GroupJoinRequestDto>> CreateJoinRequest([FromBody] CreateGroupJoinRequestDto requestDto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var request = await _groupService.CreateJoinRequestAsync(requestDto, userId.Value);
        return request == null ? BadRequest("Unable to create join request") : Ok(request);
    }

    [HttpPost("join-requests/respond")]
    public async Task<ActionResult> RespondToJoinRequest([FromBody] RespondToGroupJoinRequestDto respondDto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var success = await _groupService.RespondToJoinRequestAsync(respondDto, userId.Value);
        return success ? Ok() : BadRequest("Unable to respond to join request");
    }

    [HttpGet("{id}/join-requests")]
    public async Task<ActionResult<IEnumerable<GroupJoinRequestDto>>> GetGroupJoinRequests(Guid id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var requests = await _groupService.GetGroupJoinRequestsAsync(id, userId.Value);
        return Ok(requests);
    }

    private Guid? GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : null;
    }
}

public class UpdateMemberRoleDto
{
    public string Role { get; set; } = "Member";
}
