public class SendMessageRequest
{
    public string Content { get; set; } = string.Empty;
    public Guid ChatId { get; set; }
}