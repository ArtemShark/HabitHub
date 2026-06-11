using HabitHub.Api.Contracts.Auth;
using HabitHub.Api.Controllers;
using HabitHub.Tests.Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace HabitHub.Tests.Controllers;

public class AuthController_RegisterTests
{
    [Fact]
    public async Task Register_WithValidData_ReturnsCreatedWithAuthResponse()
    {
        var dbContext = TestHelper.CreateInMemoryDbContext();
        var jwtMock = TestHelper.CreateMockJwtService();
        var controller = new AuthController(dbContext, jwtMock.Object);

        var request = new RegisterRequest
        {
            Username = "testuser",
            Email = "test@example.com",
            Password = "StrongPassword123!"
        };

        var result = await controller.Register(request, CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status201Created, objectResult.StatusCode);

        var response = Assert.IsType<AuthResponse>(objectResult.Value);
        Assert.Equal("testuser", response.Username);
        Assert.Equal("test@example.com", response.Email);
        Assert.Equal("fake-jwt-token", response.Token);
        Assert.NotEqual(Guid.Empty, response.UserId);
        Assert.NotEqual(Guid.Empty, response.SessionId);
    }

    [Fact]
    public async Task Register_WithDuplicateEmail_ReturnsConflictWithEmailAlreadyUsed()
    {
        var dbContext = TestHelper.CreateInMemoryDbContext();
        var jwtMock = TestHelper.CreateMockJwtService();
        var controller = new AuthController(dbContext, jwtMock.Object);

        var request = new RegisterRequest
        {
            Username = "user1",
            Email = "duplicate@example.com",
            Password = "Password123!"
        };

        await controller.Register(request, CancellationToken.None);

        var secondRequest = new RegisterRequest
        {
            Username = "user2",
            Email = "duplicate@example.com",
            Password = "Password456!"
        };

        var result = await controller.Register(secondRequest, CancellationToken.None);

        var conflict = Assert.IsType<ConflictObjectResult>(result.Result);
        var body = Assert.IsAssignableFrom<object>(conflict.Value);
        Assert.Contains("email-already-used", body.ToString());
    }

    [Fact]
    public async Task Register_NormalizesEmail_ToLowerCase()
    {
        var dbContext = TestHelper.CreateInMemoryDbContext();
        var jwtMock = TestHelper.CreateMockJwtService();
        var controller = new AuthController(dbContext, jwtMock.Object);

        var request = new RegisterRequest
        {
            Username = "testuser",
            Email = "  Test@EXAMPLE.Com  ",
            Password = "Password123!"
        };

        var result = await controller.Register(request, CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status201Created, objectResult.StatusCode);
        var response = Assert.IsType<AuthResponse>(objectResult.Value);
        Assert.Equal("test@example.com", response.Email);
    }

    [Fact]
    public async Task Register_DuplicateCheck_IsCaseInsensitive()
    {
        var dbContext = TestHelper.CreateInMemoryDbContext();
        var jwtMock = TestHelper.CreateMockJwtService();
        var controller = new AuthController(dbContext, jwtMock.Object);

        await controller.Register(new RegisterRequest
        {
            Username = "user1",
            Email = "test@example.com",
            Password = "Password123!"
        }, CancellationToken.None);

        var result = await controller.Register(new RegisterRequest
        {
            Username = "user2",
            Email = "TEST@EXAMPLE.COM",
            Password = "Password456!"
        }, CancellationToken.None);

        Assert.IsType<ConflictObjectResult>(result.Result);
    }

    [Fact]
    public async Task Register_WithoutTimezone_DefaultsToUtc()
    {
        var dbContext = TestHelper.CreateInMemoryDbContext();
        var jwtMock = TestHelper.CreateMockJwtService();
        var controller = new AuthController(dbContext, jwtMock.Object);

        var request = new RegisterRequest
        {
            Username = "testuser",
            Email = "test@example.com",
            Password = "Password123!",
            Timezone = null
        };

        await controller.Register(request, CancellationToken.None);

        var member = dbContext.Members.First();
        Assert.Equal("UTC", member.Timezone);
    }

    [Fact]
    public async Task Register_WithTimezone_UsesProvidedTimezone()
    {
        var dbContext = TestHelper.CreateInMemoryDbContext();
        var jwtMock = TestHelper.CreateMockJwtService();
        var controller = new AuthController(dbContext, jwtMock.Object);

        var request = new RegisterRequest
        {
            Username = "testuser",
            Email = "test@example.com",
            Password = "Password123!",
            Timezone = "Europe/Warsaw"
        };

        await controller.Register(request, CancellationToken.None);

        var member = dbContext.Members.First();
        Assert.Equal("Europe/Warsaw", member.Timezone);
    }

    [Fact]
    public async Task Register_CreatesSessionInDatabase()
    {
        var dbContext = TestHelper.CreateInMemoryDbContext();
        var jwtMock = TestHelper.CreateMockJwtService();
        var controller = new AuthController(dbContext, jwtMock.Object);

        var request = new RegisterRequest
        {
            Username = "testuser",
            Email = "test@example.com",
            Password = "Password123!"
        };

        await controller.Register(request, CancellationToken.None);

        Assert.Single(dbContext.Sessions);
        var session = dbContext.Sessions.First();
        Assert.Equal(dbContext.Members.First().MemberId, session.MemberId);
    }

    [Fact]
    public async Task Register_CreatesSessionExpiringIn30Days()
    {
        var dbContext = TestHelper.CreateInMemoryDbContext();
        var jwtMock = TestHelper.CreateMockJwtService();
        var controller = new AuthController(dbContext, jwtMock.Object);

        var before = DateTime.UtcNow;
        await controller.Register(new RegisterRequest
        {
            Username = "testuser",
            Email = "test@example.com",
            Password = "Password123!"
        }, CancellationToken.None);

        var session = dbContext.Sessions.First();

        Assert.InRange(
            session.ExpiresAt,
            before.AddDays(30).AddSeconds(-5),
            DateTime.UtcNow.AddDays(30).AddSeconds(5));
    }

    [Fact]
    public async Task Register_PassesSessionIdToJwtService()
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

        var session = dbContext.Sessions.First();

        jwtMock.Verify(s => s.CreateToken(
            It.Is<HabitHub.Api.Models.Member>(m => m.MemberId == session.MemberId),
            It.Is<Guid>(g => g == session.SessionId)),
            Times.Once);
    }

    [Fact]
    public async Task Register_StoresHashedPassword_NotPlainText()
    {
        var dbContext = TestHelper.CreateInMemoryDbContext();
        var jwtMock = TestHelper.CreateMockJwtService();
        var controller = new AuthController(dbContext, jwtMock.Object);

        var request = new RegisterRequest
        {
            Username = "testuser",
            Email = "test@example.com",
            Password = "Password123!"
        };

        await controller.Register(request, CancellationToken.None);

        var member = dbContext.Members.First();
        Assert.NotEqual("Password123!", member.PasswordHash);
        Assert.NotEmpty(member.PasswordHash);
    }

    [Theory]
    [InlineData("  TEST@EXAMPLE.COM  ", "test@example.com")]
    [InlineData("User@Gmail.Com", "user@gmail.com")]
    [InlineData(" hello@WORLD.org ", "hello@world.org")]
    public async Task Register_NormalizesEmail_Correctly(string input, string expected)
    {
        var dbContext = TestHelper.CreateInMemoryDbContext();
        var jwtMock = TestHelper.CreateMockJwtService();
        var controller = new AuthController(dbContext, jwtMock.Object);

        var result = await controller.Register(new RegisterRequest
        {
            Username = "testuser",
            Email = input,
            Password = "Password123!"
        }, CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status201Created, objectResult.StatusCode);
        var response = Assert.IsType<AuthResponse>(objectResult.Value);
        Assert.Equal(expected, response.Email);
    }

    [Theory]
    [InlineData(null, "UTC")]
    [InlineData("", "UTC")]
    [InlineData("   ", "UTC")]
    [InlineData("Europe/Warsaw", "Europe/Warsaw")]
    [InlineData("America/New_York", "America/New_York")]
    public async Task Register_HandlesTimezone_Correctly(string? timezone, string expected)
    {
        var dbContext = TestHelper.CreateInMemoryDbContext();
        var jwtMock = TestHelper.CreateMockJwtService();
        var controller = new AuthController(dbContext, jwtMock.Object);

        await controller.Register(new RegisterRequest
        {
            Username = "testuser",
            Email = "test@example.com",
            Password = "Password123!",
            Timezone = timezone
        }, CancellationToken.None);

        var member = dbContext.Members.First();
        Assert.Equal(expected, member.Timezone);
    }
}
