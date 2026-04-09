namespace HabitHub.Api.Contracts.Team;
using HabitHub.Api.Contracts.Member;

public class TeamResponse
{
    public Guid HabitTeamId { get; set; }
    public string Name { get; set; } = null!;
    public Guid CreatorId { get; set; }

    public List<TeamMemberResponse> Members { get; set; } = new();
}