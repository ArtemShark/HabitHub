namespace HabitHub.Api.Controllers;

using HabitHub.Api.Contracts.Member;
using HabitHub.Api.Contracts.Team;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

[ApiController]
[Authorize]
[Route("api/teams")]
public class HabitTeamController : ControllerBase
{
    private readonly AppDbContext _context;

    public HabitTeamController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<List<TeamResponse>>> GetMyTeams()
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized();

        var teams = await _context.HabitTeams
            .Include(t => t.Memberships)
                .ThenInclude(m => m.Member)
            .Where(t => t.Memberships.Any(m => m.MemberId == userId.Value))
            .ToListAsync();

        var teamResponses = teams.Select(MapTeamResponse).ToList();
        return Ok(teamResponses);
    }

    [HttpGet("{teamId:guid}")]
    public async Task<ActionResult<TeamResponse>> GetTeam([FromRoute] Guid teamId)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized();

        var team = await _context.HabitTeams
            .Include(t => t.Memberships)
                .ThenInclude(m => m.Member)
            .FirstOrDefaultAsync(t => t.HabitTeamId == teamId);

        if (team == null)
            return NotFound();

        var isMember = team.Memberships.Any(m => m.MemberId == userId.Value);
        if (!isMember)
            return Forbid();

        return Ok(MapTeamResponse(team));
    }

    [HttpPost]
    public async Task<ActionResult<TeamResponse>> CreateTeam(CreateTeamRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized();

        var creator = await _context.Members.FindAsync(userId.Value);
        if (creator == null)
            return Unauthorized();

        var teamId = Guid.NewGuid();

        var chat = new TeamChat
        {
            TeamChatId = Guid.NewGuid(),
            HabitTeamId = teamId
        };

        var team = new HabitTeam
        {
            HabitTeamId = teamId,
            Name = request.Name,
            CreatorId = userId.Value,
            Creator = creator,
            Chat = chat
        };

        chat.Team = team;

        var membership = new Membership
        {
            MembershipId = Guid.NewGuid(),
            MemberId = userId.Value,
            Member = creator,
            HabitTeamId = teamId,
            Team = team,
            Role = MembershipRole.Creator,
            Status = MembershipStatus.Active
        };

        team.Memberships.Add(membership);

        _context.HabitTeams.Add(team);
        await _context.SaveChangesAsync();

        var createdTeam = await _context.HabitTeams
            .Include(t => t.Memberships)
                .ThenInclude(m => m.Member)
            .FirstAsync(t => t.HabitTeamId == teamId);

        return CreatedAtAction(nameof(GetTeam), new { teamId = createdTeam.HabitTeamId }, MapTeamResponse(createdTeam));
    }

    [HttpPost("{teamId:guid}/invite-codes")]
    public async Task<ActionResult<CodeResponse>> GenerateInviteCode([FromRoute] Guid teamId)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized();

        var team = await _context.HabitTeams
            .FirstOrDefaultAsync(t => t.HabitTeamId == teamId);

        if (team == null)
            return NotFound("not-found");

        if (team.CreatorId != userId.Value)
            return Forbid();

        string code;
        do
        {
            code = GenerateInviteCodeValue();
        }
        while (await _context.Set<InviteCode>().AnyAsync(ic => ic.Code == code));

        var inviteCode = new InviteCode
        {
            InviteCodeId = Guid.NewGuid(),
            HabitTeamId = teamId,
            Code = code,
            ExpiryDate = DateTime.UtcNow.AddDays(10),
            CodeStatus = CodeState.Active
        };

        _context.Set<InviteCode>().Add(inviteCode);
        await _context.SaveChangesAsync();

        return StatusCode(StatusCodes.Status201Created, new CodeResponse
        {
            Code = inviteCode.Code,
            ExpiryDate = inviteCode.ExpiryDate,
            HabitTeamId = teamId
        });
    }

    [HttpPost("join")]
    public async Task<ActionResult<TeamResponse>> JoinTeam([FromBody] JoinTeamRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.Code))
            return BadRequest("validation-error");

        var member = await _context.Members.FindAsync(userId.Value);
        if (member == null)
            return Unauthorized();

        var inviteCode = await _context.Set<InviteCode>()
            .Include(i => i.Team)
                .ThenInclude(t => t.Memberships)
                    .ThenInclude(m => m.Member)
            .FirstOrDefaultAsync(i => i.Code == request.Code);

        if (inviteCode == null)
            return NotFound("code-not-found");

        if (inviteCode.ExpiryDate <= DateTime.UtcNow)
        {
            inviteCode.CodeStatus = CodeState.Expired;
            await _context.SaveChangesAsync();
            return Conflict("code-expired");
        }

        if (inviteCode.CodeStatus == CodeState.Invalid)
            return Conflict("code-invalid");

        if (inviteCode.CodeStatus == CodeState.Expired)
            return Conflict("code-expired");

        var alreadyActiveMember = await _context.Memberships.AnyAsync(m =>
            m.HabitTeamId == inviteCode.HabitTeamId &&
            m.MemberId == userId.Value &&
            m.Status == MembershipStatus.Active);

        if (alreadyActiveMember)
            return Conflict("already-member");

        var membership = new Membership
        {
            MembershipId = Guid.NewGuid(),
            MemberId = userId.Value,
            Member = member,
            HabitTeamId = inviteCode.HabitTeamId,
            Team = inviteCode.Team,
            Role = MembershipRole.Member,
            Status = MembershipStatus.Active
        };

        _context.Memberships.Add(membership);
        await _context.SaveChangesAsync();

        var team = await _context.HabitTeams
            .Include(t => t.Memberships)
                .ThenInclude(m => m.Member)
            .FirstAsync(t => t.HabitTeamId == inviteCode.HabitTeamId);

        return Ok(MapTeamResponse(team));
    }

    [HttpPost("{teamId:guid}/members/{memberId:guid}/kick")]
    public async Task<ActionResult<TeamResponse>> KickMember([FromRoute] Guid teamId, [FromRoute] Guid memberId)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized();

        if (userId.Value == memberId)
            return Conflict("cannot-kick-self");

        var team = await _context.HabitTeams
            .Include(t => t.Memberships)
                .ThenInclude(m => m.Member)
            .FirstOrDefaultAsync(t => t.HabitTeamId == teamId);

        if (team == null)
            return NotFound("not-found");

        if (team.CreatorId != userId.Value)
            return Forbid();

        var membership = team.Memberships.FirstOrDefault(m =>
            m.MemberId == memberId &&
            m.Status == MembershipStatus.Active);

        if (membership == null)
            return NotFound("not-found");

        membership.Status = MembershipStatus.Kicked;
        await _context.SaveChangesAsync();

        return Ok(MapTeamResponse(team));
    }

    [HttpPost("{teamId:guid}/leave")]
    public async Task<ActionResult> LeaveTeam([FromRoute] Guid teamId)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized();

        var team = await _context.HabitTeams
            .Include(t => t.Memberships)
            .FirstOrDefaultAsync(t => t.HabitTeamId == teamId);

        if (team == null)
            return NotFound("not-found");

        if (team.CreatorId == userId.Value)
            return Conflict("creator-cannot-leave");

        var membership = team.Memberships.FirstOrDefault(m =>
            m.MemberId == userId.Value &&
            m.Status == MembershipStatus.Active);

        if (membership == null)
            return NotFound("not-found");

        membership.Status = MembershipStatus.Left;
        await _context.SaveChangesAsync();

        return Ok(new { message = "left team" });
    }

    [HttpDelete("{teamId:guid}")]
    public async Task<IActionResult> DeleteTeam([FromRoute] Guid teamId)
    {
        var userId = GetCurrentUserId();
        if (userId == null)
            return Unauthorized();

        var team = await _context.HabitTeams
            .Include(t => t.Memberships)
            .Include(t => t.InviteCodes)
            .Include(t => t.Habits)
            .Include(t => t.Chat)
            .FirstOrDefaultAsync(t => t.HabitTeamId == teamId);

        if (team == null)
            return NotFound("not-found");

        if (team.CreatorId != userId.Value)
            return Forbid();

        _context.HabitTeams.Remove(team);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private static TeamResponse MapTeamResponse(HabitTeam team)
    {
        return new TeamResponse
        {
            HabitTeamId = team.HabitTeamId,
            Name = team.Name,
            CreatorId = team.CreatorId,
            Members = team.Memberships.Select(m => new TeamMemberResponse
            {
                MemberId = m.MemberId,
                Name = m.Member.Name,
                Email = m.Member.Email,
                Role = m.Role,
                Status = m.Status
            }).ToList()
        };
    }

    private Guid? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    private static string GenerateInviteCodeValue()
    {
        return Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
    }
}