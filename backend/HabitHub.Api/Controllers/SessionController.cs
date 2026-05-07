using HabitHub.Api.Contracts.Habits;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HabitHub.Api.Util;
using HabitHub.Api.Contracts.Session;

[Authorize]
[ApiController]
[Route("api/sessions")]
public class SessionController : ControllerBase
{
    private readonly HabitHub.Api.Data.AppDbContext _context;

    public SessionController(AppDbContext context)
    {
        _context = context;
    }
    [HttpGet]
    public async Task<ActionResult<List<GetSessionsResponse>>> ViewActiveSessions()
    {
        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized();

        var sessions = await _context.Sessions
            .Where(s =>
                s.MemberId == userId &&
                s.State == SessionState.Active &&
                s.ExpiresAt > DateTime.UtcNow)
            .Select(s => new GetSessionsResponse
            {
                SessionId = s.SessionId,
                MemberId = s.MemberId,
                CreatedAt = s.CreatedAt,
                LastActiveAt = s.LastActiveAt,
                ExpiresAt = s.ExpiresAt,
                Device = s.Device,
                IPAddress = s.IPAddress,
                State = s.State
            })
            .ToListAsync();

        return Ok(sessions);
    }

    [HttpDelete("{sessionId:guid}")]
    public async Task<ActionResult> TerminateSession(Guid sessionId)
    {
        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized();

        var session = await _context.Sessions
            .FirstOrDefaultAsync(s => s.SessionId == sessionId && s.MemberId == userId);

        if (session == null)
            return NotFound();

        session.State = SessionState.Invalidated;
        await _context.SaveChangesAsync();

        return NoContent();
    } 
}