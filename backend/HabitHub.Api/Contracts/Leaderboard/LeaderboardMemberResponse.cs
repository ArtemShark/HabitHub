namespace HabitHub.Api.Contracts.Leaderboard;

public class LeaderboardMemberResponse
{
    public Guid MemberId { get; set; }
    public string Username { get; set; }
    public double TotalProgress { get; set; }
    public int Rank { get; set; }
}