namespace HabitHub.Api.Contracts.Member;

using HabitHub.Api.Enums;

public class TeamMemberResponse
{
    public Guid MemberId { get; set; }
    public string Name { get; set; } = null!;
    public string Email { get; set; } = null!;

    public MembershipRole Role { get; set; } = MembershipRole.Member;
    public MembershipStatus Status { get; set; } = MembershipStatus.Active;
}