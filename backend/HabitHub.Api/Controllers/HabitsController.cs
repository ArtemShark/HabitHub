using HabitHub.Api.Contracts.Habits;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HabitHub.Api.Util;

namespace HabitHub.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/habits")]
public class HabitsController : ControllerBase
{
    private readonly AppDbContext _context;

    public HabitsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpPatch("{habitId:guid}")]
    public async Task<ActionResult<HabitResponse>> UpdateHabit(Guid habitId, UpdateHabitRequest request)
    {
        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized();

        var habit = await _context.Habits
            .Include(h => h.Team)
            .FirstOrDefaultAsync(h => h.HabitId == habitId);

        if (habit == null)
            return NotFound("Habit not found");

        if (habit.Team.CreatorId != userId.Value)
            return Forbid();

        if (request.Name is not null)
            habit.Name = request.Name;

        if (request.Goal is not null)
            habit.Goal = request.Goal;

        if (request.HabitType.HasValue)
            habit.HabitType = request.HabitType.Value;

        if (request.ExpiryDate.HasValue)
        {
            if (request.ExpiryDate.Value <= DateTime.UtcNow)
                return BadRequest("Expiry date must be in the future");

            habit.ExpiryDate = request.ExpiryDate.Value;
        }

        if (request.Unit is not null)
            habit.Unit = request.Unit;

        if (habit.HabitType == HabitType.Quantitative && string.IsNullOrWhiteSpace(habit.Unit))
            return BadRequest("Unit is required for quantitative habits");

        if (habit.HabitType == HabitType.Binary)
            habit.Unit = null;

        await _context.SaveChangesAsync();

        var response = new HabitResponse
        {
            HabitId = habit.HabitId,
            HabitTeamId = habit.HabitTeamId,
            CreatorId = habit.CreatorId,
            Name = habit.Name,
            Goal = habit.Goal,
            HabitState = habit.HabitState,
            ExpiryDate = habit.ExpiryDate,
            HabitType = habit.HabitType,
            Unit = habit.Unit
        };

        return Ok(response);
    }

    [HttpPost("{habitId:guid}/archive")]
    public async Task<ActionResult<HabitResponse>> ArchiveHabit(Guid habitId)
    {
        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized();

        var habit = await _context.Habits
            .Include(h => h.Team)
            .FirstOrDefaultAsync(h => h.HabitId == habitId);

        if (habit == null)
            return NotFound("Habit not found");

        if (habit.Team.CreatorId != userId.Value)
            return Forbid();

        if (habit.HabitState == HabitState.Archived)
        {
            var archivedResponse = new HabitResponse
            {
                HabitId = habit.HabitId,
                HabitTeamId = habit.HabitTeamId,
                CreatorId = habit.CreatorId,
                Name = habit.Name,
                Goal = habit.Goal,
                HabitState = habit.HabitState,
                ExpiryDate = habit.ExpiryDate,
                HabitType = habit.HabitType,
                Unit = habit.Unit
            };

            return Ok(archivedResponse);
        }

        habit.HabitState = HabitState.Archived;
        await _context.SaveChangesAsync();

        var response = new HabitResponse
        {
            HabitId = habit.HabitId,
            HabitTeamId = habit.HabitTeamId,
            CreatorId = habit.CreatorId,
            Name = habit.Name,
            Goal = habit.Goal,
            HabitState = habit.HabitState,
            ExpiryDate = habit.ExpiryDate,
            HabitType = habit.HabitType,
            Unit = habit.Unit
        };

        return Ok(response);
    }

    [HttpDelete("{habitId:guid}")]
    public async Task<IActionResult> DeleteHabit(Guid habitId)
    {
        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized();

        var habit = await _context.Habits
            .Include(h => h.Team)
            .FirstOrDefaultAsync(h => h.HabitId == habitId);

        if (habit == null)
            return NotFound("Habit not found");

        if (habit.Team.CreatorId != userId.Value)
            return Forbid();

        _context.Habits.Remove(habit);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet]
    public async Task<ActionResult<List<HabitResponse>>> GetHabitsForMember([FromQuery] Guid memberId)
    {
        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized();

        if (userId.Value != memberId)
            return Forbid();

        var habits = await _context.Habits
            .Where(h => h.Team.Memberships.Any(m => m.MemberId == memberId))
            .Select(h => new HabitResponse
            {
                HabitId = h.HabitId,
                HabitTeamId = h.HabitTeamId,
                CreatorId = h.CreatorId,
                Name = h.Name,
                Goal = h.Goal,
                HabitState = h.HabitState,
                ExpiryDate = h.ExpiryDate,
                HabitType = h.HabitType,
                Unit = h.Unit
            })
            .ToListAsync();

        return Ok(habits);
    }

    [HttpPost]
    [Route("{habitId:guid}/entries")]
    public async Task<ActionResult<LogHabitResponse>> LogHabit([FromRoute] Guid habitId, [FromBody] LogHabitRequest request)
    {
        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized();

        var habit = await _context.Habits
            .Include(h => h.Team)
                .ThenInclude(t => t.Memberships)
            .FirstOrDefaultAsync(h => h.HabitId == habitId);
        

        if (habit == null)
            return NotFound("Habit not found");
        
        if (habit.HabitState == HabitState.Archived)
            return Conflict("habit-archived");

        if (habit.HabitState == HabitState.Closed)
            return Conflict("habit-closed");

        var today = DateTime.UtcNow.Date;

        var exists = await _context.HabitEntries.AnyAsync(e =>
            e.HabitId == habitId &&
            e.MemberId == userId.Value &&
            e.Date.Date == today);
        
        if (habit.HabitType == HabitType.Quantitative && request.Value == null)
            return BadRequest("Value required for quantitative habit");

        if (habit.HabitType == HabitType.Binary && request.Value != null)
            return BadRequest("Binary habit should not have value");

        if (exists)
            return Conflict("log-already-exists");

        if (!habit.Team.Memberships.Any(m =>
                m.MemberId == userId.Value &&
                m.Status == MembershipStatus.Active))
        {
            return Forbid();
        }

        var habitEntry = new HabitEntry
        {
            HabitEntryId = Guid.NewGuid(),
            HabitId = habitId,
            MemberId = userId.Value,
            Status = request.Status,
            Value = request.Value,
            Notes = request.Notes,
            Date = DateTime.UtcNow
        };

        _context.HabitEntries.Add(habitEntry);
        await _context.SaveChangesAsync();

        var response = new LogHabitResponse
        {
            HabitEntryId = habitEntry.HabitEntryId,
            HabitId = habitEntry.HabitId,
            MemberId = habitEntry.MemberId,
            Status = habitEntry.Status,
            Value = habitEntry.Value,
            Notes = habitEntry.Notes,
            Date = habitEntry.Date
        };

        return CreatedAtAction(nameof(GetHabitEntries), new { habitId }, response);
    }

    [HttpGet("{habitId:guid}/entries")]
    public async Task<ActionResult<List<LogHabitResponse>>> GetHabitEntries(
        [FromRoute] Guid habitId,
        [FromQuery] DateOnly? date
    )
    {
        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized();

        var habit = await _context.Habits
            .Include(h => h.Team)
                .ThenInclude(t => t.Memberships)
            .FirstOrDefaultAsync(h => h.HabitId == habitId);

        if (habit == null)
            return NotFound("Habit not found");

        if (!habit.Team.Memberships.Any(m => m.MemberId == userId.Value))
            return Forbid();
        
        if (date.HasValue)
        {
            var startOfDayUtc = DateTime.SpecifyKind(
                date.Value.ToDateTime(TimeOnly.MinValue),
                DateTimeKind.Utc);

            var endOfDayUtc = startOfDayUtc.AddDays(1);

            var specificDateEntries = await _context.HabitEntries
                .Where(e =>
                    e.HabitId == habitId &&
                    e.Date >= startOfDayUtc &&
                    e.Date < endOfDayUtc)
                .Select(e => new LogHabitResponse
                {
                    HabitEntryId = e.HabitEntryId,
                    HabitId = e.HabitId,
                    MemberId = e.MemberId,
                    Status = e.Status,
                    Value = e.Value,
                    Notes = e.Notes,
                    Date = e.Date
                })
                .ToListAsync();

            return Ok(specificDateEntries);
        }

        var entries = await _context.HabitEntries
            .Where(e => e.HabitId == habitId)
            .Select(e => new LogHabitResponse
            {
                HabitEntryId = e.HabitEntryId,
                HabitId = e.HabitId,
                MemberId = e.MemberId,
                Status = e.Status,
                Value = e.Value,
                Notes = e.Notes,
                Date = e.Date
            })
            .ToListAsync();

        return Ok(entries);
    }
}