using HabitHub.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HabitHub.Api.Models;
using HabitHub.Api.Contracts.Team;
using HabitHub.Api.Enums;
using Microsoft.EntityFrameworkCore;
using HabitHub.Api.Util;

[ApiController]
[Authorize]
[Route("api/teams")]
public class GenerateCodeController : ControllerBase
{
    private readonly AppDbContext _context;

    public GenerateCodeController(AppDbContext context)
    {
        _context = context;
    }
    [HttpPost("{teamId:guid}/invite-codes")]
    public async Task<IActionResult> GenerateInviteCode(Guid teamId)
    {
        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized();

        var team = await _context.HabitTeams
            .FirstOrDefaultAsync(t => t.HabitTeamId == teamId);

        if (team == null)
            return NotFound(new { error = "not-found", message = "Team not found." });

        if (team.CreatorId != userId.Value)
            return Forbid();

        var code = await GenerateUniqueCodeAsync();

        var inviteCode = new InviteCode
        {
            InviteCodeId = Guid.NewGuid(),
            Code = code,
            HabitTeamId = teamId,
            ExpiryDate = DateTime.UtcNow.AddDays(10),
            CodeStatus = CodeState.Active
        };

        _context.InviteCodes.Add(inviteCode);
        await _context.SaveChangesAsync();

        var response = new CodeResponse
        {
            Code = inviteCode.Code,
            ExpiryDate = inviteCode.ExpiryDate,
            HabitTeamId = inviteCode.HabitTeamId
        };

        return CreatedAtAction(
            nameof(GenerateInviteCode),
            new { teamId = teamId },
            response
        );
    }

    [HttpPost("join")]
    public async Task<IActionResult> JoinTeam([FromBody] JoinTeamRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var userId = GetCurrentUserId.GetUserId(User);
        if (userId == null)
            return Unauthorized();

        var inviteCode = await _context.InviteCodes
            .FirstOrDefaultAsync(c => c.Code == request.Code);

        if (inviteCode == null)
        {
            return NotFound(new
            {
                error = "code-not-found",
                message = "Invite code was not found."
            });
        }

        if (inviteCode.CodeStatus == CodeState.Invalid)
        {
            return Conflict(new
            {
                error = "code-invalid",
                message = "Invite code is invalid."
            });
        }

        if (inviteCode.CodeStatus == CodeState.Expired || inviteCode.ExpiryDate <= DateTime.UtcNow)
        {
            if (inviteCode.CodeStatus != CodeState.Expired)
            {
                inviteCode.CodeStatus = CodeState.Expired;
                await _context.SaveChangesAsync();
            }

            return Conflict(new
            {
                error = "code-expired",
                message = "Invite code has expired."
            });
        }

        var team = await _context.HabitTeams
            .FirstOrDefaultAsync(t => t.HabitTeamId == inviteCode.HabitTeamId);

        if (team == null)
        {
            return NotFound(new
            {
                error = "not-found",
                message = "Team linked to this invite code was not found."
            });
        }

        var existingMembership = await _context.Memberships
            .FirstOrDefaultAsync(m =>
                m.MemberId == userId.Value &&
                m.HabitTeamId == inviteCode.HabitTeamId &&
                m.Status == MembershipStatus.Active);

        if (existingMembership != null)
        {
            return Conflict(new
            {
                error = "already-member",
                message = "User is already a member of this team."
            });
        }

        var membership = new Membership
        {
            MembershipId = Guid.NewGuid(),
            MemberId = userId.Value,
            HabitTeamId = inviteCode.HabitTeamId,
            Status = MembershipStatus.Active,
            Role = MembershipRole.Member
        };

        _context.Memberships.Add(membership);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Joined team successfully.",
            teamId = team.HabitTeamId
        });
    }

    private async Task<string> GenerateUniqueCodeAsync()
    {
        string code;

        do
        {
            code = Guid.NewGuid()
                .ToString("N")
                .Substring(0, 8)
                .ToUpperInvariant();
        }
        while (await _context.InviteCodes.AnyAsync(c => c.Code == code && c.CodeStatus == CodeState.Active));

        return code;
    }
}