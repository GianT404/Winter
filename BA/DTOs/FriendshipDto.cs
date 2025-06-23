namespace BA.DTOs;

public class FriendshipDto
{
    public Guid Id { get; set; }
    public Guid RequesterId { get; set; }
    public Guid ReceiverId { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public UserDto? Requester { get; set; }
    public UserDto? Receiver { get; set; }
}

public class SendFriendRequestDto
{
    public string ReceiverEmail { get; set; } = string.Empty;
}

public class RespondToFriendRequestDto
{
    public Guid FriendshipId { get; set; }
    public string Action { get; set; } = string.Empty; // "accept" or "decline"
}
