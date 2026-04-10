using System.Net;
using System.Net.Http.Json;
using HabitHub.Api.Contracts.Team;
using HabitHub.Tests.Helpers;

namespace HabitHub.Tests.Api;

public class TeamsApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public TeamsApiTests(CustomWebApplicationFactory factory)
    {
        factory.ResetDatabase();
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetMyTeams_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/api/teams");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateTeam_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.PostAsJsonAsync("/api/teams", new CreateTeamRequest { Name = "X" });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateTeam_ThenGet_ReturnsTeamWithCreatorMembership()
    {
        var auth = await TestHelper.RegisterAndAuthenticateAsync(_client);

        var createResponse = await _client.PostAsJsonAsync("/api/teams", new CreateTeamRequest { Name = "Runners" });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var created = await createResponse.Content.ReadFromJsonAsync<TeamResponse>();
        Assert.NotNull(created);
        Assert.Equal("Runners", created!.Name);
        Assert.Equal(auth.UserId, created.CreatorId);
        Assert.Single(created.Members);


        var getResponse = await _client.GetAsync($"/api/teams/{created.HabitTeamId}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var fetched = await getResponse.Content.ReadFromJsonAsync<TeamResponse>();
        Assert.Equal(created.HabitTeamId, fetched!.HabitTeamId);
    }

    [Fact]
    public async Task GetMyTeams_ReturnsOnlyTeamsIAmIn()
    {
        var a = await TestHelper.RegisterAndAuthenticateAsync(_client);
        await _client.PostAsJsonAsync("/api/teams", new CreateTeamRequest { Name = "A Team" });
        await _client.PostAsJsonAsync("/api/teams", new CreateTeamRequest { Name = "Another A Team" });

        var (clientB, _) = await TestHelper.CreateSecondaryClientAsync(_factory);
        await clientB.PostAsJsonAsync("/api/teams", new CreateTeamRequest { Name = "B Team" });

        var response = await _client.GetAsync("/api/teams");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var teams = await response.Content.ReadFromJsonAsync<List<TeamResponse>>();
        Assert.NotNull(teams);
        Assert.Equal(2, teams!.Count);
        Assert.All(teams, t => Assert.Equal(a.UserId, t.CreatorId));
    }

    [Fact]
    public async Task GetTeam_WhenNotMember_ReturnsForbidden()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var create = await _client.PostAsJsonAsync("/api/teams", new CreateTeamRequest { Name = "Private" });
        var team = await create.Content.ReadFromJsonAsync<TeamResponse>();

        var (outsider, _) = await TestHelper.CreateSecondaryClientAsync(_factory);
        var response = await outsider.GetAsync($"/api/teams/{team!.HabitTeamId}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }


    [Fact]
    public async Task JoinTeam_WithValidInviteCode_AddsMember()
    {
        var creatorAuth = await TestHelper.RegisterAndAuthenticateAsync(_client);
        var create = await _client.PostAsJsonAsync("/api/teams", new CreateTeamRequest { Name = "Inviters" });
        var team = await create.Content.ReadFromJsonAsync<TeamResponse>();

        var inviteResponse = await _client.PostAsync($"/api/teams/{team!.HabitTeamId}/invite-codes", content: null);
        Assert.Equal(HttpStatusCode.Created, inviteResponse.StatusCode);
        var invite = await inviteResponse.Content.ReadFromJsonAsync<CodeResponse>();

        var (joinerClient, joinerAuth) = await TestHelper.CreateSecondaryClientAsync(_factory);
        var joinResponse = await joinerClient.PostAsJsonAsync("/api/teams/join", new JoinTeamRequest { Code = invite!.Code });
        Assert.Equal(HttpStatusCode.OK, joinResponse.StatusCode);

        var joined = await joinResponse.Content.ReadFromJsonAsync<TeamResponse>();
        Assert.Equal(team.HabitTeamId, joined!.HabitTeamId);
        Assert.Equal(2, joined.Members.Count);
        Assert.Contains(joined.Members, m => m.MemberId == joinerAuth.UserId);
        Assert.Contains(joined.Members, m => m.MemberId == creatorAuth.UserId);
    }

    [Fact]
    public async Task JoinTeam_WithUnknownCode_ReturnsNotFound()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);

        var response = await _client.PostAsJsonAsync("/api/teams/join", new JoinTeamRequest { Code = "ZZZZZZZZ" });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GenerateInviteCode_WhenNotCreator_ReturnsForbidden()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var create = await _client.PostAsJsonAsync("/api/teams", new CreateTeamRequest { Name = "Locked" });
        var team = await create.Content.ReadFromJsonAsync<TeamResponse>();

        var (outsider, _) = await TestHelper.CreateSecondaryClientAsync(_factory);
        var response = await outsider.PostAsync($"/api/teams/{team!.HabitTeamId}/invite-codes", content: null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }


    [Fact]
    public async Task KickMember_AsCreator_SetsKickedAndRemovesFromVisibleMembers()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var create = await _client.PostAsJsonAsync("/api/teams", new CreateTeamRequest { Name = "Kickers" });
        var team = await create.Content.ReadFromJsonAsync<TeamResponse>();
        var inviteResponse = await _client.PostAsync($"/api/teams/{team!.HabitTeamId}/invite-codes", content: null);
        var invite = await inviteResponse.Content.ReadFromJsonAsync<CodeResponse>();

        var (joinerClient, joinerAuth) = await TestHelper.CreateSecondaryClientAsync(_factory);
        await joinerClient.PostAsJsonAsync("/api/teams/join", new JoinTeamRequest { Code = invite!.Code });

        var kickResponse = await _client.PostAsync(
            $"/api/teams/{team.HabitTeamId}/members/{joinerAuth.UserId}/kick",
            content: null);
        Assert.Equal(HttpStatusCode.OK, kickResponse.StatusCode);

        var fetched = await _client.GetFromJsonAsync<TeamResponse>($"/api/teams/{team.HabitTeamId}");
        var kickedRow = fetched!.Members.FirstOrDefault(m => m.MemberId == joinerAuth.UserId);
        Assert.NotNull(kickedRow);
        Assert.Equal(HabitHub.Api.Enums.MembershipStatus.Kicked, kickedRow!.Status);
    }

    [Fact]
    public async Task LeaveTeam_AsCreator_ReturnsConflict()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var create = await _client.PostAsJsonAsync("/api/teams", new CreateTeamRequest { Name = "Stuck" });
        var team = await create.Content.ReadFromJsonAsync<TeamResponse>();

        var response = await _client.PostAsync($"/api/teams/{team!.HabitTeamId}/leave", content: null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task LeaveTeam_AsMember_Succeeds()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var create = await _client.PostAsJsonAsync("/api/teams", new CreateTeamRequest { Name = "Leavers" });
        var team = await create.Content.ReadFromJsonAsync<TeamResponse>();
        var inviteResponse = await _client.PostAsync($"/api/teams/{team!.HabitTeamId}/invite-codes", content: null);
        var invite = await inviteResponse.Content.ReadFromJsonAsync<CodeResponse>();

        var (joinerClient, _) = await TestHelper.CreateSecondaryClientAsync(_factory);
        await joinerClient.PostAsJsonAsync("/api/teams/join", new JoinTeamRequest { Code = invite!.Code });

        var leaveResponse = await joinerClient.PostAsync($"/api/teams/{team.HabitTeamId}/leave", content: null);
        Assert.Equal(HttpStatusCode.OK, leaveResponse.StatusCode);
    }

    [Fact]
    public async Task DeleteTeam_AsCreator_RemovesIt()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var create = await _client.PostAsJsonAsync("/api/teams", new CreateTeamRequest { Name = "Temporary" });
        var team = await create.Content.ReadFromJsonAsync<TeamResponse>();

        var deleteResponse = await _client.DeleteAsync($"/api/teams/{team!.HabitTeamId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await _client.GetAsync($"/api/teams/{team.HabitTeamId}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }

    [Fact]
    public async Task DeleteTeam_AsNonCreator_ReturnsForbidden()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);
        var create = await _client.PostAsJsonAsync("/api/teams", new CreateTeamRequest { Name = "Safe" });
        var team = await create.Content.ReadFromJsonAsync<TeamResponse>();

        var (outsider, _) = await TestHelper.CreateSecondaryClientAsync(_factory);
        var response = await outsider.DeleteAsync($"/api/teams/{team!.HabitTeamId}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}