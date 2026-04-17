using System.Security.Claims;

namespace HabitHub.Api.Util;
public class GetCurrentUserId
{
    public static Guid? GetUserId(ClaimsPrincipal user)
    {
        var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : null;
    }
}