namespace HabitHub.Api.Contracts.Reminders;

public class ReminderResponse
{
    public Guid ReminderId { get; set; }
    public Guid MemberId { get; set; }
    public Guid HabitId { get; set; }
    public string HabitName { get; set; } = null!;
    public bool Enabled { get; set; }
    public DateTime? LastSentAt { get; set; }
    public DateTime? ReminderTime { get; set; }
}