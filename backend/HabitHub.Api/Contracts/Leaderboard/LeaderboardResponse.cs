namespace HabitHub.Api.Contracts.Leaderboard;

public class LeaderboardResponse
{
    public Guid HabitId { get; set; }
    public string HabitName { get; set; } = string.Empty;
    public List<LeaderboardMemberResponse> Entries { get; set; } = new List<LeaderboardMemberResponse>();
}