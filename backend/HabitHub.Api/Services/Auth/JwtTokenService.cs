using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HabitHub.Api.Models;
using Microsoft.IdentityModel.Tokens;

namespace HabitHub.Api.Services;

public class JwtTokenService : IJwtTokenService
{
    private readonly IConfiguration _configuration;

    public JwtTokenService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public (string Token, DateTime ExpiresAtUtc) CreateToken(Member member, Guid sessionId)
    {
        var issuer = _configuration["Jwt:Issuer"]!;
        var audience = _configuration["Jwt:Audience"]!;
        var key = _configuration["Jwt:Key"]!;
        var expiryMinutes = _configuration.GetValue<int?>("Jwt:ExpiryMinutes")
            ?? throw new InvalidOperationException("Jwt:ExpiryMinutes is missing from configuration.");

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, member.MemberId.ToString()),
            new(JwtRegisteredClaimNames.Email, member.Email),
            new(JwtRegisteredClaimNames.Jti, sessionId.ToString()),
            new(ClaimTypes.Name, member.Name),
            new(ClaimTypes.NameIdentifier, member.MemberId.ToString())
        };


        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        var expiresAtUtc = DateTime.UtcNow.AddMinutes(expiryMinutes);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: expiresAtUtc,
            signingCredentials: credentials
        );

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAtUtc);
    }
}
