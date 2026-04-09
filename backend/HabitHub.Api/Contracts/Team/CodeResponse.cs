namespace HabitHub.Api.Contracts.Team;
using System.ComponentModel.DataAnnotations;

public class CodeResponse
{
    [Required]
    public string Code { get; set; }
    public DateTime ExpiryDate { get; set; }
    public Guid HabitTeamId { get; set; }
}