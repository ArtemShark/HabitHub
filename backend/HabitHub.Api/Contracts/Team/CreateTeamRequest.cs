namespace HabitHub.Api.Contracts.Team;
using System.ComponentModel.DataAnnotations;

public class CreateTeamRequest
{
    [Required]
    public string Name { get; set; }
}