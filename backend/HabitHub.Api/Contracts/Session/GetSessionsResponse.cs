using HabitHub.Api.Enums;

namespace HabitHub.Api.Contracts.Session;
public class GetSessionsResponse
{
    public Guid SessionId { get; set; }
    public Guid MemberId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime LastActiveAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public string? Device { get; set; }
    public string? IPAddress { get; set; }
    public SessionState State { get; set; }
}