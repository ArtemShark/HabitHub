using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using HabitHub.Api.Contracts.Auth;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HabitHub.Tests.Api;

public class AuthApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public AuthApiTests(CustomWebApplicationFactory factory)
    {
        factory.ResetDatabase();
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Register_ReturnsCreated_WithValidData()
    {
        var request = new RegisterRequest
        {
            Username = "apiuser",
            Email = $"api-{Guid.NewGuid()}@example.com",
            Password = "Password123!"
        };

        var response = await _client.PostAsJsonAsync("/api/auth/register", request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<AuthResponse>(TestHelper.JsonOptions);
        Assert.NotNull(body);
        Assert.Equal(request.Username, body!.Username);
        Assert.NotEmpty(body.Token);
        Assert.NotEqual(Guid.Empty, body.UserId);
        Assert.NotEqual(Guid.Empty, body.SessionId);
    }

    [Fact]
    public async Task Register_ReturnsConflict_WhenEmailDuplicate()
    {
        var email = $"dup-{Guid.NewGuid()}@example.com";

        var request = new RegisterRequest
        {
            Username = "user1",
            Email = email,
            Password = "Password123!"
        };

        await _client.PostAsJsonAsync("/api/auth/register", request);

        var secondRequest = new RegisterRequest
        {
            Username = "user2",
            Email = email,
            Password = "Password456!"
        };

        var response = await _client.PostAsJsonAsync("/api/auth/register", secondRequest);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var bodyText = await response.Content.ReadAsStringAsync();
        Assert.Contains("email-already-used", bodyText);
    }

    [Fact]
    public async Task Register_PersistsSessionWith30DayExpiry()
    {
        var request = new RegisterRequest
        {
            Username = "expiryuser",
            Email = $"expiry-{Guid.NewGuid()}@example.com",
            Password = "Password123!"
        };

        var before = DateTime.UtcNow;
        var response = await _client.PostAsJsonAsync("/api/auth/register", request);
        var body = await response.Content.ReadFromJsonAsync<AuthResponse>(TestHelper.JsonOptions);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var session = await db.Sessions.FirstAsync(s => s.SessionId == body!.SessionId);

        Assert.InRange(
            session.ExpiresAt,
            before.AddDays(30).AddSeconds(-5),
            DateTime.UtcNow.AddDays(30).AddSeconds(5));
    }

    [Fact]
    public async Task Login_ReturnsOk_WithValidCredentials()
    {
        var email = $"login-{Guid.NewGuid()}@example.com";

        await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest
        {
            Username = "loginuser",
            Email = email,
            Password = "Password123!"
        });

        var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Email = email,
            Password = "Password123!"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<AuthResponse>(TestHelper.JsonOptions);
        Assert.NotNull(body);
        Assert.Equal("loginuser", body!.Username);
        Assert.NotEmpty(body.Token);
    }

    [Fact]
    public async Task Login_ReturnsUnauthorized_WithWrongPassword()
    {
        var email = $"wrong-{Guid.NewGuid()}@example.com";

        await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest
        {
            Username = "testuser",
            Email = email,
            Password = "Password123!"
        });

        var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Email = email,
            Password = "WrongPassword!"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        var bodyText = await response.Content.ReadAsStringAsync();
        Assert.Contains("invalid-credentials", bodyText);
    }

    [Fact]
    public async Task Login_ReturnsUnauthorized_WithNonExistentEmail()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Email = "nobody@example.com",
            Password = "Password123!"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_ReturnsSameUserId_AsRegister()
    {
        var email = $"sameid-{Guid.NewGuid()}@example.com";

        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest
        {
            Username = "sameuser",
            Email = email,
            Password = "Password123!"
        });

        var registerBody = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>(TestHelper.JsonOptions);

        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Email = email,
            Password = "Password123!"
        });

        var loginBody = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(TestHelper.JsonOptions);

        Assert.Equal(registerBody!.UserId, loginBody!.UserId);
    }

    [Fact]
    public async Task Login_WorksWithDifferentEmailCasing()
    {
        var email = $"casing-{Guid.NewGuid()}@example.com";

        await _client.PostAsJsonAsync("/api/auth/register", new RegisterRequest
        {
            Username = "casinguser",
            Email = email,
            Password = "Password123!"
        });

        var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Email = email.ToUpper(),
            Password = "Password123!"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task EmailConfigEndpoint_IsRemoved()
    {
        var response = await _client.GetAsync("/api/email/config");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AuthenticatedRequest_UpdatesSessionLastActiveAt()
    {
        var auth = await TestHelper.RegisterAndAuthenticateAsync(_client);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var session = await db.Sessions.FirstAsync(s => s.SessionId == auth.SessionId);
            session.LastActiveAt = DateTime.UtcNow.AddMinutes(-10);
            await db.SaveChangesAsync();
        }

        var response = await _client.GetAsync("/api/teams");
        response.EnsureSuccessStatusCode();

        await Task.Delay(150);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var session = await db.Sessions.FirstAsync(s => s.SessionId == auth.SessionId);

            var staleness = (DateTime.UtcNow - session.LastActiveAt).TotalSeconds;
            Assert.True(staleness < 60,
                $"Expected LastActiveAt to be recent; staleness was {staleness:F1}s.");
        }
    }

    [Fact]
    public async Task AuthenticatedRequest_WithInvalidatedSession_ReturnsUnauthorized()
    {
        var auth = await TestHelper.RegisterAndAuthenticateAsync(_client);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var session = await db.Sessions.FirstAsync(s => s.SessionId == auth.SessionId);
            session.State = SessionState.Invalidated;
            await db.SaveChangesAsync();
        }

        var response = await _client.GetAsync("/api/teams");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AuthenticatedRequest_WithExpiredSession_ReturnsUnauthorized()
    {
        var auth = await TestHelper.RegisterAndAuthenticateAsync(_client);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var session = await db.Sessions.FirstAsync(s => s.SessionId == auth.SessionId);
            session.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }

        var response = await _client.GetAsync("/api/teams");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UnauthenticatedRequest_DoesNotTouchAnySession()
    {
        var auth = await TestHelper.RegisterAndAuthenticateAsync(_client);

        Guid sessionId = auth.SessionId;
        DateTime initialLastActive;

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var session = await db.Sessions.FirstAsync(s => s.SessionId == sessionId);
            session.LastActiveAt = DateTime.UtcNow.AddDays(-2);
            await db.SaveChangesAsync();
            initialLastActive = session.LastActiveAt;
        }

        var anon = _factory.CreateClient();
        var response = await anon.GetAsync("/api/teams");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        await Task.Delay(100);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var session = await db.Sessions.FirstAsync(s => s.SessionId == sessionId);

            Assert.Equal(initialLastActive, session.LastActiveAt);
        }
    }
}
