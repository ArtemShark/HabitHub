using HabitHub.Api.Enums;

namespace HabitHub.Api.Models;

public class Habit
{
    public Guid HabitId { get; set; }
    public Guid HabitTeamId { get; set; }
    public HabitTeam Team { get; set; } = null!;

    public Guid CreatorId { get; set; }
    public Member Creator { get; set; } = null!;
    public required string Name { get; set; }
    public required string Goal { get; set; }
    public HabitState HabitState { get; set; }
    public DateTime ExpiryDate { get; set; }
    public HabitType HabitType { get; set; }
    public string? Unit { get; set; }
    public ICollection<HabitEntry> Entries { get; set; } = new List<HabitEntry>();
    public ICollection<Reminder> Reminders { get; set; } = new List<Reminder>();
}