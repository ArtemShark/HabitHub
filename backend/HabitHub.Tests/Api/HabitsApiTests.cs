using System.Net;
using System.Net.Http.Json;
using HabitHub.Api.Contracts.Habits;
using HabitHub.Api.Contracts.Team;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Api.Models;
using HabitHub.Tests.Helpers;
using Microsoft.Extensions.DependencyInjection;

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
        return (await response.Content.ReadFromJsonAsync<TeamResponse>(TestHelper.JsonOptions))!;
    }

    private async Task<HabitResponse> CreateHabitAsync(Guid teamId, string name, string goal = "Some goal", HabitType type = HabitType.Binary, string? unit = null)
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/teams/{teamId}/habits",
            new CreateHabitRequest
            {
                Name = name,
                Goal = goal,
                HabitType = type,
                Unit = unit,
                ExpiryDate = DateTime.UtcNow.AddDays(30)
            });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<HabitResponse>(TestHelper.JsonOptions))!;
    }

    [Fact]
    public async Task GetHabitsForMember_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync($"/api/habits?memberId={Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetHabitsForMember_ForOtherMember_ReturnsForbidden()
    {
        var auth = await TestHelper.RegisterAndAuthenticateAsync(_client);
        var other = Guid.NewGuid();

        var response = await _client.GetAsync($"/api/habits?memberId={other}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        _ = auth;
    }

    [Fact]
    public async Task GetHabitsForMember_ReturnsHabitsAcrossTeamsIAmIn()
    {
        var myAuth = await TestHelper.RegisterAndAuthenticateAsync(_client);
        var myTeam = await CreateTeamAsync(name: "Mine");
        var myHabit = await CreateHabitAsync(myTeam.HabitTeamId, "Mine habit");

        var (creator2Client, _) = await TestHelper.CreateSecondaryClientAsync(_factory);
        var otherTeam = await CreateTeamAsync(creator2Client, "Shared team");
        var inviteResponse = await creator2Client.PostAsync($"/api/teams/{otherTeam.HabitTeamId}/invite-codes", content: null);
        var invite = await inviteResponse.Content.ReadFromJsonAsync<CodeResponse>(TestHelper.JsonOptions);
        await _client.PostAsJsonAsync("/api/teams/join", new JoinTeamRequest { Code = invite!.Code });
        await creator2Client.PostAsJsonAsync(
            $"/api/teams/{otherTeam.HabitTeamId}/habits",
            new CreateHabitRequest
            {
                Name = "Shared habit",
                Goal = "Do it",
                HabitType = HabitType.Binary,
                ExpiryDate = DateTime.UtcNow.AddDays(10)
            });

        var response = await _client.GetAsync($"/api/habits?memberId={myAuth.UserId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var habits = await response.Content.ReadFromJsonAsync<List<HabitResponse>>(TestHelper.JsonOptions);
        Assert.NotNull(habits);
        Assert.Contains(habits!, h => h.HabitId == myHabit.HabitId);
        Assert.Contains(habits!, h => h.Name == "Shared habit");
    }

    [Fact]
    public async Task GetTeamHabits_WithoutToken_ReturnsUnauthorized()
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
        var habit = await response.Content.ReadFromJsonAsync<HabitResponse>(TestHelper.JsonOptions);
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
        var invite = await inviteResponse.Content.ReadFromJsonAsync<CodeResponse>(TestHelper.JsonOptions);

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
    public async Task GetTeamHabits_WithStateFilter_ReturnsExpectedCount(HabitState? filter, int expected)
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

        var habits = await listResponse.Content.ReadFromJsonAsync<List<HabitResponse>>(TestHelper.JsonOptions);
        Assert.NotNull(habits);
        Assert.Equal(expected, habits!.Count);
        if (filter.HasValue)
            Assert.All(habits, h => Assert.Equal(filter.Value, h.HabitState));

        _ = h1;
    }

    [Fact]
    public async Task GetTeamHabits_AsNonMember_ReturnsForbidden()
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
        var updated = await response.Content.ReadFromJsonAsync<HabitResponse>(TestHelper.JsonOptions);
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

        var body = await response.Content.ReadFromJsonAsync<HabitResponse>(TestHelper.JsonOptions);
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
        var body = await second.Content.ReadFromJsonAsync<HabitResponse>(TestHelper.JsonOptions);
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

        var list = await _client.GetFromJsonAsync<List<HabitResponse>>($"/api/teams/{team.HabitTeamId}/habits", TestHelper.JsonOptions);
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

    [Fact]
    public async Task LogHabit_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.PostAsJsonAsync($"/api/habits/{Guid.NewGuid()}/entries", new LogHabitRequest
        {
            Status = EntryStatus.Logged,
            Notes = "x"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetHabitEntries_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync($"/api/habits/{Guid.NewGuid()}/entries");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task LogHabit_HappyPath_ReturnsCreatedAndEntriesCanBeFetched()
    {
        var ownerAuth = await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();
        var inviteResponse = await _client.PostAsync($"/api/teams/{team.HabitTeamId}/invite-codes", content: null);
        var invite = await inviteResponse.Content.ReadFromJsonAsync<CodeResponse>(TestHelper.JsonOptions);

        var (memberClient, memberAuth) = await TestHelper.CreateSecondaryClientAsync(_factory);
        await memberClient.PostAsJsonAsync("/api/teams/join", new JoinTeamRequest { Code = invite!.Code });
        var habit = await CreateHabitAsync(team.HabitTeamId, "Track water", type: HabitType.Quantitative, unit: "cups");

        var response = await memberClient.PostAsJsonAsync($"/api/habits/{habit.HabitId}/entries", new LogHabitRequest
        {
            Status = EntryStatus.Logged,
            Value = 5f,
            Notes = "Morning"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<LogHabitResponse>(TestHelper.JsonOptions);
        Assert.NotNull(body);
        Assert.Equal(habit.HabitId, body!.HabitId);
        Assert.Equal(memberAuth.UserId, body.MemberId);
        Assert.Equal(5f, body.Value);

        var getResponse = await memberClient.GetAsync($"/api/habits/{habit.HabitId}/entries");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        var entries = await getResponse.Content.ReadFromJsonAsync<List<LogHabitResponse>>(TestHelper.JsonOptions);
        Assert.Contains(entries!, e => e.HabitEntryId == body.HabitEntryId);
        _ = ownerAuth;
    }

    [Fact]
    public async Task LogHabit_QuantitativeWithoutValue_ReturnsBadRequest()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();
        var habit = await CreateHabitAsync(team.HabitTeamId, "Track water", type: HabitType.Quantitative, unit: "cups");

        var response = await _client.PostAsJsonAsync($"/api/habits/{habit.HabitId}/entries", new LogHabitRequest
        {
            Status = EntryStatus.Logged,
            Notes = "No value"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task LogHabit_BinaryWithValue_ReturnsBadRequest()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();
        var habit = await CreateHabitAsync(team.HabitTeamId, "Read", type: HabitType.Binary, unit: null);

        var response = await _client.PostAsJsonAsync($"/api/habits/{habit.HabitId}/entries", new LogHabitRequest
        {
            Status = EntryStatus.Logged,
            Notes = "Should fail",
            Value = 1f
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task LogHabit_DuplicateSameDay_ReturnsConflict()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();
        var habit = await CreateHabitAsync(team.HabitTeamId, "Read", type: HabitType.Binary, unit: null);

        await _client.PostAsJsonAsync($"/api/habits/{habit.HabitId}/entries", new LogHabitRequest
        {
            Status = EntryStatus.Logged,
            Notes = "First"
        });

        var second = await _client.PostAsJsonAsync($"/api/habits/{habit.HabitId}/entries", new LogHabitRequest
        {
            Status = EntryStatus.Logged,
            Notes = "Second"
        });

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        var text = await second.Content.ReadAsStringAsync();
        Assert.Contains("log-already-exists", text);
    }

    [Fact]
    public async Task LogHabit_WhenArchived_ReturnsConflict()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();
        var habit = await CreateHabitAsync(team.HabitTeamId, "Archive me", type: HabitType.Binary, unit: null);
        await _client.PostAsync($"/api/habits/{habit.HabitId}/archive", content: null);

        var response = await _client.PostAsJsonAsync($"/api/habits/{habit.HabitId}/entries", new LogHabitRequest
        {
            Status = EntryStatus.Logged,
            Notes = "Attempt"
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var text = await response.Content.ReadAsStringAsync();
        Assert.Contains("habit-archived", text);
    }

    [Fact]
    public async Task GetHabitEntries_WithDateFilter_ReturnsOnlyMatchingDay()
    {
        var auth = await TestHelper.RegisterAndAuthenticateAsync(_client);
        var team = await CreateTeamAsync();
        var habit = await CreateHabitAsync(team.HabitTeamId, "Filtered", type: HabitType.Binary, unit: null);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.HabitEntries.AddRange(
                new HabitEntry
                {
                    HabitEntryId = Guid.NewGuid(),
                    HabitId = habit.HabitId,
                    MemberId = auth.UserId,
                    Status = EntryStatus.Logged,
                    Notes = "match",
                    Date = new DateTime(2026, 4, 24, 10, 0, 0, DateTimeKind.Utc)
                },
                new HabitEntry
                {
                    HabitEntryId = Guid.NewGuid(),
                    HabitId = habit.HabitId,
                    MemberId = auth.UserId,
                    Status = EntryStatus.Skipped,
                    Notes = "other",
                    Date = new DateTime(2026, 4, 23, 10, 0, 0, DateTimeKind.Utc)
                });
            await db.SaveChangesAsync();
        }

        var response = await _client.GetAsync($"/api/habits/{habit.HabitId}/entries?date=2026-04-24");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var entries = await response.Content.ReadFromJsonAsync<List<LogHabitResponse>>(TestHelper.JsonOptions);
        Assert.NotNull(entries);
        Assert.Single(entries!);
        Assert.Equal("match", entries[0].Notes);
    }
}
