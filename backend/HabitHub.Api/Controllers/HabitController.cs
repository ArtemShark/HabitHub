using HabitHub.Api.Contracts.Habits;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HabitHub.Api.Controllers;

[ApiController]
[Route("api/teams/{teamdId}/habits")]
public class HabitController : ControllerBase
{
    private readonly AppDbContext _context;
    public HabitController(AppDbContext context)
    {
        _context = context;
    }
    [HttpGet]
    public async Task<ActionResult<List<HabitResponse>>> GetHabits(Guid teamId)
    {
        var teamExist = await _context.HabitTeams.AnyAsync(t => t.HabitTeamId == teamId);
        if (!teamExist)
        {
            return NotFound("Team not found");
        }
        var habits = await _context.Habits.Where(h => h.HabitTeamId == teamId).ToListAsync();
        var habitResponses = habits.Select(h => new HabitResponse
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
        }).ToList();
        return Ok(habitResponses);
    }

    [HttpGet("{habitId}")]
    public async Task<ActionResult<HabitResponse>> GetHabit(Guid teamId, Guid habitId)
    {
        var teamExist = await _context.HabitTeams.AnyAsync(t => t.HabitTeamId == teamId);
        if (!teamExist)
        {
            return NotFound("Team not found");
        }

        var habit = await _context.Habits.FirstOrDefaultAsync(h => h.HabitId == habitId && h.HabitTeamId == teamId);
        if (habit == null)
        {
            return NotFound("Habit not found");
        }

        var habitResponse = new HabitResponse
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

        return Ok(habitResponse);
    }

    [HttpPost]
    public async Task<ActionResult<HabitResponse>> CreateHabit(Guid teamId, CreateHabitRequest request)
    {
        var teamExist = await _context.HabitTeams.AnyAsync(t => t.HabitTeamId == teamId);
        if (!teamExist)
        {
            return NotFound("Team not found");
        }

        var userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        if (request.HabitType == HabitType.Quantitative && string.IsNullOrEmpty(request.Unit))
        {
            return BadRequest("Unit is required for quantity-based habits");
        }

        if (request.ExpiryDate <= DateTime.UtcNow)
        {
            return BadRequest("Expiry date must be in the future");
        }

        var habit = new Habit
        {
            HabitId = Guid.NewGuid(),
            HabitTeamId = teamId,
            CreatorId = userId, 
            Name = request.Name,
            Goal = request.Goal,
            HabitState = HabitState.Active,
            ExpiryDate = request.ExpiryDate,
            HabitType = request.HabitType,
            Unit = request.Unit
        };

        _context.Habits.Add(habit);
        await _context.SaveChangesAsync();

        var habitResponse = new HabitResponse
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

        return CreatedAtAction(nameof(GetHabit), new { teamId = teamId, habitId = habit.HabitId }, habitResponse);
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return userIdClaim != null ? Guid.Parse(userIdClaim) : Guid.Empty;
        
    }

    [HttpPatch("{habitId}")]
    public async Task<ActionResult<HabitResponse>> UpdateHabit(Guid teamId, Guid habitId, UpdateHabitRequest request)
    {
        var teamExist = await _context.HabitTeams.AnyAsync(t => t.HabitTeamId == teamId);
        if (!teamExist)
        {
            return NotFound("Team not found");
        }

        var habit = await _context.Habits.FirstOrDefaultAsync(h => h.HabitId == habitId && h.HabitTeamId == teamId);
        if (habit == null)
        {
            return NotFound("Habit not found");
        }

        if (request.Name == null)
        {
            return BadRequest("Name is required");
        }

        if (request.Goal == null)
        {
            return BadRequest("Goal is required");
        }

        if (request.HabitType == HabitType.Quantitative && string.IsNullOrEmpty(request.Unit))
        {
            return BadRequest("Unit is required for quantity-based habits");
        }

        if (request.ExpiryDate <= DateTime.UtcNow)
        {
            return BadRequest("Expiry date must be in the future");
        }

        habit.Name = request.Name;
        habit.Goal = request.Goal;
        habit.HabitState = request.HabitState;
        habit.ExpiryDate = request.ExpiryDate;
        habit.HabitType = request.HabitType;
        habit.Unit = request.Unit;

        _context.Habits.Update(habit);
        await _context.SaveChangesAsync();

        var habitResponse = new HabitResponse
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

        return Ok(habitResponse);
    }
}