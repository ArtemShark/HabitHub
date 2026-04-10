using System.Net;
using System.Net.Http.Json;
using HabitHub.Api.Contracts.Habits;
using HabitHub.Api.Contracts.Team;
using HabitHub.Api.Enums;
using HabitHub.Tests.Helpers;

namespace HabitHub.Tests.Api;

public class HabitsApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public HabitsApiTests(CustomWebApplicationFactory factory)
    {
        factory.ResetDatabase();
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task<TeamResponse> CreateTeamAsync(HttpClient? client = null, string name = "Habits team")
    {
        client ??= _client;
        var response = await client.PostAsJsonAsync("/api/teams", new CreateTeamRequest { Name = name });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<TeamResponse>())!;
    }


    [Fact]
    public async Task GetHabits_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync($"/api/teams/{Guid.NewGuid()}/habits");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateHabit_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/teams/{Guid.NewGuid()}/habits",
            new CreateHabitRequest
            {
                Name = "X",
                Goal = "Y",
                HabitType = HabitType.Binary,
                ExpiryDate = DateTime.UtcNow.AddDays(1)
            });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    
    [Theory]
    [InlineData(HabitType.Binary, null)]
    [InlineData(HabitType.Quantitative, "glasses")]
    [InlineData(HabitType.Quantitative, "km")]
    public async Task CreateHabit_HappyPath_ReturnsCreatedAndPersists(HabitType type, string? unit)
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();

        var response = await _client.PostAsJsonAsync(
            $"/api/teams/{team.HabitTeamId}/habits",
            new CreateHabitRequest
            {
                Name = "Walk daily",
                Goal = "10000 steps",
                HabitType = type,
                Unit = unit,
                ExpiryDate = DateTime.UtcNow.AddDays(30)
            });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var habit = await response.Content.ReadFromJsonAsync<HabitResponse>();
        Assert.NotNull(habit);
        Assert.Equal(type, habit!.HabitType);
        Assert.Equal(HabitState.Active, habit.HabitState);
        Assert.Equal(team.HabitTeamId, habit.HabitTeamId);
        if (type == HabitType.Binary)
            Assert.Null(habit.Unit);
        else
            Assert.Equal(unit, habit.Unit);
    }

    [Fact]
    public async Task CreateHabit_Quantitative_WithoutUnit_ReturnsBadRequest()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();

        var response = await _client.PostAsJsonAsync(
            $"/api/teams/{team.HabitTeamId}/habits",
            new CreateHabitRequest
            {
                Name = "X",
                Goal = "Y",
                HabitType = HabitType.Quantitative,
                Unit = null,
                ExpiryDate = DateTime.UtcNow.AddDays(30)
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateHabit_PastExpiry_ReturnsBadRequest()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();

        var response = await _client.PostAsJsonAsync(
            $"/api/teams/{team.HabitTeamId}/habits",
            new CreateHabitRequest
            {
                Name = "X",
                Goal = "Y",
                HabitType = HabitType.Binary,
                ExpiryDate = DateTime.UtcNow.AddDays(-1)
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateHabit_AsNonCreatorMember_ReturnsForbidden()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();
        var inviteResponse = await _client.PostAsync($"/api/teams/{team.HabitTeamId}/invite-codes", content: null);
        var invite = await inviteResponse.Content.ReadFromJsonAsync<CodeResponse>();

        var (memberClient, _) = await TestHelper.CreateSecondaryClientAsync(_factory);
        await memberClient.PostAsJsonAsync("/api/teams/join", new JoinTeamRequest { Code = invite!.Code });

        var response = await memberClient.PostAsJsonAsync(
            $"/api/teams/{team.HabitTeamId}/habits",
            new CreateHabitRequest
            {
                Name = "Not allowed",
                Goal = "no",
                HabitType = HabitType.Binary,
                ExpiryDate = DateTime.UtcNow.AddDays(1)
            });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [InlineData(null, 3)]
    [InlineData(HabitState.Active, 1)]
    [InlineData(HabitState.Archived, 2)]
    public async Task GetHabits_WithStateFilter_ReturnsExpectedCount(HabitState? filter, int expected)
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();

        var h1 = await CreateHabitAsync(team.HabitTeamId, "A");
        var h2 = await CreateHabitAsync(team.HabitTeamId, "B");
        var h3 = await CreateHabitAsync(team.HabitTeamId, "C");

        await _client.PostAsync($"/api/habits/{h2.HabitId}/archive", content: null);
        await _client.PostAsync($"/api/habits/{h3.HabitId}/archive", content: null);

        var url = filter.HasValue
            ? $"/api/teams/{team.HabitTeamId}/habits?state={filter.Value}"
            : $"/api/teams/{team.HabitTeamId}/habits";

        var listResponse = await _client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

        var habits = await listResponse.Content.ReadFromJsonAsync<List<HabitResponse>>();
        Assert.NotNull(habits);
        Assert.Equal(expected, habits!.Count);
        if (filter.HasValue)
            Assert.All(habits, h => Assert.Equal(filter.Value, h.HabitState));

        _ = h1;
    }

    [Fact]
    public async Task GetHabits_AsNonMember_ReturnsForbidden()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();

        var (outsider, _) = await TestHelper.CreateSecondaryClientAsync(_factory);
        var response = await outsider.GetAsync($"/api/teams/{team.HabitTeamId}/habits");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }


    [Fact]
    public async Task UpdateHabit_PartialUpdate_MergesFields()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();
        var habit = await CreateHabitAsync(team.HabitTeamId, "Old name", goal: "Old goal");

        var response = await _client.PatchAsJsonAsync(
            $"/api/habits/{habit.HabitId}",
            new UpdateHabitRequest { Name = "New name" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<HabitResponse>();
        Assert.Equal("New name", updated!.Name);
        Assert.Equal("Old goal", updated.Goal); 
    }

    [Fact]
    public async Task UpdateHabit_AsNonCreator_ReturnsForbidden()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();
        var habit = await CreateHabitAsync(team.HabitTeamId, "Whatever");

        var (outsider, _) = await TestHelper.CreateSecondaryClientAsync(_factory);
        var response = await outsider.PatchAsJsonAsync(
            $"/api/habits/{habit.HabitId}",
            new UpdateHabitRequest { Name = "Hacked" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ArchiveHabit_SetsStateToArchived()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();
        var habit = await CreateHabitAsync(team.HabitTeamId, "To archive");

        var response = await _client.PostAsync($"/api/habits/{habit.HabitId}/archive", content: null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<HabitResponse>();
        Assert.Equal(HabitState.Archived, body!.HabitState);
    }

    [Fact]
    public async Task ArchiveHabit_Twice_IsIdempotent()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();
        var habit = await CreateHabitAsync(team.HabitTeamId, "Idem");

        await _client.PostAsync($"/api/habits/{habit.HabitId}/archive", content: null);
        var second = await _client.PostAsync($"/api/habits/{habit.HabitId}/archive", content: null);

        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var body = await second.Content.ReadFromJsonAsync<HabitResponse>();
        Assert.Equal(HabitState.Archived, body!.HabitState);
    }

    [Fact]
    public async Task DeleteHabit_RemovesIt()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();
        var habit = await CreateHabitAsync(team.HabitTeamId, "Doomed");

        var response = await _client.DeleteAsync($"/api/habits/{habit.HabitId}");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var list = await _client.GetFromJsonAsync<List<HabitResponse>>($"/api/teams/{team.HabitTeamId}/habits");
        Assert.DoesNotContain(list!, h => h.HabitId == habit.HabitId);
    }

    [Fact]
    public async Task DeleteHabit_AsNonCreator_ReturnsForbidden()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();
        var habit = await CreateHabitAsync(team.HabitTeamId, "Untouchable");

        var (outsider, _) = await TestHelper.CreateSecondaryClientAsync(_factory);
        var response = await outsider.DeleteAsync($"/api/habits/{habit.HabitId}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private async Task<HabitResponse> CreateHabitAsync(
        Guid teamId,
        string name,
        string goal = "Some goal")
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/teams/{teamId}/habits",
            new CreateHabitRequest
            {
                Name = name,
                Goal = goal,
                HabitType = HabitType.Binary,
                ExpiryDate = DateTime.UtcNow.AddDays(30)
            });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<HabitResponse>())!;
    }
}