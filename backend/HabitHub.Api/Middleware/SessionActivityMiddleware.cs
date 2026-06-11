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
        if (context.User.Identity?.IsAuthenticated != true)
        {
            await _next(context);
            return;
        }

        var sessionIdClaim = context.User.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;
        if (string.IsNullOrWhiteSpace(sessionIdClaim) ||
            !Guid.TryParse(sessionIdClaim, out var sessionId))
        {
            await RejectInactiveSessionAsync(context);
            return;
        }

        try
        {
            var now = DateTime.UtcNow;
            var session = await db.Sessions.FirstOrDefaultAsync(s => s.SessionId == sessionId);

            if (session == null ||
                session.State != SessionState.Active ||
                session.ExpiresAt <= now)
            {
                await RejectInactiveSessionAsync(context);
                return;
            }

            if ((now - session.LastActiveAt).TotalSeconds >= ThrottleSeconds)
            {
                session.LastActiveAt = now;
                await db.SaveChangesAsync();
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to validate or update session {SessionId}",
                sessionId);

            await RejectInactiveSessionAsync(context);
            return;
        }

        await _next(context);
    }

    private static async Task RejectInactiveSessionAsync(HttpContext context)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;

        await context.Response.WriteAsJsonAsync(new
        {
            error = "session-inactive",
            message = "Your session is no longer active. Please log in again."
        });
    }
}
