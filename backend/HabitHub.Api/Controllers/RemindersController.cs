using HabitHub.Api.Contracts.Reminders;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Api.Models;
using HabitHub.Api.Util;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HabitHub.Api.Controllers;

[ApiController]
[Authorize]
public class RemindersController : ControllerBase
{
    private readonly AppDbContext _context;

    public RemindersController(AppDbContext context)
    {
        _context = context;
    }

    [HttpPatch("api/habits/{habitId:guid}/reminder")]
    public async Task<IActionResult> SetReminder(
        [FromRoute] Guid habitId,
        [FromBody] SetReminderRequest request)
    {
        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized();

        var habit = await _context.Habits
            .Include(h => h.Team)
                .ThenInclude(t => t.Memberships)
            .Include(h => h.Reminders)
            .FirstOrDefaultAsync(h => h.HabitId == habitId);

        if (habit == null)
        {
            return NotFound(new
            {
                error = "not-found",
                message = "Habit not found."
            });
        }

        if (habit.Team.CreatorId != userId.Value)
            return Forbid();

        if (request.ReminderTime == default)
        {
            return BadRequest(new
            {
                error = "validation-error",
                message = "Reminder time is required."
            });
        }

        habit.ReminderTime = ToUtc(request.ReminderTime);

        var activeMemberIds = habit.Team.Memberships
            .Where(m => m.Status == MembershipStatus.Active)
            .Select(m => m.MemberId)
            .ToList();

        var existingReminderMemberIds = habit.Reminders
            .Select(r => r.MemberId)
            .ToHashSet();

        foreach (var memberId in activeMemberIds)
        {
            if (!existingReminderMemberIds.Contains(memberId))
            {
                _context.Reminders.Add(new Reminder
                {
                    ReminderId = Guid.NewGuid(),
                    HabitId = habitId,
                    MemberId = memberId,
                    Enabled = true,
                    LastSentAt = DateTime.SpecifyKind(DateTime.MinValue, DateTimeKind.Utc)
                });
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Reminder time set successfully.",
            reminderTime = habit.ReminderTime
        });
    }

    [HttpPatch("api/habits/{habitId:guid}/my-reminder")]
    public async Task<IActionResult> ChangeReminder(
        [FromRoute] Guid habitId,
        [FromBody] ChangeReminderRequest request)
    {
        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized();

        var habit = await _context.Habits
            .Include(h => h.Team)
                .ThenInclude(t => t.Memberships)
            .FirstOrDefaultAsync(h => h.HabitId == habitId);

        if (habit == null)
        {
            return NotFound(new
            {
                error = "not-found",
                message = "Habit not found."
            });
        }

        var isActiveMember = habit.Team.Memberships.Any(m =>
            m.MemberId == userId.Value &&
            m.Status == MembershipStatus.Active);

        if (!isActiveMember)
            return Forbid();

        if (habit.ReminderTime == null)
        {
            return BadRequest(new
            {
                error = "validation-error",
                message = "Reminder time is not configured for this habit."
            });
        }

        var reminder = await _context.Reminders
            .FirstOrDefaultAsync(r =>
                r.HabitId == habitId &&
                r.MemberId == userId.Value);

        if (reminder == null)
        {
            reminder = new Reminder
            {
                ReminderId = Guid.NewGuid(),
                HabitId = habitId,
                MemberId = userId.Value,
                Enabled = request.Enabled,
                LastSentAt = DateTime.SpecifyKind(DateTime.MinValue, DateTimeKind.Utc)
            };

            _context.Reminders.Add(reminder);
        }
        else
        {
            reminder.Enabled = request.Enabled;
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Reminder preference updated.",
            enabled = reminder.Enabled
        });
    }

    [HttpGet("api/reminders/my")]
    public async Task<ActionResult<List<ReminderResponse>>> GetMyReminders()
    {
        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized();

        var reminders = await _context.Reminders
            .Include(r => r.Habit)
                .ThenInclude(h => h.Team)
                    .ThenInclude(t => t.Memberships)
            .Where(r =>
                r.MemberId == userId.Value &&
                r.Habit.HabitState == HabitState.Active &&
                r.Habit.ReminderTime != null &&
                r.Habit.Team.Memberships.Any(m =>
                    m.MemberId == userId.Value &&
                    m.Status == MembershipStatus.Active))
            .Select(r => new ReminderResponse
            {
                ReminderId = r.ReminderId,
                MemberId = r.MemberId,
                HabitId = r.HabitId,
                HabitName = r.Habit.Name,
                Enabled = r.Enabled,
                LastSentAt = r.LastSentAt == DateTime.SpecifyKind(DateTime.MinValue, DateTimeKind.Utc)
                    ? null
                    : r.LastSentAt,
                ReminderTime = r.Habit.ReminderTime
            })
            .ToListAsync();

        return Ok(reminders);
    }

    private static DateTime ToUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }
}