public class MessageResponse
{
    public Guid MessageId { get; set; }
    public string Content { get; set; } = string.Empty;
    public Guid SenderId { get; set; }
    public DateTime SendDate { get; set; }
}