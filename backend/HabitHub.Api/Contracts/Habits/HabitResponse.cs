using HabitHub.Api.Models;
using HabitHub.Api.Enums;
using System.ComponentModel.DataAnnotations;

namespace HabitHub.Api.Contracts.Habits;

public class HabitResponse
{
    public Guid HabitId { get; set; }
    public Guid HabitTeamId { get; set; }
    public Guid CreatorId { get; set; }

    public string Name { get; set; } = null!;
    public string Goal { get; set; } = null!;
    public HabitState HabitState { get; set; }
    public DateTime ExpiryDate { get; set; }
    public HabitType HabitType { get; set; }
    public string? Unit { get; set; }
}