using HabitHub.Api.Contracts.Habits;
using HabitHub.Api.Controllers;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Tests.Helpers;
using Microsoft.AspNetCore.Mvc;

namespace HabitHub.Tests.Controllers;

public class HabitsControllerTests
{
    private static (HabitsController controller, AppDbContext db) CreateController(Guid? userId = null)
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var controller = new HabitsController(db);

        if (userId.HasValue)
            TestHelper.SetAuthenticatedUser(controller, userId.Value);
        else
            TestHelper.SetUnauthenticatedUser(controller);

        return (controller, db);
    }

    [Fact]
    public async Task UpdateHabit_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController(userId: null);

        var result = await controller.UpdateHabit(Guid.NewGuid(), new UpdateHabitRequest());

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task UpdateHabit_WhenHabitMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.UpdateHabit(Guid.NewGuid(), new UpdateHabitRequest());

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task UpdateHabit_WhenCallerNotTeamCreator_ReturnsForbid()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);
        TestHelper.SetAuthenticatedUser(controller, member.MemberId);

        var result = await controller.UpdateHabit(habit.HabitId, new UpdateHabitRequest { Name = "new" });

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task UpdateHabit_WithPastExpiryDate_ReturnsBadRequest()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.UpdateHabit(habit.HabitId, new UpdateHabitRequest
        {
            ExpiryDate = DateTime.UtcNow.AddDays(-1)
        });

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task UpdateHabit_SwitchingToQuantitativeWithoutUnit_ReturnsBadRequest()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        var habit = TestHelper.SeedHabit(
            db, team.HabitTeamId, me.MemberId,
            type: HabitType.Binary, unit: null);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.UpdateHabit(habit.HabitId, new UpdateHabitRequest
        {
            HabitType = HabitType.Quantitative
        });

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task UpdateHabit_SwitchingToBinary_ClearsUnit()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        var habit = TestHelper.SeedHabit(
            db, team.HabitTeamId, me.MemberId,
            type: HabitType.Quantitative, unit: "glasses");
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.UpdateHabit(habit.HabitId, new UpdateHabitRequest
        {
            HabitType = HabitType.Binary
        });

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var body = Assert.IsType<HabitResponse>(ok.Value);
        Assert.Equal(HabitType.Binary, body.HabitType);
        Assert.Null(body.Unit);
    }

    [Theory]
    [InlineData("New name", null, null)]
    [InlineData(null, "New goal", null)]
    [InlineData(null, null, "liters")]
    [InlineData("A", "B", "km")]
    public async Task UpdateHabit_PartialUpdate_MergesOnlyProvidedFields(string? name, string? goal, string? unit)
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        var habit = TestHelper.SeedHabit(
            db, team.HabitTeamId, me.MemberId,
            name: "Original name", goal: "Original goal",
            type: HabitType.Quantitative, unit: "glasses");
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.UpdateHabit(habit.HabitId, new UpdateHabitRequest
        {
            Name = name,
            Goal = goal,
            Unit = unit
        });

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var body = Assert.IsType<HabitResponse>(ok.Value);

        Assert.Equal(name ?? "Original name", body.Name);
        Assert.Equal(goal ?? "Original goal", body.Goal);
        Assert.Equal(unit ?? "glasses", body.Unit);
    }


    [Fact]
    public async Task ArchiveHabit_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController(userId: null);

        var result = await controller.ArchiveHabit(Guid.NewGuid());

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task ArchiveHabit_WhenHabitMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.ArchiveHabit(Guid.NewGuid());

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task ArchiveHabit_WhenNotCreator_ReturnsForbid()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);
        TestHelper.SetAuthenticatedUser(controller, member.MemberId);

        var result = await controller.ArchiveHabit(habit.HabitId);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Theory]
    [InlineData(HabitState.Active)]
    [InlineData(HabitState.Archived)] 
    [InlineData(HabitState.Closed)]
    public async Task ArchiveHabit_ReturnsArchivedState(HabitState initialState)
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId, state: initialState);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.ArchiveHabit(habit.HabitId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var body = Assert.IsType<HabitResponse>(ok.Value);
        Assert.Equal(HabitState.Archived, body.HabitState);
    }


    [Fact]
    public async Task DeleteHabit_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController(userId: null);

        var result = await controller.DeleteHabit(Guid.NewGuid());

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task DeleteHabit_WhenHabitMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.DeleteHabit(Guid.NewGuid());

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task DeleteHabit_WhenNotCreator_ReturnsForbid()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);
        TestHelper.SetAuthenticatedUser(controller, member.MemberId);

        var result = await controller.DeleteHabit(habit.HabitId);

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task DeleteHabit_HappyPath_RemovesHabit()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.DeleteHabit(habit.HabitId);

        Assert.IsType<NoContentResult>(result);
        Assert.Null(await db.Habits.FindAsync(habit.HabitId));
    }
}