using System.Xml.Serialization;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using HabitHub.Api.Enums;

namespace HabitHub.Api.Models;

public class Session
{
    public Guid SessionId { get; set; }

    public Guid MemberId { get; set; }
    public Member Member { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastActiveAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public SessionState State { get; set; } = SessionState.Active;
    public string Device { get; set; } = string.Empty;
    public string IPAddress { get; set; } = string.Empty;
}