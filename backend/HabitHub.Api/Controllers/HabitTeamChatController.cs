using HabitHub.Api.Contracts.Habits;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HabitHub.Api.Util;
using HabitHub.Api.Models;

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
            return Unauthorized();

        var team = await _context.HabitTeams
            .Include(t => t.Memberships)
            .FirstOrDefaultAsync(t => t.HabitTeamId == teamId);

        if (team == null)
            return NotFound("Team not found");

        var isMember = team.Memberships.Any(m => m.MemberId == userId.Value);
        if (!isMember)
            return Forbid();
        
        var chat = await _context.TeamChats
            .FirstOrDefaultAsync(c => c.HabitTeamId == teamId);

        var messages = await _context.Messages
            .Where(m => m.ChatId == chat.TeamChatId)
            .Include(m => m.Sender)
            .OrderBy(m => m.SendDate)
            .Select(m => new MessageResponse
            {
                MessageId = m.MessageId,
                SenderId = m.SenderId,
                Content = m.Content,
                SendDate = m.SendDate
            })
            .ToListAsync();

        return Ok(messages);
    }

    [HttpPost("messages")]
    public async Task<ActionResult<MessageResponse>> SendMessage(Guid teamId, SendMessageRequest request)
    {
        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized();

        var team = await _context.HabitTeams
            .Include(t => t.Memberships)
            .FirstOrDefaultAsync(t => t.HabitTeamId == teamId);

        if (team == null)
            return NotFound("Team not found");

        var isMember = team.Memberships.Any(m => m.MemberId == userId.Value);
        if (!isMember)
            return Forbid();

        var chat = await _context.TeamChats
            .FirstOrDefaultAsync(c => c.HabitTeamId == teamId);

        if (chat == null)
            return NotFound("Chat not found");

        var message = new Message
        {
            MessageId = Guid.NewGuid(),
            ChatId = chat.TeamChatId,
            SenderId = userId.Value,
            Content = request.Content,
            SendDate = DateTime.UtcNow
        };

        _context.Messages.Add(message);
        await _context.SaveChangesAsync();

        var response = new MessageResponse
        {
            MessageId = message.MessageId,
            SenderId = message.SenderId,
            Content = message.Content,
            SendDate = message.SendDate
        };

        return Ok(response);
    }
}