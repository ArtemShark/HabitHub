using HabitHub.Api.Contracts.Habits;
using HabitHub.Api.Controllers;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Api.Models;
using HabitHub.Tests.Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId, type: HabitType.Binary, unit: null);
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
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId, type: HabitType.Quantitative, unit: "glasses");
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
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId, name: "Original name", goal: "Original goal", type: HabitType.Quantitative, unit: "glasses");
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

    [Fact]
    public async Task GetHabitsForMember_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController(userId: null);

        var result = await controller.GetHabitsForMember(Guid.NewGuid());

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task GetHabitsForMember_WhenRequestingAnotherMember_ReturnsForbid()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var someoneElse = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.GetHabitsForMember(someoneElse.MemberId);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task GetHabitsForMember_ReturnsHabitsAcrossTeamsWhereMemberBelongs()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var creator2 = TestHelper.SeedMember(db);
        var creator3 = TestHelper.SeedMember(db);
        var team1 = TestHelper.SeedTeam(db, me.MemberId);
        var team2 = TestHelper.SeedTeam(db, creator2.MemberId, extraMemberIds: new[] { me.MemberId });
        var team3 = TestHelper.SeedTeam(db, creator3.MemberId);
        var habit1 = TestHelper.SeedHabit(db, team1.HabitTeamId, me.MemberId, name: "Mine");
        var habit2 = TestHelper.SeedHabit(db, team2.HabitTeamId, creator2.MemberId, name: "Shared");
        _ = TestHelper.SeedHabit(db, team3.HabitTeamId, creator3.MemberId, name: "Other");
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.GetHabitsForMember(me.MemberId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var habits = Assert.IsAssignableFrom<List<HabitResponse>>(ok.Value);
        Assert.Equal(2, habits.Count);
        Assert.Contains(habits, h => h.HabitId == habit1.HabitId);
        Assert.Contains(habits, h => h.HabitId == habit2.HabitId);
    }

    [Fact]
    public async Task LogHabit_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController(userId: null);

        var result = await controller.LogHabit(Guid.NewGuid(), new LogHabitRequest { Status = EntryStatus.Logged, Notes = "x" });

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task LogHabit_WhenHabitMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.LogHabit(Guid.NewGuid(), new LogHabitRequest { Status = EntryStatus.Logged, Notes = "x" });

        var notFound = Assert.IsType<NotFoundObjectResult>(result.Result);
        Assert.Equal("Habit not found", notFound.Value);
    }

    [Theory]
    [InlineData(HabitState.Archived, "habit-archived")]
    [InlineData(HabitState.Closed, "habit-closed")]
    public async Task LogHabit_WhenHabitNotLoggable_ReturnsConflict(HabitState state, string message)
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId, state: state, type: HabitType.Binary, unit: null);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.LogHabit(habit.HabitId, new LogHabitRequest { Status = EntryStatus.Logged, Notes = "x" });

        var conflict = Assert.IsType<ConflictObjectResult>(result.Result);
        Assert.Equal(message, conflict.Value);
    }

    [Fact]
    public async Task LogHabit_QuantitativeWithoutValue_ReturnsBadRequest()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId, type: HabitType.Quantitative, unit: "cups");
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.LogHabit(habit.HabitId, new LogHabitRequest { Status = EntryStatus.Logged, Notes = "x", Value = null });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal("Value required for quantitative habit", badRequest.Value);
    }

    [Fact]
    public async Task LogHabit_BinaryWithValue_ReturnsBadRequest()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId, type: HabitType.Binary, unit: null);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.LogHabit(habit.HabitId, new LogHabitRequest { Status = EntryStatus.Logged, Notes = "x", Value = 2f });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal("Binary habit should not have value", badRequest.Value);
    }

    [Fact]
    public async Task LogHabit_WhenDuplicateForToday_ReturnsConflict()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId, type: HabitType.Binary, unit: null);
        db.HabitEntries.Add(new HabitEntry
        {
            HabitEntryId = Guid.NewGuid(),
            HabitId = habit.HabitId,
            MemberId = me.MemberId,
            Status = EntryStatus.Logged,
            Notes = "first",
            Date = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.LogHabit(habit.HabitId, new LogHabitRequest { Status = EntryStatus.Logged, Notes = "second" });

        var conflict = Assert.IsType<ConflictObjectResult>(result.Result);
        Assert.Equal("log-already-exists", conflict.Value);
    }

    [Fact]
    public async Task LogHabit_WhenMembershipNotActive_ReturnsForbid()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var creator = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { me.MemberId });
        var membership = await db.Memberships.SingleAsync(m => m.HabitTeamId == team.HabitTeamId && m.MemberId == me.MemberId);
        membership.Status = MembershipStatus.Left;
        await db.SaveChangesAsync();
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId, type: HabitType.Binary, unit: null);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.LogHabit(habit.HabitId, new LogHabitRequest { Status = EntryStatus.Logged, Notes = "x" });

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task LogHabit_HappyPath_ReturnsCreatedEntryAndPersists()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var creator = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { me.MemberId });
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId, type: HabitType.Quantitative, unit: "cups");
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.LogHabit(habit.HabitId, new LogHabitRequest
        {
            Status = EntryStatus.Logged,
            Value = 4.5f,
            Notes = "Morning"
        });

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Equal(nameof(HabitsController.GetHabitEntries), created.ActionName);
        var body = Assert.IsType<LogHabitResponse>(created.Value);
        Assert.Equal(habit.HabitId, body.HabitId);
        Assert.Equal(me.MemberId, body.MemberId);
        Assert.Equal(4.5f, body.Value);

        var persisted = await db.HabitEntries.SingleAsync(e => e.HabitEntryId == body.HabitEntryId);
        Assert.Equal("Morning", persisted.Notes);
    }

    [Fact]
    public async Task GetHabitEntries_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController(userId: null);

        var result = await controller.GetHabitEntries(Guid.NewGuid(), null);

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task GetHabitEntries_WhenHabitMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.GetHabitEntries(Guid.NewGuid(), null);

        var notFound = Assert.IsType<NotFoundObjectResult>(result.Result);
        Assert.Equal("Habit not found", notFound.Value);
    }

    [Fact]
    public async Task GetHabitEntries_WhenNotMember_ReturnsForbid()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var outsider = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);
        TestHelper.SetAuthenticatedUser(controller, outsider.MemberId);

        var result = await controller.GetHabitEntries(habit.HabitId, null);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task GetHabitEntries_WithoutDate_ReturnsAllEntries()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);
        db.HabitEntries.AddRange(
            new HabitEntry
            {
                HabitEntryId = Guid.NewGuid(),
                HabitId = habit.HabitId,
                MemberId = creator.MemberId,
                Status = EntryStatus.Logged,
                Notes = "one",
                Date = DateTime.UtcNow.AddDays(-1)
            },
            new HabitEntry
            {
                HabitEntryId = Guid.NewGuid(),
                HabitId = habit.HabitId,
                MemberId = member.MemberId,
                Status = EntryStatus.Skipped,
                Notes = "two",
                Date = DateTime.UtcNow
            });
        await db.SaveChangesAsync();
        TestHelper.SetAuthenticatedUser(controller, member.MemberId);

        var result = await controller.GetHabitEntries(habit.HabitId, null);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var entries = Assert.IsAssignableFrom<List<LogHabitResponse>>(ok.Value);
        Assert.Equal(2, entries.Count);
    }

    [Fact]
    public async Task GetHabitEntries_WithDate_ReturnsOnlyMatchingDay()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);
        var targetDate = new DateOnly(2026, 4, 24);
        db.HabitEntries.AddRange(
            new HabitEntry
            {
                HabitEntryId = Guid.NewGuid(),
                HabitId = habit.HabitId,
                MemberId = member.MemberId,
                Status = EntryStatus.Logged,
                Notes = "match",
                Date = new DateTime(2026, 4, 24, 12, 0, 0, DateTimeKind.Utc)
            },
            new HabitEntry
            {
                HabitEntryId = Guid.NewGuid(),
                HabitId = habit.HabitId,
                MemberId = member.MemberId,
                Status = EntryStatus.Logged,
                Notes = "other",
                Date = new DateTime(2026, 4, 23, 12, 0, 0, DateTimeKind.Utc)
            });
        await db.SaveChangesAsync();
        TestHelper.SetAuthenticatedUser(controller, member.MemberId);

        var result = await controller.GetHabitEntries(habit.HabitId, targetDate);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var entries = Assert.IsAssignableFrom<List<LogHabitResponse>>(ok.Value);
        Assert.Single(entries);
        Assert.Equal("match", entries[0].Notes);
    }

    // ── UndoLog tests ────────────────────────────────────────────

    [Fact]
    public async Task UndoLog_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController(userId: null);

        var result = await controller.UndoLog(Guid.NewGuid(), Guid.NewGuid());

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task UndoLog_WhenHabitMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.UndoLog(Guid.NewGuid(), Guid.NewGuid());

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task UndoLog_WhenNotActiveMember_ReturnsForbid()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var outsider = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);
        TestHelper.SetAuthenticatedUser(controller, outsider.MemberId);

        var result = await controller.UndoLog(habit.HabitId, Guid.NewGuid());

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task UndoLog_WhenHabitArchived_ReturnsConflict()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId, state: HabitState.Archived);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.UndoLog(habit.HabitId, Guid.NewGuid());

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal("habit-archived", conflict.Value);
    }

    [Fact]
    public async Task UndoLog_WhenHabitClosed_ReturnsConflict()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId, state: HabitState.Closed);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.UndoLog(habit.HabitId, Guid.NewGuid());

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal("habit-closed", conflict.Value);
    }

    [Fact]
    public async Task UndoLog_WhenEntryNotFound_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.UndoLog(habit.HabitId, Guid.NewGuid());

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal("log-not-found", notFound.Value);
    }

    [Fact]
    public async Task UndoLog_WhenEntryBelongsToAnotherUser_ReturnsForbid()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);
        var entry = new HabitEntry
        {
            HabitEntryId = Guid.NewGuid(),
            HabitId = habit.HabitId,
            MemberId = creator.MemberId,
            Status = EntryStatus.Logged,
            Notes = "creator's log",
            Date = DateTime.UtcNow
        };
        db.HabitEntries.Add(entry);
        await db.SaveChangesAsync();
        TestHelper.SetAuthenticatedUser(controller, member.MemberId);

        var result = await controller.UndoLog(habit.HabitId, entry.HabitEntryId);

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task UndoLog_WhenEntryIsFromPastDay_ReturnsBadRequest()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId);
        var entry = new HabitEntry
        {
            HabitEntryId = Guid.NewGuid(),
            HabitId = habit.HabitId,
            MemberId = me.MemberId,
            Status = EntryStatus.Logged,
            Notes = "yesterday",
            Date = DateTime.UtcNow.AddDays(-1)
        };
        db.HabitEntries.Add(entry);
        await db.SaveChangesAsync();
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.UndoLog(habit.HabitId, entry.HabitEntryId);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UndoLog_HappyPath_RemovesEntryAndReturnsNoContent()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, me.MemberId);
        var entry = new HabitEntry
        {
            HabitEntryId = Guid.NewGuid(),
            HabitId = habit.HabitId,
            MemberId = me.MemberId,
            Status = EntryStatus.Logged,
            Notes = "today",
            Date = DateTime.UtcNow
        };
        db.HabitEntries.Add(entry);
        await db.SaveChangesAsync();
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.UndoLog(habit.HabitId, entry.HabitEntryId);

        Assert.IsType<NoContentResult>(result);
        Assert.False(await db.HabitEntries.AnyAsync(e => e.HabitEntryId == entry.HabitEntryId));
    }
}
