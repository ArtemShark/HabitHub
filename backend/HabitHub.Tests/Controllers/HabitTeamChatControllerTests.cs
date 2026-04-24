using HabitHub.Api.Data;
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

    [Fact]
    public async Task GetChatMessages_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController();

        var result = await controller.GetChatMessages(Guid.NewGuid());

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task GetChatMessages_WhenTeamMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.GetChatMessages(Guid.NewGuid());

        var notFound = Assert.IsType<NotFoundObjectResult>(result.Result);
        Assert.Equal("Team not found", notFound.Value);
    }

    [Fact]
    public async Task GetChatMessages_WhenNotMember_ReturnsForbid()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var outsider = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        TestHelper.SetAuthenticatedUser(controller, outsider.MemberId);

        var result = await controller.GetChatMessages(team.HabitTeamId);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task GetChatMessages_WhenMember_ReturnsMessagesOrderedBySendDate()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db, name: "Creator");
        var member = TestHelper.SeedMember(db, name: "Member");
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });
        var chat = await db.TeamChats.SingleAsync(c => c.HabitTeamId == team.HabitTeamId);

        var later = new Message
        {
            MessageId = Guid.NewGuid(),
            ChatId = chat.TeamChatId,
            SenderId = creator.MemberId,
            Sender = creator,
            Content = "later",
            SendDate = DateTime.UtcNow.AddMinutes(5)
        };

        var earlier = new Message
        {
            MessageId = Guid.NewGuid(),
            ChatId = chat.TeamChatId,
            SenderId = member.MemberId,
            Sender = member,
            Content = "earlier",
            SendDate = DateTime.UtcNow.AddMinutes(-5)
        };

        db.Messages.AddRange(later, earlier);
        await db.SaveChangesAsync();
        TestHelper.SetAuthenticatedUser(controller, member.MemberId);

        var result = await controller.GetChatMessages(team.HabitTeamId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var messages = Assert.IsAssignableFrom<List<MessageResponse>>(ok.Value);
        Assert.Equal(2, messages.Count);
        Assert.Equal("earlier", messages[0].Content);
        Assert.Equal("later", messages[1].Content);
    }

    [Fact]
    public async Task SendMessage_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController();

        var result = await controller.SendMessage(Guid.NewGuid(), new SendMessageRequest { Content = "hello" });

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task SendMessage_WhenTeamMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.SendMessage(Guid.NewGuid(), new SendMessageRequest { Content = "hello" });

        var notFound = Assert.IsType<NotFoundObjectResult>(result.Result);
        Assert.Equal("Team not found", notFound.Value);
    }

    [Fact]
    public async Task SendMessage_WhenNotMember_ReturnsForbid()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var outsider = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        TestHelper.SetAuthenticatedUser(controller, outsider.MemberId);

        var result = await controller.SendMessage(team.HabitTeamId, new SendMessageRequest { Content = "hello" });

        Assert.IsType<ForbidResult>(result.Result);
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

        var notFound = Assert.IsType<NotFoundObjectResult>(result.Result);
        Assert.Equal("Chat not found", notFound.Value);
    }

    [Fact]
    public async Task SendMessage_HappyPath_PersistsAndReturnsMessage()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        var chat = await db.TeamChats.SingleAsync(c => c.HabitTeamId == team.HabitTeamId);
        TestHelper.SetAuthenticatedUser(controller, creator.MemberId);

        var result = await controller.SendMessage(team.HabitTeamId, new SendMessageRequest
        {
            Content = "Team update",
            ChatId = Guid.NewGuid()
        });

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var body = Assert.IsType<MessageResponse>(ok.Value);
        Assert.Equal(creator.MemberId, body.SenderId);
        Assert.Equal("Team update", body.Content);

        var saved = await db.Messages.SingleAsync(m => m.MessageId == body.MessageId);
        Assert.Equal(chat.TeamChatId, saved.ChatId);
        Assert.Equal(creator.MemberId, saved.SenderId);
    }
}
