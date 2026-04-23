using HabitHub.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HabitHub.Api.Contracts.Member;

namespace HabitHub.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/members")]
public class MembersController : ControllerBase
{
    private readonly AppDbContext _context;

    public MembersController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("info")]
    public async Task<ActionResult<List<MemberInfoResponse>>> GetBasicMembers([FromQuery] string ids)
    {
        var parsedIds = ids
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(id => Guid.TryParse(id, out var guid) ? guid : Guid.Empty)
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();

        var members = await _context.Members
            .Where(m => parsedIds.Contains(m.MemberId))
            .Select(m => new MemberInfoResponse
            {
                MemberId = m.MemberId,
                Name = m.Name
            })
            .ToListAsync();

        return Ok(members);
    }
}