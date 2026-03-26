using System.Net;
using System.Net.Http.Json;
using HabitHub.Api.Contracts.Auth;
using HabitHub.Tests.Helpers;

namespace HabitHub.Tests.Api;

public class AuthApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AuthApiTests(CustomWebApplicationFactory factory)
    {
        factory.ResetDatabase();
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Register_ReturnsOk_WithValidData()
    {
        var request = new RegisterRequest
        {
            Username = "apiuser",
            Email = $"api-{Guid.NewGuid()}@example.com",
            Password = "Password123!"
        };

        var response = await _client.PostAsJsonAsync("/api/auth/register", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(body);
        Assert.Equal(request.Username, body!.Username);
        Assert.NotEmpty(body.Token);
        Assert.NotEqual(Guid.Empty, body.UserId);
        Assert.NotEqual(Guid.Empty, body.SessionId);
    }

    [Fact]
    public async Task Register_ReturnsBadRequest_WhenEmailDuplicate()
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

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
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

        var body = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(body);
        Assert.Equal("loginuser", body!.Username);
        Assert.NotEmpty(body.Token);
    }

    [Fact]
    public async Task Login_ReturnsBadRequest_WithWrongPassword()
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

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Login_ReturnsBadRequest_WithNonExistentEmail()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Email = "nobody@example.com",
            Password = "Password123!"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
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

        var registerBody = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();

        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Email = email,
            Password = "Password123!"
        });

        var loginBody = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>();

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
}