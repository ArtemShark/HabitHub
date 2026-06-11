using System.IdentityModel.Tokens.Jwt;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using Microsoft.EntityFrameworkCore;

namespace HabitHub.Api.Middleware;

public class SessionActivityMiddleware
{
    private const int ThrottleSeconds = 30;

    private readonly RequestDelegate _next;
    private readonly ILogger<SessionActivityMiddleware> _logger;

    public SessionActivityMiddleware(
        RequestDelegate next,
        ILogger<SessionActivityMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, AppDbContext db)
    {
        await _next(context);

        if (context.User.Identity?.IsAuthenticated != true)
            return;

        var sessionIdClaim = context.User.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;
        if (string.IsNullOrEmpty(sessionIdClaim) ||
            !Guid.TryParse(sessionIdClaim, out var sessionId))
        {
            return;
        }

        try
        {
            var session = await db.Sessions.FirstOrDefaultAsync(s =>
                s.SessionId == sessionId && s.State == SessionState.Active);

            if (session == null)
                return;

            var now = DateTime.UtcNow;
            if ((now - session.LastActiveAt).TotalSeconds < ThrottleSeconds)
                return;

            session.LastActiveAt = now;
            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to update LastActiveAt for session {SessionId}",
                sessionId);
        }
    }
}
