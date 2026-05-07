using HabitHub.Api.Contracts.Session;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Api.Models;
using HabitHub.Tests.Helpers;
using Microsoft.AspNetCore.Mvc;

namespace HabitHub.Tests.Controllers;

public class SessionControllerTests
{
    private static (SessionController Controller, AppDbContext Db) CreateController(Guid? userId = null)
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var controller = new SessionController(db);

        if (userId.HasValue)
            TestHelper.SetAuthenticatedUser(controller, userId.Value);
        else
            TestHelper.SetUnauthenticatedUser(controller);

        return (controller, db);
    }

    [Fact]
    public async Task ViewActiveSessions_WithNoUser_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController();

        var result = await controller.ViewActiveSessions();

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task ViewActiveSessions_ReturnsOnlyActiveNonExpiredSessions_ForCurrentUser()
    {
        var userId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var (controller, db) = CreateController(userId);

        var activeSession = new Session
        {
            SessionId = Guid.NewGuid(),
            MemberId = userId,
            CreatedAt = DateTime.UtcNow.AddMinutes(-10),
            LastActiveAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            Device = "Chrome on Windows",
            IPAddress = "127.0.0.1",
            State = SessionState.Active
        };

        db.Sessions.AddRange(
            activeSession,
            new Session
            {
                SessionId = Guid.NewGuid(),
                MemberId = userId,
                CreatedAt = DateTime.UtcNow,
                LastActiveAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(1),
                Device = "Old device",
                IPAddress = "127.0.0.2",
                State = SessionState.Invalidated
            },
            new Session
            {
                SessionId = Guid.NewGuid(),
                MemberId = userId,
                CreatedAt = DateTime.UtcNow,
                LastActiveAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(-1),
                Device = "Expired device",
                IPAddress = "127.0.0.3",
                State = SessionState.Active
            },
            new Session
            {
                SessionId = Guid.NewGuid(),
                MemberId = otherUserId,
                CreatedAt = DateTime.UtcNow,
                LastActiveAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(1),
                Device = "Other user device",
                IPAddress = "127.0.0.4",
                State = SessionState.Active
            }
        );

        await db.SaveChangesAsync();

        var result = await controller.ViewActiveSessions();

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var sessions = Assert.IsType<List<GetSessionsResponse>>(okResult.Value);

        Assert.Single(sessions);
        Assert.Equal(activeSession.SessionId, sessions[0].SessionId);
        Assert.Equal(userId, sessions[0].MemberId);
        Assert.Equal("Chrome on Windows", sessions[0].Device);
        Assert.Equal("127.0.0.1", sessions[0].IPAddress);
        Assert.Equal(SessionState.Active, sessions[0].State);
    }

    [Fact]
    public async Task TerminateSession_WithNoUser_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController();

        var result = await controller.TerminateSession(Guid.NewGuid());

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task TerminateSession_WhenSessionDoesNotExist_ReturnsNotFound()
    {
        var userId = Guid.NewGuid();
        var (controller, _) = CreateController(userId);

        var result = await controller.TerminateSession(Guid.NewGuid());

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task TerminateSession_WhenSessionBelongsToOtherUser_ReturnsNotFound()
    {
        var userId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var (controller, db) = CreateController(userId);

        var session = new Session
        {
            SessionId = Guid.NewGuid(),
            MemberId = otherUserId,
            CreatedAt = DateTime.UtcNow,
            LastActiveAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            Device = "Chrome",
            IPAddress = "127.0.0.1",
            State = SessionState.Active
        };

        db.Sessions.Add(session);
        await db.SaveChangesAsync();

        var result = await controller.TerminateSession(session.SessionId);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task TerminateSession_WhenSessionExists_InvalidatesSession()
    {
        var userId = Guid.NewGuid();
        var (controller, db) = CreateController(userId);

        var session = new Session
        {
            SessionId = Guid.NewGuid(),
            MemberId = userId,
            CreatedAt = DateTime.UtcNow,
            LastActiveAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            Device = "Chrome",
            IPAddress = "127.0.0.1",
            State = SessionState.Active
        };

        db.Sessions.Add(session);
        await db.SaveChangesAsync();

        var result = await controller.TerminateSession(session.SessionId);

        Assert.IsType<NoContentResult>(result);

        var updatedSession = await db.Sessions.FindAsync(session.SessionId);
        Assert.NotNull(updatedSession);
        Assert.Equal(SessionState.Invalidated, updatedSession!.State);
    }
}