using HabitHub.Api.Contracts.Auth;
using HabitHub.Api.Controllers;
using HabitHub.Tests.Helpers;
using Microsoft.AspNetCore.Mvc;

namespace HabitHub.Tests.Controllers;

public class AuthController_LoginTests
{
    private async Task<AuthController> CreateControllerWithRegisteredUser(
        string email = "test@example.com",
        string password = "Password123!",
        string username = "testuser")
    {
        var dbContext = TestHelper.CreateInMemoryDbContext();
        var jwtMock = TestHelper.CreateMockJwtService();
        var controller = new AuthController(dbContext, jwtMock.Object);

        await controller.Register(new RegisterRequest
        {
            Username = username,
            Email = email,
            Password = password
        }, CancellationToken.None);

        return controller;
    }

    [Fact]
    public async Task Login_WithValidCredentials_ReturnsOkWithAuthResponse()
    {
        var controller = await CreateControllerWithRegisteredUser();

        var request = new LoginRequest
        {
            Email = "test@example.com",
            Password = "Password123!"
        };

        var result = await controller.Login(request, CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<AuthResponse>(okResult.Value);

        Assert.Equal("testuser", response.Username);
        Assert.Equal("test@example.com", response.Email);
        Assert.Equal("fake-jwt-token", response.Token);
        Assert.NotEqual(Guid.Empty, response.UserId);
        Assert.NotEqual(Guid.Empty, response.SessionId);
    }

    [Fact]
    public async Task Login_WithWrongEmail_ReturnsBadRequest()
    {
        var controller = await CreateControllerWithRegisteredUser();

        var request = new LoginRequest
        {
            Email = "wrong@example.com",
            Password = "Password123!"
        };

        var result = await controller.Login(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Login_WithWrongPassword_ReturnsBadRequest()
    {
        var controller = await CreateControllerWithRegisteredUser();

        var request = new LoginRequest
        {
            Email = "test@example.com",
            Password = "WrongPassword!"
        };

        var result = await controller.Login(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Login_NormalizesEmail_ToLowerCase()
    {
        var controller = await CreateControllerWithRegisteredUser();

        var request = new LoginRequest
        {
            Email = "  TEST@EXAMPLE.COM  ",
            Password = "Password123!"
        };

        var result = await controller.Login(request, CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        Assert.IsType<AuthResponse>(okResult.Value);
    }

    [Fact]
    public async Task Login_CreatesNewSession()
    {
        var dbContext = TestHelper.CreateInMemoryDbContext();
        var jwtMock = TestHelper.CreateMockJwtService();
        var controller = new AuthController(dbContext, jwtMock.Object);

        await controller.Register(new RegisterRequest
        {
            Username = "testuser",
            Email = "test@example.com",
            Password = "Password123!"
        }, CancellationToken.None);

        var sessionCountAfterRegister = dbContext.Sessions.Count();

        await controller.Login(new LoginRequest
        {
            Email = "test@example.com",
            Password = "Password123!"
        }, CancellationToken.None);

        Assert.Equal(sessionCountAfterRegister + 1, dbContext.Sessions.Count());
    }

    [Fact]
    public async Task Login_ReturnsCorrectUserId_ForRegisteredUser()
    {
        var dbContext = TestHelper.CreateInMemoryDbContext();
        var jwtMock = TestHelper.CreateMockJwtService();
        var controller = new AuthController(dbContext, jwtMock.Object);

        var registerResult = await controller.Register(new RegisterRequest
        {
            Username = "testuser",
            Email = "test@example.com",
            Password = "Password123!"
        }, CancellationToken.None);

        var registerResponse = (registerResult.Result as OkObjectResult)!.Value as AuthResponse;

        var loginResult = await controller.Login(new LoginRequest
        {
            Email = "test@example.com",
            Password = "Password123!"
        }, CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(loginResult.Result);
        var loginResponse = Assert.IsType<AuthResponse>(okResult.Value);

        Assert.Equal(registerResponse!.UserId, loginResponse.UserId);
    }

    [Fact]
    public async Task Login_WithNonExistentEmail_DoesNotRevealEmailExists()
    {
        var controller = await CreateControllerWithRegisteredUser();

        var resultWrongEmail = await controller.Login(new LoginRequest
        {
            Email = "nonexistent@example.com",
            Password = "Password123!"
        }, CancellationToken.None);

        var resultWrongPassword = await controller.Login(new LoginRequest
        {
            Email = "test@example.com",
            Password = "WrongPassword!"
        }, CancellationToken.None);

        var badRequest1 = Assert.IsType<BadRequestObjectResult>(resultWrongEmail.Result);
        var badRequest2 = Assert.IsType<BadRequestObjectResult>(resultWrongPassword.Result);

        Assert.Equal(badRequest1.Value, badRequest2.Value);
    }

    [Theory]
    [InlineData("test@example.com")]
    [InlineData("  TEST@EXAMPLE.COM  ")]
    [InlineData("Test@Example.Com")]
    [InlineData("  test@EXAMPLE.com")]
    public async Task Login_SucceedsRegardlessOfEmailCasing(string loginEmail)
    {
        var controller = await CreateControllerWithRegisteredUser(
            email: "test@example.com",
            password: "Password123!");

        var result = await controller.Login(new LoginRequest
        {
            Email = loginEmail,
            Password = "Password123!"
        }, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
    }

    [Theory]
    [InlineData("wrong@example.com", "Password123!")]
    [InlineData("test@example.com", "WrongPassword")]
    [InlineData("nobody@test.com", "random")]
    public async Task Login_FailsWithInvalidCredentials(string email, string password)
    {
        var controller = await CreateControllerWithRegisteredUser();

        var result = await controller.Login(new LoginRequest
        {
            Email = email,
            Password = password
        }, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
}