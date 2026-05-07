using System.Net;
using System.Net.Http.Json;
using HabitHub.Api.Contracts.Auth;
using HabitHub.Api.Contracts.Chat;
using HabitHub.Api.Contracts.Team;
using HabitHub.Api.Data;
using HabitHub.Api.Models;
using HabitHub.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HabitHub.Tests.Api;

public class HabitTeamChatApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public HabitTeamChatApiTests(CustomWebApplicationFactory factory)
    {
        factory.ResetDatabase();
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task<TeamResponse> CreateTeamAsync(HttpClient? client = null, string name = "Chat Team")
    {
        client ??= _client;
        var response = await client.PostAsJsonAsync("/api/teams", new CreateTeamRequest { Name = name });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<TeamResponse>(TestHelper.JsonOptions))!;
    }

    private async Task<CodeResponse> GenerateInviteCodeAsync(Guid teamId)
    {
        var response = await _client.PostAsync($"/api/teams/{teamId}/invite-codes", content: null);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CodeResponse>(TestHelper.JsonOptions))!;
    }

    private async Task<(HttpClient Client, AuthResponse Auth)> CreateMemberAndJoinTeamAsync(Guid teamId)
    {
        var invite = await GenerateInviteCodeAsync(teamId);
        var (memberClient, memberAuth) = await TestHelper.CreateSecondaryClientAsync(_factory);

        var joinResponse = await memberClient.PostAsJsonAsync("/api/teams/join", new JoinTeamRequest
        {
            Code = invite.Code
        });
        joinResponse.EnsureSuccessStatusCode();

        return (memberClient, memberAuth);
    }

    [Fact]
    public async Task GetMessages_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync($"/api/teams/{Guid.NewGuid()}/chat/messages");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SendMessage_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.PostAsJsonAsync($"/api/teams/{Guid.NewGuid()}/chat/messages", new SendMessageRequest
        {
            Content = "Hello"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task DeleteMessage_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.DeleteAsync($"/api/teams/{Guid.NewGuid()}/chat/messages/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetMessages_AsNonMember_ReturnsForbidden()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();

        var (outsider, _) = await TestHelper.CreateSecondaryClientAsync(_factory);
        var response = await outsider.GetAsync($"/api/teams/{team.HabitTeamId}/chat/messages");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task SendMessage_AsNonMember_ReturnsForbidden()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();

        var (outsider, _) = await TestHelper.CreateSecondaryClientAsync(_factory);
        var response = await outsider.PostAsJsonAsync($"/api/teams/{team.HabitTeamId}/chat/messages", new SendMessageRequest
        {
            Content = "I should not access this chat"
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task SendMessage_WithInvalidContent_ReturnsBadRequest(string content)
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();

        var response = await _client.PostAsJsonAsync($"/api/teams/{team.HabitTeamId}/chat/messages", new SendMessageRequest
        {
            Content = content
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetMessages_HappyPath_ReturnsMessagesOrderedBySendDate()
    {
        var creator = await TestHelper.RegisterAndAuthenticateAsync(_client, username: "Creator");
        var team = await CreateTeamAsync();

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var creatorMember = await db.Members.SingleAsync(m => m.MemberId == creator.UserId);
            var chat = await db.TeamChats.SingleAsync(c => c.HabitTeamId == team.HabitTeamId);
            db.Messages.AddRange(
                new Message
                {
                    MessageId = Guid.NewGuid(),
                    ChatId = chat.TeamChatId,
                    SenderId = creator.UserId,
                    Sender = creatorMember,
                    Content = "later",
                    SendDate = DateTime.UtcNow.AddMinutes(3)
                },
                new Message
                {
                    MessageId = Guid.NewGuid(),
                    ChatId = chat.TeamChatId,
                    SenderId = creator.UserId,
                    Sender = creatorMember,
                    Content = "earlier",
                    SendDate = DateTime.UtcNow.AddMinutes(-3)
                });
            await db.SaveChangesAsync();
        }

        var response = await _client.GetAsync($"/api/teams/{team.HabitTeamId}/chat/messages");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var messages = await response.Content.ReadFromJsonAsync<List<MessageResponse>>(TestHelper.JsonOptions);
        Assert.NotNull(messages);
        Assert.Equal(2, messages!.Count);
        Assert.Equal("earlier", messages[0].Content);
        Assert.Equal("later", messages[1].Content);
    }

    [Fact]
    public async Task SendMessage_AsCreator_PersistsAndReturnsCreatedMessage()
    {
        var auth = await TestHelper.RegisterAndAuthenticateAsync(_client, username: "Creator");
        var team = await CreateTeamAsync();

        var response = await _client.PostAsJsonAsync($"/api/teams/{team.HabitTeamId}/chat/messages", new SendMessageRequest
        {
            Content = "Hello team"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<MessageResponse>(TestHelper.JsonOptions);
        Assert.NotNull(body);
        Assert.Equal(auth.UserId, body!.SenderId);
        Assert.Equal("Creator", body.SenderName);
        Assert.Equal("Hello team", body.Content);

        var fetch = await _client.GetAsync($"/api/teams/{team.HabitTeamId}/chat/messages");
        var messages = await fetch.Content.ReadFromJsonAsync<List<MessageResponse>>(TestHelper.JsonOptions);
        Assert.Contains(messages!, m => m.MessageId == body.MessageId && m.Content == "Hello team");
    }

    [Fact]
    public async Task SendMessage_AsTeamMember_PersistsAndReturnsCreatedMessage()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();
        var (memberClient, memberAuth) = await CreateMemberAndJoinTeamAsync(team.HabitTeamId);

        var response = await memberClient.PostAsJsonAsync($"/api/teams/{team.HabitTeamId}/chat/messages", new SendMessageRequest
        {
            Content = "Member message"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<MessageResponse>(TestHelper.JsonOptions);
        Assert.NotNull(body);
        Assert.Equal(memberAuth.UserId, body!.SenderId);
        Assert.Equal("Member message", body.Content);
    }

    [Fact]
    public async Task DeleteMessage_WhenMessageMissing_ReturnsNotFound()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();

        var response = await _client.DeleteAsync($"/api/teams/{team.HabitTeamId}/chat/messages/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteMessage_AsSender_RemovesOwnMessage()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();
        var (memberClient, _) = await CreateMemberAndJoinTeamAsync(team.HabitTeamId);

        var sendResponse = await memberClient.PostAsJsonAsync($"/api/teams/{team.HabitTeamId}/chat/messages", new SendMessageRequest
        {
            Content = "temporary"
        });
        var sent = await sendResponse.Content.ReadFromJsonAsync<MessageResponse>(TestHelper.JsonOptions);

        var deleteResponse = await memberClient.DeleteAsync($"/api/teams/{team.HabitTeamId}/chat/messages/{sent!.MessageId}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        var fetch = await memberClient.GetAsync($"/api/teams/{team.HabitTeamId}/chat/messages");
        var messages = await fetch.Content.ReadFromJsonAsync<List<MessageResponse>>(TestHelper.JsonOptions);
        Assert.DoesNotContain(messages!, m => m.MessageId == sent.MessageId);
    }

    [Fact]
    public async Task DeleteMessage_AsCreator_RemovesMembersMessage()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();
        var (memberClient, _) = await CreateMemberAndJoinTeamAsync(team.HabitTeamId);

        var sendResponse = await memberClient.PostAsJsonAsync($"/api/teams/{team.HabitTeamId}/chat/messages", new SendMessageRequest
        {
            Content = "message to moderate"
        });
        var sent = await sendResponse.Content.ReadFromJsonAsync<MessageResponse>(TestHelper.JsonOptions);

        var deleteResponse = await _client.DeleteAsync($"/api/teams/{team.HabitTeamId}/chat/messages/{sent!.MessageId}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        var fetch = await _client.GetAsync($"/api/teams/{team.HabitTeamId}/chat/messages");
        var messages = await fetch.Content.ReadFromJsonAsync<List<MessageResponse>>(TestHelper.JsonOptions);
        Assert.DoesNotContain(messages!, m => m.MessageId == sent.MessageId);
    }

    [Fact]
    public async Task DeleteMessage_AsOtherMember_ReturnsForbidden()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();
        var (senderClient, _) = await CreateMemberAndJoinTeamAsync(team.HabitTeamId);
        var (otherClient, _) = await CreateMemberAndJoinTeamAsync(team.HabitTeamId);

        var sendResponse = await senderClient.PostAsJsonAsync($"/api/teams/{team.HabitTeamId}/chat/messages", new SendMessageRequest
        {
            Content = "sender only"
        });
        var sent = await sendResponse.Content.ReadFromJsonAsync<MessageResponse>(TestHelper.JsonOptions);

        var deleteResponse = await otherClient.DeleteAsync($"/api/teams/{team.HabitTeamId}/chat/messages/{sent!.MessageId}");

        Assert.Equal(HttpStatusCode.Forbidden, deleteResponse.StatusCode);
        var fetch = await _client.GetAsync($"/api/teams/{team.HabitTeamId}/chat/messages");
        var messages = await fetch.Content.ReadFromJsonAsync<List<MessageResponse>>(TestHelper.JsonOptions);
        Assert.Contains(messages!, m => m.MessageId == sent.MessageId);
    }
}
