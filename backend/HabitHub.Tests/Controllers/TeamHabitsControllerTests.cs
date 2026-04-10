using HabitHub.Api.Contracts.Habits;
using HabitHub.Api.Controllers;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Tests.Helpers;
using Microsoft.AspNetCore.Mvc;

namespace HabitHub.Tests.Controllers;

public class TeamHabitsControllerTests
{
    private static (TeamHabitsController controller, AppDbContext db) CreateController(Guid? userId = null)
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var controller = new TeamHabitsController(db);

        if (userId.HasValue)
            TestHelper.SetAuthenticatedUser(controller, userId.Value);
        else
            TestHelper.SetUnauthenticatedUser(controller);

        return (controller, db);
    }


    [Fact]
    public async Task GetHabits_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController(userId: null);

        var result = await controller.GetHabits(Guid.NewGuid(), state: null);

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task GetHabits_WhenTeamMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.GetHabits(Guid.NewGuid(), state: null);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task GetHabits_WhenNotMember_ReturnsForbid()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var outsider = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        TestHelper.SetAuthenticatedUser(controller, outsider.MemberId);

        var result = await controller.GetHabits(team.HabitTeamId, state: null);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task GetHabits_WithoutStateFilter_ReturnsAllHabits()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId, name: "A", state: HabitState.Active);
        TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId, name: "B", state: HabitState.Archived);
        TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId, name: "C", state: HabitState.Closed);

        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.GetHabits(team.HabitTeamId, state: null);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var list = Assert.IsAssignableFrom<List<HabitResponse>>(ok.Value);
        Assert.Equal(3, list.Count);
    }

    [Theory]
    [InlineData(HabitState.Active, 1)]
    [InlineData(HabitState.Archived, 1)]
    [InlineData(HabitState.Closed, 1)]
    public async Task GetHabits_WithStateFilter_ReturnsOnlyMatchingHabits(HabitState filter, int expectedCount)
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId, name: "A", state: HabitState.Active);
        TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId, name: "B", state: HabitState.Archived);
        TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId, name: "C", state: HabitState.Closed);

        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.GetHabits(team.HabitTeamId, state: filter);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var list = Assert.IsAssignableFrom<List<HabitResponse>>(ok.Value);
        Assert.Equal(expectedCount, list.Count);
        Assert.All(list, h => Assert.Equal(filter, h.HabitState));
    }


    [Fact]
    public async Task CreateHabit_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController(userId: null);

        var request = new CreateHabitRequest
        {
            Name = "x",
            Goal = "y",
            HabitType = HabitType.Binary,
            ExpiryDate = DateTime.UtcNow.AddDays(1)
        };

        var result = await controller.CreateHabit(Guid.NewGuid(), request);

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task CreateHabit_WhenTeamMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var request = new CreateHabitRequest
        {
            Name = "x",
            Goal = "y",
            HabitType = HabitType.Binary,
            ExpiryDate = DateTime.UtcNow.AddDays(1)
        };

        var result = await controller.CreateHabit(Guid.NewGuid(), request);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task CreateHabit_WhenNotCreator_ReturnsForbid()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });
        TestHelper.SetAuthenticatedUser(controller, member.MemberId);

        var request = new CreateHabitRequest
        {
            Name = "x",
            Goal = "y",
            HabitType = HabitType.Binary,
            ExpiryDate = DateTime.UtcNow.AddDays(1)
        };

        var result = await controller.CreateHabit(team.HabitTeamId, request);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CreateHabit_Quantitative_WithoutUnit_ReturnsBadRequest(string? unit)
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var request = new CreateHabitRequest
        {
            Name = "Drink water",
            Goal = "8",
            HabitType = HabitType.Quantitative,
            Unit = unit,
            ExpiryDate = DateTime.UtcNow.AddDays(1)
        };

        var result = await controller.CreateHabit(team.HabitTeamId, request);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task CreateHabit_WithPastExpiryDate_ReturnsBadRequest()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var request = new CreateHabitRequest
        {
            Name = "x",
            Goal = "y",
            HabitType = HabitType.Binary,
            ExpiryDate = DateTime.UtcNow.AddDays(-1)
        };

        var result = await controller.CreateHabit(team.HabitTeamId, request);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Theory]
    [InlineData(HabitType.Binary, null)]
    [InlineData(HabitType.Binary, "this-should-be-nulled-out")] 
    [InlineData(HabitType.Quantitative, "glasses")]
    [InlineData(HabitType.Quantitative, "km")]
    public async Task CreateHabit_HappyPath_PersistsAndReturnsCreated(HabitType type, string? unit)
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var request = new CreateHabitRequest
        {
            Name = "Walk",
            Goal = "10000 steps",
            HabitType = type,
            Unit = unit,
            ExpiryDate = DateTime.UtcNow.AddDays(30)
        };

        var result = await controller.CreateHabit(team.HabitTeamId, request);

        var created = Assert.IsType<CreatedResult>(result.Result);
        var body = Assert.IsType<HabitResponse>(created.Value);

        Assert.Equal("Walk", body.Name);
        Assert.Equal(team.HabitTeamId, body.HabitTeamId);
        Assert.Equal(me.MemberId, body.CreatorId);
        Assert.Equal(HabitState.Active, body.HabitState);
        Assert.Equal(type, body.HabitType);

        if (type == HabitType.Binary)
            Assert.Null(body.Unit);
        else
            Assert.Equal(unit, body.Unit);

        Assert.Single(db.Habits.Where(h => h.HabitTeamId == team.HabitTeamId));
    }
}