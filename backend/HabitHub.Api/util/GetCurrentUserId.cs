using System.Security.Claims;

namespace HabitHub.Api.Util;

public static class GetCurrentUserId
{
    public static Guid? GetUserId(ClaimsPrincipal? user)
    {
        var userIdClaim = user?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (string.IsNullOrWhiteSpace(userIdClaim))
            return null;

        return Guid.TryParse(userIdClaim, out var userId) ? userId : null;
    }
}