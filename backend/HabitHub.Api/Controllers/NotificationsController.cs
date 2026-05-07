namespace HabitHub.Api.Controllers;

using HabitHub.Api.Data;
using HabitHub.Api.Util;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[Authorize]
[ApiController]
[Route("api/notifications")]
public class NotificationsController : ControllerBase
{
    private readonly AppDbContext _context;

    public NotificationsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetNotifications(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId.GetUserId(User);

        var notifications = await _context.Notifications
            .Where(n => n.MemberId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => new
            {
                n.NotificationId,
                n.Content,
                n.CreatedAt,
                Read = n.IsRead
            })
            .ToListAsync(cancellationToken);

        return Ok(notifications);
    }

    [HttpPut("{notificationId:guid}/read")]
    public async Task<IActionResult> MarkAsRead(Guid notificationId, CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId.GetUserId(User);

        var notification = await _context.Notifications
            .FirstOrDefaultAsync(
                n => n.NotificationId == notificationId && n.MemberId == userId,
                cancellationToken);

        if (notification == null)
            return NotFound();

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            await _context.SaveChangesAsync(cancellationToken);
        }

        return NoContent();
    }
}
