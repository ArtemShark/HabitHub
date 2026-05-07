namespace HabitHub.Api.Models;

public class Notification
{
    public Guid NotificationId { get; set; }
    public string Content { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsRead { get; set; }
    public Guid MemberId { get; set; }
    public Member Member { get; set; } = null!;
}
