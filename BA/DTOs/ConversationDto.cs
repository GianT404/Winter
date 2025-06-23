namespace BA.DTOs;

public class ConversationDto
{
    public Guid Id { get; set; }
    public Guid User1Id { get; set; }
    public Guid User2Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public UserDto? User1 { get; set; }
    public UserDto? User2 { get; set; }
    public MessageDto? LastMessage { get; set; }
    public int UnreadCount { get; set; }
}

public class CreateConversationDto
{
    public Guid FriendId { get; set; }
}
