using HabitHub.Api.Models;
using HabitHub.Api.Enums;
using System.ComponentModel.DataAnnotations;

namespace HabitHub.Api.Contracts.Habits;

public class UpdateHabitRequest
{
    public string? Name { get; set; }
    public string? Goal { get; set; }
    public HabitType? HabitType { get; set; }
    public string? Unit { get; set; }
    public DateTime? ExpiryDate { get; set; }
}