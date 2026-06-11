using System.Net;
using System.Net.Http.Json;
using HabitHub.Api.Contracts.Auth;
using HabitHub.Tests.Helpers;

namespace HabitHub.Tests.Api;

public class ProfileApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public ProfileApiTests(CustomWebApplicationFactory factory)
    {
        factory.ResetDatabase();
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task UpdateInfo_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.PutAsJsonAsync("/api/profile/info", new UpdateInfoRequest
        {
            Username = "Updated"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UpdateInfo_HappyPath_AllowsLoginWithUpdatedEmailAndReturnsUpdatedUsername()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client, username: "Alice", email: "alice@example.com", password: "Password123!");

        var updateResponse = await _client.PutAsJsonAsync("/api/profile/info", new UpdateInfoRequest
        {
            Username = "Alice Updated",
            Email = "  NEW@Example.COM  "
        });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        var loginClient = _factory.CreateClient();
        var loginResponse = await loginClient.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Email = "new@example.com",
            Password = "Password123!"
        });

        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(TestHelper.JsonOptions);
        Assert.NotNull(auth);
        Assert.Equal("Alice Updated", auth!.Username);
        Assert.Equal("new@example.com", auth.Email);
    }

    [Fact]
    public async Task UpdateInfo_WhenNoChangesProvided_ReturnsBadRequest()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);

        var response = await _client.PutAsJsonAsync("/api/profile/info", new UpdateInfoRequest());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var text = await response.Content.ReadAsStringAsync();
        Assert.Contains("No changes provided", text);
    }

    [Fact]
    public async Task UpdatePassword_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.PutAsJsonAsync("/api/profile/password", new UpdatePasswordRequest
        {
            CurrentPassword = "Old123!",
            NewPassword = "New123!"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UpdatePassword_WhenCurrentPasswordWrong_ReturnsBadRequest()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client, password: "Password123!");

        var response = await _client.PutAsJsonAsync("/api/profile/password", new UpdatePasswordRequest
        {
            CurrentPassword = "WrongPassword!",
            NewPassword = "NewPassword123!"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var text = await response.Content.ReadAsStringAsync();
        Assert.Contains("Current password is incorrect", text);
    }

    [Fact]
    public async Task UpdatePassword_WhenCurrentPasswordMissing_ReturnsBadRequest()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client, password: "Password123!");

        var response = await _client.PutAsJsonAsync("/api/profile/password", new UpdatePasswordRequest
        {
            CurrentPassword = " ",
            NewPassword = "NewPassword123!"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var text = await response.Content.ReadAsStringAsync();
        Assert.Contains("Current password is required", text);
    }

    [Fact]
    public async Task UpdatePassword_HappyPath_AllowsLoginWithNewPasswordOnly()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client, email: "changeme@example.com", password: "Password123!");

        var updateResponse = await _client.PutAsJsonAsync("/api/profile/password", new UpdatePasswordRequest
        {
            CurrentPassword = "Password123!",
            NewPassword = "NewPassword123!"
        });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        var oldLoginClient = _factory.CreateClient();
        var oldLogin = await oldLoginClient.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Email = "changeme@example.com",
            Password = "Password123!"
        });
        Assert.Equal(HttpStatusCode.Unauthorized, oldLogin.StatusCode);

        var newLoginClient = _factory.CreateClient();
        var newLogin = await newLoginClient.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Email = "changeme@example.com",
            Password = "NewPassword123!"
        });
        Assert.Equal(HttpStatusCode.OK, newLogin.StatusCode);
    }
}
