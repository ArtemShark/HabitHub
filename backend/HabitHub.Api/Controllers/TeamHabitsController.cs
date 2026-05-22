using HabitHub.Api.Contracts.Habits;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using HabitHub.Api.Util;

namespace HabitHub.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/teams/{teamId:guid}/habits")]
public class TeamHabitsController : ControllerBase
{
    private readonly AppDbContext _context;

    public TeamHabitsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<List<HabitResponse>>> GetHabits(Guid teamId, [FromQuery] HabitState? state)
    {
        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized();

        var team = await _context.HabitTeams
            .Include(t => t.Memberships)
            .FirstOrDefaultAsync(t => t.HabitTeamId == teamId);

        if (team == null)
            return NotFound("Team not found");

        var isMember = team.CreatorId == userId.Value ||
            team.Memberships.Any(m =>
                m.MemberId == userId.Value &&
                m.Status == MembershipStatus.Active);
        if (!isMember)
            return Forbid();

        var query = _context.Habits.Where(h => h.HabitTeamId == teamId);

        if (state.HasValue)
            query = query.Where(h => h.HabitState == state.Value);

        var habits = await query
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
                Unit = h.Unit,
            ReminderTime = h.ReminderTime
            })
            .ToListAsync();

        return Ok(habits);
    }

    [HttpPost]
    public async Task<ActionResult<HabitResponse>> CreateHabit(Guid teamId, CreateHabitRequest request)
    {
        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized();

        var team = await _context.HabitTeams
            .Include(t => t.Memberships)
            .FirstOrDefaultAsync(t => t.HabitTeamId == teamId);

        if (team == null)
            return NotFound("Team not found");

        if (team.CreatorId != userId.Value)
            return Forbid();

        if (request.HabitType == HabitType.Quantitative && string.IsNullOrWhiteSpace(request.Unit))
            return BadRequest("Unit is required for quantitative habits");

        if (request.ExpiryDate <= DateTime.UtcNow)
            return BadRequest("Expiry date must be in the future");

        var habit = new Habit
        {
            HabitId = Guid.NewGuid(),
            HabitTeamId = teamId,
            CreatorId = userId.Value,
            Name = request.Name,
            Goal = request.Goal,
            HabitState = HabitState.Active,
            ExpiryDate = request.ExpiryDate,
            HabitType = request.HabitType,
            Unit = request.HabitType == HabitType.Binary ? null : request.Unit
        };

        _context.Habits.Add(habit);
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
            Unit = habit.Unit,
            ReminderTime = habit.ReminderTime
        };

        return Created($"/api/habits/{habit.HabitId}", response);
    }
}