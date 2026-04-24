using System.Net;
using System.Net.Http.Json;
using HabitHub.Api.Contracts.Member;
using HabitHub.Api.Data;
using HabitHub.Tests.Helpers;
using Microsoft.Extensions.DependencyInjection;

namespace HabitHub.Tests.Api;

public class MembersApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public MembersApiTests(CustomWebApplicationFactory factory)
    {
        factory.ResetDatabase();
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetBasicMembers_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync($"/api/members/info?ids={Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetBasicMembers_ReturnsDistinctMatchingMembers_AndIgnoresInvalidIds()
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);

        Guid aId;
        Guid bId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var a = TestHelper.SeedMember(db, name: "Alice");
            var b = TestHelper.SeedMember(db, name: "Bob");
            aId = a.MemberId;
            bId = b.MemberId;
        }

        var response = await _client.GetAsync($"/api/members/info?ids={aId},not-a-guid,{aId},{bId},00000000-0000-0000-0000-000000000000");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<List<MemberInfoResponse>>(TestHelper.JsonOptions);
        Assert.NotNull(body);
        Assert.Equal(2, body!.Count);
        Assert.Contains(body, m => m.MemberId == aId && m.Name == "Alice");
        Assert.Contains(body, m => m.MemberId == bId && m.Name == "Bob");
    }

    [Theory]
    [InlineData("bad-id")]
    [InlineData("bad-id,another-bad-id")]
    [InlineData(",,")]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    public async Task GetBasicMembers_WithOnlyInvalidIds_ReturnsEmptyList(string ids)
    {
        await TestHelper.RegisterAndAuthenticateAsync(_client);

        var response = await _client.GetAsync($"/api/members/info?ids={ids}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<List<MemberInfoResponse>>(TestHelper.JsonOptions);
        Assert.NotNull(body);
        Assert.Empty(body!);
    }
}