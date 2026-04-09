using HabitHub.Api.Models;
using HabitHub.Api.Enums;
using System.ComponentModel.DataAnnotations;

namespace HabitHub.Api.Contracts.Habits;

public class CreateHabitRequest
{
    [Required]
    public string Name { get; set; } = null!;

    [Required]
    public string Goal { get; set; } = null!;

    [Required]
    public HabitType HabitType { get; set; }

    public string? Unit { get; set; }

    [Required]
    public DateTime ExpiryDate { get; set; }
}