using HabitHub.Api.Enums;
namespace HabitHub.Api.Contracts.Habits;
public class LogHabitRequest
{
    public EntryStatus Status { get; set; }
    public float? Value { get; set; }
    public required string Notes { get; set; }
}