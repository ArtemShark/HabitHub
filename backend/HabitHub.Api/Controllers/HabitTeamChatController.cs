using HabitHub.Api.Contracts.Chat;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HabitHub.Api.Util;
using HabitHub.Api.Models;

namespace HabitHub.Api.Controllers;

[Authorize]
[ApiController]
[Route("/api/teams/{teamId:guid}/chat")]
public class HabitTeamChatController : ControllerBase
{
    private readonly AppDbContext _context;

    public HabitTeamChatController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("messages")]
    public async Task<ActionResult<List<MessageResponse>>> GetChatMessages(Guid teamId)
    {
        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized(new { error = "auth-required" });

        var team = await _context.HabitTeams
            .Include(t => t.Memberships)
            .FirstOrDefaultAsync(t => t.HabitTeamId == teamId);

        if (team == null)
            return NotFound(new { error = "not-found" });

        if (!HasTeamAccess(team, userId.Value))
            return StatusCode(403, new { error = "forbidden" });

        var chat = await _context.TeamChats
            .FirstOrDefaultAsync(c => c.HabitTeamId == teamId);

        if (chat == null)
            return NotFound(new { error = "not-found" });

        var messages = await _context.Messages
            .Where(m => m.ChatId == chat.TeamChatId)
            .Include(m => m.Sender)
            .OrderBy(m => m.SendDate)
            .Select(m => new MessageResponse
            {
                MessageId = m.MessageId,
                SenderId = m.SenderId,
                SenderName = m.Sender.Name,
                Content = m.Content,
                SendDate = m.SendDate
            })
            .ToListAsync();

        return Ok(messages);
    }

    [HttpPost("messages")]
    public async Task<ActionResult<MessageResponse>> SendMessage(Guid teamId, [FromBody] SendMessageRequest request)
    {
        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized(new { error = "auth-required" });

        if (request == null || string.IsNullOrWhiteSpace(request.Content))
            return BadRequest(new { error = "validation-error", message = "Message content is required." });

        if (request.Content.Length > 2000)
            return BadRequest(new { error = "validation-error", message = "Message content must not exceed 2000 characters." });

        var team = await _context.HabitTeams
            .Include(t => t.Memberships)
            .FirstOrDefaultAsync(t => t.HabitTeamId == teamId);

        if (team == null)
            return NotFound(new { error = "not-found" });

        if (!HasTeamAccess(team, userId.Value))
            return StatusCode(403, new { error = "forbidden" });

        var chat = await _context.TeamChats
            .FirstOrDefaultAsync(c => c.HabitTeamId == teamId);

        if (chat == null)
            return NotFound(new { error = "not-found" });

        var sender = await _context.Members.FindAsync(userId.Value);
        var senderName = sender?.Name ?? "Unknown";

        var message = new Message
        {
            MessageId = Guid.NewGuid(),
            ChatId = chat.TeamChatId,
            SenderId = userId.Value,
            Content = request.Content.Trim(),
            SendDate = DateTime.UtcNow
        };

        _context.Messages.Add(message);
        await _context.SaveChangesAsync();

        var response = new MessageResponse
        {
            MessageId = message.MessageId,
            SenderId = message.SenderId,
            SenderName = senderName,
            Content = message.Content,
            SendDate = message.SendDate
        };

        return StatusCode(201, response);
    }

    [HttpDelete("messages/{messageId:guid}")]
    public async Task<IActionResult> DeleteMessage(Guid teamId, Guid messageId)
    {
        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized(new { error = "auth-required" });

        var team = await _context.HabitTeams
            .Include(t => t.Memberships)
            .FirstOrDefaultAsync(t => t.HabitTeamId == teamId);

        if (team == null)
            return NotFound(new { error = "not-found" });

        if (!HasTeamAccess(team, userId.Value))
            return StatusCode(403, new { error = "forbidden" });

        var chat = await _context.TeamChats
            .FirstOrDefaultAsync(c => c.HabitTeamId == teamId);

        if (chat == null)
            return NotFound(new { error = "not-found" });

        var message = await _context.Messages
            .FirstOrDefaultAsync(m => m.MessageId == messageId && m.ChatId == chat.TeamChatId);

        if (message == null)
            return NotFound(new { error = "message-not-found" });

        bool isCreator = team.CreatorId == userId.Value;
        bool isOwnMessage = message.SenderId == userId.Value;

        if (!isCreator && !isOwnMessage)
            return StatusCode(403, new { error = "message-not-own" });

        _context.Messages.Remove(message);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private static bool HasTeamAccess(HabitTeam team, Guid userId)
    {
        if (team.CreatorId == userId)
            return true;

        return team.Memberships.Any(m =>
            m.MemberId == userId && m.Status == MembershipStatus.Active);
    }
}
