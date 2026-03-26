using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using HabitHub.Api.Models;
using HabitHub.Api.Services;
using Microsoft.Extensions.Configuration;

namespace HabitHub.Tests.Services;

public class JwtTokenServiceTests
{
    private static JwtTokenService CreateService(int expiryMinutes = 60)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "this-is-a-test-key-that-is-long-enough-for-hmac",
                ["Jwt:Issuer"] = "TestIssuer",
                ["Jwt:Audience"] = "TestAudience",
                ["Jwt:ExpiryMinutes"] = expiryMinutes.ToString()
            })
            .Build();

        return new JwtTokenService(config);
    }

    [Fact]
    public void CreateToken_ReturnsNonEmptyToken()
    {
        var service = CreateService();
        var member = new Member { MemberId = Guid.NewGuid(), Email = "test@example.com", Name = "testuser" };

        var (token, _) = service.CreateToken(member);

        Assert.NotNull(token);
        Assert.NotEmpty(token);
    }

    [Fact]
    public void CreateToken_ReturnsValidJwt()
    {
        var service = CreateService();
        var member = new Member { MemberId = Guid.NewGuid(), Email = "test@example.com", Name = "testuser" };

        var (token, _) = service.CreateToken(member);

        var handler = new JwtSecurityTokenHandler();
        Assert.True(handler.CanReadToken(token));
    }

    [Fact]
    public void CreateToken_ContainsCorrectClaims()
    {
        var service = CreateService();
        var memberId = Guid.NewGuid();
        var member = new Member { MemberId = memberId, Email = "test@example.com", Name = "testuser" };

        var (token, _) = service.CreateToken(member);

        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(token);

        Assert.Equal(memberId.ToString(), jwt.Subject);
        Assert.Equal("test@example.com", jwt.Claims.First(c => c.Type == JwtRegisteredClaimNames.Email).Value);
        Assert.Equal("TestIssuer", jwt.Issuer);
        Assert.Contains("TestAudience", jwt.Audiences);
    }

    [Fact]
    public void CreateToken_ExpiresAtCorrectTime()
    {
        var service = CreateService(expiryMinutes: 30);
        var member = new Member { MemberId = Guid.NewGuid(), Email = "test@example.com", Name = "testuser" };

        var timeBefore = DateTime.UtcNow;
        var (_, expiresAt) = service.CreateToken(member);

        Assert.InRange(expiresAt, timeBefore.AddMinutes(30), DateTime.UtcNow.AddMinutes(30).AddSeconds(5));
    }

    [Fact]
    public void CreateToken_ThrowsWhenExpiryMinutesMissing()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "this-is-a-test-key-that-is-long-enough-for-hmac",
                ["Jwt:Issuer"] = "TestIssuer",
                ["Jwt:Audience"] = "TestAudience"
            })
            .Build();

        var service = new JwtTokenService(config);
        var member = new Member { MemberId = Guid.NewGuid(), Email = "test@example.com", Name = "testuser" };

        Assert.Throws<InvalidOperationException>(() => service.CreateToken(member));
    }
}