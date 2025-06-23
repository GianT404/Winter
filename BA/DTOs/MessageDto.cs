namespace BA.DTOs;

public class MessageDto
{
    public Guid Id { get; set; }
    public Guid? ConversationId { get; set; }
    public Guid? GroupId { get; set; }
    public Guid SenderId { get; set; }
    public string Content { get; set; } = string.Empty;
    public string MessageType { get; set; } = "Text";    public bool IsRead { get; set; }
    public DateTime SentAt { get; set; }
    public Guid? ReplyToMessageId { get; set; }
    public UserDto? Sender { get; set; }
    public MessageDto? ReplyToMessage { get; set; }
}

public class SendMessageDto
{
    public Guid? ConversationId { get; set; }
    public Guid? GroupId { get; set; }
    public string Content { get; set; } = string.Empty;
    public string MessageType { get; set; } = "Text";
    public Guid? ReplyToMessageId { get; set; }
}

public class MarkMessagesAsReadDto
{
    public Guid? ConversationId { get; set; }
    public Guid? GroupId { get; set; }
}
