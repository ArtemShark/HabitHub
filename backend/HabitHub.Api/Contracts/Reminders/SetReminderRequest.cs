using System.ComponentModel.DataAnnotations;

namespace HabitHub.Api.Contracts.Reminders;

public class SetReminderRequest
{
    [Required]
    public DateTime ReminderTime { get; set; }
}