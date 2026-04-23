using HabitHub.Api.Enums;
namespace HabitHub.Api.Contracts.Habits;

public class LogHabitResponse
{
    public Guid HabitEntryId { get; set; }
    public Guid HabitId { get; set; }
    public Guid MemberId { get; set; }
    public EntryStatus Status { get; set; }
    public float? Value { get; set; }
    public string Notes { get; set; } = null!;
    public DateTime Date { get; set; }
}
