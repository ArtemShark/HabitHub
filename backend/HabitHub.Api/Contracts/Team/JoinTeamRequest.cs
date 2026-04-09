namespace HabitHub.Api.Contracts.Team;
using System.ComponentModel.DataAnnotations;


public class JoinTeamRequest
{
    [Required]
    public string Code { get; set; }
}