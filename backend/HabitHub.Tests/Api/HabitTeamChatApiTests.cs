using System.Net;
using System.Net.Http.Json;
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
    public async Task GetMessages_AsNonMember_ReturnsForbidden()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();

        var (outsider, _) = await TestHelper.CreateSecondaryClientAsync(_factory);
        var response = await outsider.GetAsync($"/api/teams/{team.HabitTeamId}/chat/messages");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
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
    public async Task SendMessage_HappyPath_PersistsMessage()
    {
        var auth = await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();

        var response = await _client.PostAsJsonAsync($"/api/teams/{team.HabitTeamId}/chat/messages", new SendMessageRequest
        {
            Content = "Hello team"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<MessageResponse>(TestHelper.JsonOptions);
        Assert.NotNull(body);
        Assert.Equal(auth.UserId, body!.SenderId);
        Assert.Equal("Hello team", body.Content);

        var fetch = await _client.GetAsync($"/api/teams/{team.HabitTeamId}/chat/messages");
        var messages = await fetch.Content.ReadFromJsonAsync<List<MessageResponse>>(TestHelper.JsonOptions);
        Assert.Contains(messages!, m => m.MessageId == body.MessageId && m.Content == "Hello team");
    }
}
