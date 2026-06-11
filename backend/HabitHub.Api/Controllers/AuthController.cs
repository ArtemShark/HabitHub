namespace HabitHub.Api.Controllers;

using HabitHub.Api.Contracts.Auth;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Api.Models;
using HabitHub.Api.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromDays(30);

    private readonly AppDbContext _dbContext;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly PasswordHasher<Member> _passwordHasher;

    public AuthController(AppDbContext dbContext, IJwtTokenService jwtTokenService)
    {
        _dbContext = dbContext;
        _jwtTokenService = jwtTokenService;
        _passwordHasher = new PasswordHasher<Member>();
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var exist = await _dbContext.Members.AnyAsync(m => m.Email == email, cancellationToken);
        if (exist)
        {
            return Conflict(new
            {
                error = "email-already-used",
                message = "An account with this email already exists."
            });
        }

        var member = new Member
        {
            Name = request.Username,
            Email = email,
            Timezone = string.IsNullOrWhiteSpace(request.Timezone) ? "UTC" : request.Timezone
        };

        member.PasswordHash = _passwordHasher.HashPassword(member, request.Password);

        _dbContext.Members.Add(member);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var response = await CreateSessionAndTokenAsync(member, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var member = await _dbContext.Members.FirstOrDefaultAsync(m => m.Email == email, cancellationToken);
        if (member == null)
        {
            return Unauthorized(new
            {
                error = "invalid-credentials",
                message = "Invalid email or password."
            });
        }

        var result = _passwordHasher.VerifyHashedPassword(member, member.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
        {
            return Unauthorized(new
            {
                error = "invalid-credentials",
                message = "Invalid email or password."
            });
        }

        var response = await CreateSessionAndTokenAsync(member, cancellationToken);
        return Ok(response);
    }

    private async Task<AuthResponse> CreateSessionAndTokenAsync(Member member, CancellationToken cancellationToken)
    {
        var sessionId = Guid.NewGuid();
        var (token, _) = _jwtTokenService.CreateToken(member, sessionId);

        var now = DateTime.UtcNow;

        var session = new Session
        {
            SessionId = sessionId,
            MemberId = member.MemberId,
            CreatedAt = now,
            LastActiveAt = now,
            ExpiresAt = now.Add(SessionLifetime),
            IPAddress = GetIpAddress(),
            Device = GetDevice(),
            State = SessionState.Active
        };

        _dbContext.Sessions.Add(session);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new AuthResponse
        {
            Token = token,
            UserId = member.MemberId,
            Username = member.Name,
            Email = member.Email,
            SessionId = session.SessionId
        };
    }

    private string GetIpAddress()
    {
        var forwardedFor = HttpContext?.Request?.Headers["X-Forwarded-For"].FirstOrDefault();

        if (!string.IsNullOrWhiteSpace(forwardedFor))
        {
            return forwardedFor.Split(',')[0].Trim();
        }

        return HttpContext?.Connection?.RemoteIpAddress?.ToString()
            ?? "unknown";
    }

    private string GetDevice()
    {
        return HttpContext?.Request?.Headers.UserAgent.ToString()
            ?? "Unknown device";
    }
}
