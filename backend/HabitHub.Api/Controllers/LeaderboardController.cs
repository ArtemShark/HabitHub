namespace HabitHub.Api.Controllers;

using HabitHub.Api.Contracts.Member;
using HabitHub.Api.Contracts.Team;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HabitHub.Api.Util;
using HabitHub.Api.Contracts.Leaderboard;

[ApiController]
[Authorize]
[Route("api/habits")]
public class LeaderboardController : ControllerBase
{
    private readonly AppDbContext _context;

    public LeaderboardController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("{habitId:guid}/leaderboard")]
    public async Task<ActionResult<LeaderboardResponse>> ViewLeaderboard([FromRoute] Guid habitId)
    {
        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized();

        var habit = await _context.Habits
            .Include(h => h.Entries)
                .ThenInclude(e => e.Member)
            .Where(h => h.HabitId == habitId)
            .FirstOrDefaultAsync();
        if (habit == null)
            return NotFound();

        var isMember = await _context.Memberships.AnyAsync(m =>
            m.MemberId == userId.Value &&
            m.Team.HabitTeamId == habit.HabitTeamId &&
            m.Status == MembershipStatus.Active);
        if (!isMember)
            return Forbid();
        var members = habit.Entries
            .GroupBy(e => e.Member)
            .Select(g => new LeaderboardMemberResponse
            {
                MemberId = g.Key.MemberId,
                Username = g.Key.Name,
                TotalProgress = g.Sum(e => habit.HabitType == HabitType.Binary ? 1 : e.Value ?? 0),
                Rank = 0 // Rank will be calculated after sorting
            })
            .OrderByDescending(m => m.TotalProgress)
            .ToList();

        for (int i = 0; i < members.Count; i++)
        {
            members[i].Rank = i + 1;
        }
        return Ok(new LeaderboardResponse { 
            Entries = members,
            HabitId = habit.HabitId,
            HabitName = habit.Name
        });
    }

}