namespace HabitHub.Api.Contracts.Member;
public class MemberInfoResponse
{
    public Guid MemberId { get; set; }
    public string Name { get; set; } = string.Empty;
}