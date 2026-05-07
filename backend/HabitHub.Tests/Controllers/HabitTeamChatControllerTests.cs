using HabitHub.Api.Contracts.Chat;
using HabitHub.Api.Controllers;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Api.Models;
using HabitHub.Tests.Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HabitHub.Tests.Controllers;

public class HabitTeamChatControllerTests
{
    private static (HabitTeamChatController controller, AppDbContext db) CreateController(Guid? userId = null)
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var controller = new HabitTeamChatController(db);

        if (userId.HasValue)
            TestHelper.SetAuthenticatedUser(controller, userId.Value);
        else
            TestHelper.SetUnauthenticatedUser(controller);

        return (controller, db);
    }

    private static ObjectResult AssertObjectResult(IActionResult? result, int statusCode, string? expectedError = null)
    {
        var objectResult = Assert.IsAssignableFrom<ObjectResult>(result);
        Assert.Equal(statusCode, objectResult.StatusCode);

        if (expectedError != null)
            Assert.Equal(expectedError, GetError(objectResult.Value));

        return objectResult;
    }

    private static string? GetError(object? value)
    {
        return value?.GetType().GetProperty("error")?.GetValue(value)?.ToString();
    }

    [Fact]
    public async Task GetChatMessages_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController();

        var result = await controller.GetChatMessages(Guid.NewGuid());

        AssertObjectResult(result.Result, 401, "auth-required");
    }

    [Fact]
    public async Task GetChatMessages_WhenTeamMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.GetChatMessages(Guid.NewGuid());

        AssertObjectResult(result.Result, 404, "not-found");
    }

    [Fact]
    public async Task GetChatMessages_WhenUserHasNoTeamAccess_ReturnsForbidden()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var outsider = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        TestHelper.SetAuthenticatedUser(controller, outsider.MemberId);

        var result = await controller.GetChatMessages(team.HabitTeamId);

        AssertObjectResult(result.Result, 403, "forbidden");
    }

    [Fact]
    public async Task GetChatMessages_WhenMembershipIsNotActive_ReturnsForbidden()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });
        var membership = await db.Memberships.SingleAsync(m => m.MemberId == member.MemberId);
        membership.Status = MembershipStatus.Left;
        await db.SaveChangesAsync();
        TestHelper.SetAuthenticatedUser(controller, member.MemberId);

        var result = await controller.GetChatMessages(team.HabitTeamId);

        AssertObjectResult(result.Result, 403, "forbidden");
    }

    [Fact]
    public async Task GetChatMessages_WhenChatMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        var chat = await db.TeamChats.SingleAsync(c => c.HabitTeamId == team.HabitTeamId);
        db.TeamChats.Remove(chat);
        await db.SaveChangesAsync();
        TestHelper.SetAuthenticatedUser(controller, creator.MemberId);

        var result = await controller.GetChatMessages(team.HabitTeamId);

        AssertObjectResult(result.Result, 404, "not-found");
    }

    [Fact]
    public async Task GetChatMessages_WhenMemberHasAccess_ReturnsMessagesOrderedBySendDate()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db, name: "Creator");
        var member = TestHelper.SeedMember(db, name: "Member");
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });
        var chat = await db.TeamChats.SingleAsync(c => c.HabitTeamId == team.HabitTeamId);

        db.Messages.AddRange(
            new Message
            {
                MessageId = Guid.NewGuid(),
                ChatId = chat.TeamChatId,
                SenderId = creator.MemberId,
                Sender = creator,
                Content = "later",
                SendDate = DateTime.UtcNow.AddMinutes(5)
            },
            new Message
            {
                MessageId = Guid.NewGuid(),
                ChatId = chat.TeamChatId,
                SenderId = member.MemberId,
                Sender = member,
                Content = "earlier",
                SendDate = DateTime.UtcNow.AddMinutes(-5)
            });
        await db.SaveChangesAsync();
        TestHelper.SetAuthenticatedUser(controller, member.MemberId);

        var result = await controller.GetChatMessages(team.HabitTeamId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var messages = Assert.IsAssignableFrom<List<MessageResponse>>(ok.Value);
        Assert.Equal(2, messages.Count);
        Assert.Equal("earlier", messages[0].Content);
        Assert.Equal("Member", messages[0].SenderName);
        Assert.Equal("later", messages[1].Content);
        Assert.Equal("Creator", messages[1].SenderName);
    }

    [Fact]
    public async Task SendMessage_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController();

        var result = await controller.SendMessage(Guid.NewGuid(), new SendMessageRequest { Content = "hello" });

        AssertObjectResult(result.Result, 401, "auth-required");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task SendMessage_WithEmptyContent_ReturnsBadRequest(string? content)
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        TestHelper.SetAuthenticatedUser(controller, creator.MemberId);

        var result = await controller.SendMessage(team.HabitTeamId, new SendMessageRequest { Content = content! });

        AssertObjectResult(result.Result, 400, "validation-error");
    }

    [Fact]
    public async Task SendMessage_WithTooLongContent_ReturnsBadRequest()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        TestHelper.SetAuthenticatedUser(controller, creator.MemberId);

        var result = await controller.SendMessage(team.HabitTeamId, new SendMessageRequest
        {
            Content = new string('x', 2001)
        });

        AssertObjectResult(result.Result, 400, "validation-error");
    }

    [Fact]
    public async Task SendMessage_WhenTeamMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.SendMessage(Guid.NewGuid(), new SendMessageRequest { Content = "hello" });

        AssertObjectResult(result.Result, 404, "not-found");
    }

    [Fact]
    public async Task SendMessage_WhenUserHasNoTeamAccess_ReturnsForbidden()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var outsider = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        TestHelper.SetAuthenticatedUser(controller, outsider.MemberId);

        var result = await controller.SendMessage(team.HabitTeamId, new SendMessageRequest { Content = "hello" });

        AssertObjectResult(result.Result, 403, "forbidden");
    }

    [Fact]
    public async Task SendMessage_WhenChatMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        var chat = await db.TeamChats.SingleAsync(c => c.HabitTeamId == team.HabitTeamId);
        db.TeamChats.Remove(chat);
        await db.SaveChangesAsync();
        TestHelper.SetAuthenticatedUser(controller, creator.MemberId);

        var result = await controller.SendMessage(team.HabitTeamId, new SendMessageRequest { Content = "hello" });

        AssertObjectResult(result.Result, 404, "not-found");
    }

    [Fact]
    public async Task SendMessage_HappyPath_PersistsAndReturnsCreatedMessage()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db, name: "Creator");
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        var chat = await db.TeamChats.SingleAsync(c => c.HabitTeamId == team.HabitTeamId);
        TestHelper.SetAuthenticatedUser(controller, creator.MemberId);

        var result = await controller.SendMessage(team.HabitTeamId, new SendMessageRequest
        {
            Content = "  Team update  "
        });

        var created = AssertObjectResult(result.Result, 201);
        var body = Assert.IsType<MessageResponse>(created.Value);
        Assert.Equal(creator.MemberId, body.SenderId);
        Assert.Equal("Creator", body.SenderName);
        Assert.Equal("Team update", body.Content);

        var saved = await db.Messages.SingleAsync(m => m.MessageId == body.MessageId);
        Assert.Equal(chat.TeamChatId, saved.ChatId);
        Assert.Equal(creator.MemberId, saved.SenderId);
        Assert.Equal("Team update", saved.Content);
    }

    [Fact]
    public async Task DeleteMessage_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController();

        var result = await controller.DeleteMessage(Guid.NewGuid(), Guid.NewGuid());

        AssertObjectResult(result, 401, "auth-required");
    }

    [Fact]
    public async Task DeleteMessage_WhenTeamMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.DeleteMessage(Guid.NewGuid(), Guid.NewGuid());

        AssertObjectResult(result, 404, "not-found");
    }

    [Fact]
    public async Task DeleteMessage_WhenUserHasNoTeamAccess_ReturnsForbidden()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var outsider = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        TestHelper.SetAuthenticatedUser(controller, outsider.MemberId);

        var result = await controller.DeleteMessage(team.HabitTeamId, Guid.NewGuid());

        AssertObjectResult(result, 403, "forbidden");
    }

    [Fact]
    public async Task DeleteMessage_WhenMessageMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        TestHelper.SetAuthenticatedUser(controller, creator.MemberId);

        var result = await controller.DeleteMessage(team.HabitTeamId, Guid.NewGuid());

        AssertObjectResult(result, 404, "message-not-found");
    }

    [Fact]
    public async Task DeleteMessage_WhenMemberDeletesOtherUsersMessage_ReturnsForbidden()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var sender = TestHelper.SeedMember(db);
        var otherMember = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { sender.MemberId, otherMember.MemberId });
        var chat = await db.TeamChats.SingleAsync(c => c.HabitTeamId == team.HabitTeamId);
        var message = new Message
        {
            MessageId = Guid.NewGuid(),
            ChatId = chat.TeamChatId,
            SenderId = sender.MemberId,
            Sender = sender,
            Content = "private message",
            SendDate = DateTime.UtcNow
        };
        db.Messages.Add(message);
        await db.SaveChangesAsync();
        TestHelper.SetAuthenticatedUser(controller, otherMember.MemberId);

        var result = await controller.DeleteMessage(team.HabitTeamId, message.MessageId);

        AssertObjectResult(result, 403, "message-not-own");
        Assert.True(await db.Messages.AnyAsync(m => m.MessageId == message.MessageId));
    }

    [Fact]
    public async Task DeleteMessage_WhenSenderDeletesOwnMessage_RemovesMessage()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var sender = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { sender.MemberId });
        var chat = await db.TeamChats.SingleAsync(c => c.HabitTeamId == team.HabitTeamId);
        var message = new Message
        {
            MessageId = Guid.NewGuid(),
            ChatId = chat.TeamChatId,
            SenderId = sender.MemberId,
            Sender = sender,
            Content = "own message",
            SendDate = DateTime.UtcNow
        };
        db.Messages.Add(message);
        await db.SaveChangesAsync();
        TestHelper.SetAuthenticatedUser(controller, sender.MemberId);

        var result = await controller.DeleteMessage(team.HabitTeamId, message.MessageId);

        Assert.IsType<NoContentResult>(result);
        Assert.False(await db.Messages.AnyAsync(m => m.MessageId == message.MessageId));
    }

    [Fact]
    public async Task DeleteMessage_WhenCreatorDeletesMembersMessage_RemovesMessage()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });
        var chat = await db.TeamChats.SingleAsync(c => c.HabitTeamId == team.HabitTeamId);
        var message = new Message
        {
            MessageId = Guid.NewGuid(),
            ChatId = chat.TeamChatId,
            SenderId = member.MemberId,
            Sender = member,
            Content = "member message",
            SendDate = DateTime.UtcNow
        };
        db.Messages.Add(message);
        await db.SaveChangesAsync();
        TestHelper.SetAuthenticatedUser(controller, creator.MemberId);

        var result = await controller.DeleteMessage(team.HabitTeamId, message.MessageId);

        Assert.IsType<NoContentResult>(result);
        Assert.False(await db.Messages.AnyAsync(m => m.MessageId == message.MessageId));
    }
}
