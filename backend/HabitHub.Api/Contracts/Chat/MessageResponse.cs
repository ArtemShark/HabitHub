namespace HabitHub.Api.Contracts.Chat;
public class MessageResponse
{
    public Guid MessageId { get; set; }
    public string Content { get; set; } = string.Empty;
    public Guid SenderId { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public DateTime SendDate { get; set; }
}
