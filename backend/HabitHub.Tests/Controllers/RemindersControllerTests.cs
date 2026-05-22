using HabitHub.Api.Contracts.Reminders;
using HabitHub.Api.Controllers;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Api.Models;
using HabitHub.Tests.Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HabitHub.Tests.Controllers;

public class RemindersControllerTests
{
    private static (RemindersController controller, AppDbContext db) CreateController(Guid? userId = null)
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var controller = new RemindersController(db);

        if (userId.HasValue)
            TestHelper.SetAuthenticatedUser(controller, userId.Value);
        else
            TestHelper.SetUnauthenticatedUser(controller);

        return (controller, db);
    }

    private static DateTime UtcMinValue() =>
        DateTime.SpecifyKind(DateTime.MinValue, DateTimeKind.Utc);

    [Fact]
    public async Task SetReminder_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController();

        var result = await controller.SetReminder(Guid.NewGuid(), new SetReminderRequest
        {
            ReminderTime = DateTime.UtcNow
        });

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task SetReminder_WhenHabitMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var user = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, user.MemberId);

        var result = await controller.SetReminder(Guid.NewGuid(), new SetReminderRequest
        {
            ReminderTime = DateTime.UtcNow
        });

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task SetReminder_WhenCallerIsNotCreator_ReturnsForbid()
    {
        var (controller, db) = CreateController();

        var creator = TestHelper.SeedMember(db, name: "creator");
        var member = TestHelper.SeedMember(db, name: "member");
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);

        TestHelper.SetAuthenticatedUser(controller, member.MemberId);

        var result = await controller.SetReminder(habit.HabitId, new SetReminderRequest
        {
            ReminderTime = DateTime.UtcNow
        });

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task SetReminder_WhenCreator_SavesReminderTimeAndCreatesEnabledRemindersForActiveMembers()
    {
        var (controller, db) = CreateController();

        var creator = TestHelper.SeedMember(db, name: "creator");
        var activeMember = TestHelper.SeedMember(db, name: "active");
        var kickedMember = TestHelper.SeedMember(db, name: "kicked");
        var leftMember = TestHelper.SeedMember(db, name: "left");

        var team = TestHelper.SeedTeam(
            db,
            creator.MemberId,
            extraMemberIds: new[] { activeMember.MemberId, kickedMember.MemberId, leftMember.MemberId });

        var kickedMembership = await db.Memberships.SingleAsync(m => m.MemberId == kickedMember.MemberId);
        kickedMembership.Status = MembershipStatus.Kicked;

        var leftMembership = await db.Memberships.SingleAsync(m => m.MemberId == leftMember.MemberId);
        leftMembership.Status = MembershipStatus.Left;

        await db.SaveChangesAsync();

        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);
        var reminderTime = DateTime.UtcNow.AddHours(1);

        TestHelper.SetAuthenticatedUser(controller, creator.MemberId);

        var result = await controller.SetReminder(habit.HabitId, new SetReminderRequest
        {
            ReminderTime = reminderTime
        });

        Assert.IsType<OkObjectResult>(result);

        var updatedHabit = await db.Habits.FindAsync(habit.HabitId);
        Assert.NotNull(updatedHabit);
        Assert.NotNull(updatedHabit!.ReminderTime);

        var reminders = await db.Reminders
            .Where(r => r.HabitId == habit.HabitId)
            .ToListAsync();

        Assert.Equal(2, reminders.Count);

        Assert.Contains(reminders, r => r.MemberId == creator.MemberId && r.Enabled);
        Assert.Contains(reminders, r => r.MemberId == activeMember.MemberId && r.Enabled);
        Assert.DoesNotContain(reminders, r => r.MemberId == kickedMember.MemberId);
        Assert.DoesNotContain(reminders, r => r.MemberId == leftMember.MemberId);
    }

    [Fact]
    public async Task SetReminder_WhenUpdated_DoesNotDuplicateExistingReminders()
    {
        var (controller, db) = CreateController();

        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);

        TestHelper.SetAuthenticatedUser(controller, creator.MemberId);

        await controller.SetReminder(habit.HabitId, new SetReminderRequest
        {
            ReminderTime = DateTime.UtcNow.AddHours(1)
        });

        await controller.SetReminder(habit.HabitId, new SetReminderRequest
        {
            ReminderTime = DateTime.UtcNow.AddHours(2)
        });

        var reminders = await db.Reminders
            .Where(r => r.HabitId == habit.HabitId)
            .ToListAsync();

        Assert.Equal(2, reminders.Count);
    }

    [Fact]
    public async Task ChangeReminder_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController();

        var result = await controller.ChangeReminder(Guid.NewGuid(), new ChangeReminderRequest
        {
            Enabled = false
        });

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task ChangeReminder_WhenHabitMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();

        var user = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, user.MemberId);

        var result = await controller.ChangeReminder(Guid.NewGuid(), new ChangeReminderRequest
        {
            Enabled = false
        });

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task ChangeReminder_WhenUserIsNotActiveMember_ReturnsForbid()
    {
        var (controller, db) = CreateController();

        var creator = TestHelper.SeedMember(db);
        var kickedMember = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { kickedMember.MemberId });
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);

        habit.ReminderTime = DateTime.UtcNow;
        var membership = await db.Memberships.SingleAsync(m => m.MemberId == kickedMember.MemberId);
        membership.Status = MembershipStatus.Kicked;
        await db.SaveChangesAsync();

        TestHelper.SetAuthenticatedUser(controller, kickedMember.MemberId);

        var result = await controller.ChangeReminder(habit.HabitId, new ChangeReminderRequest
        {
            Enabled = false
        });

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task ChangeReminder_WhenReminderTimeNotConfigured_ReturnsBadRequest()
    {
        var (controller, db) = CreateController();

        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);

        TestHelper.SetAuthenticatedUser(controller, member.MemberId);

        var result = await controller.ChangeReminder(habit.HabitId, new ChangeReminderRequest
        {
            Enabled = false
        });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task ChangeReminder_WhenReminderExists_UpdatesOnlyCurrentUsersPreference()
    {
        var (controller, db) = CreateController();

        var creator = TestHelper.SeedMember(db);
        var memberOne = TestHelper.SeedMember(db);
        var memberTwo = TestHelper.SeedMember(db);

        var team = TestHelper.SeedTeam(
            db,
            creator.MemberId,
            extraMemberIds: new[] { memberOne.MemberId, memberTwo.MemberId });

        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);
        habit.ReminderTime = DateTime.UtcNow;

        var reminderOne = new Reminder
        {
            ReminderId = Guid.NewGuid(),
            HabitId = habit.HabitId,
            MemberId = memberOne.MemberId,
            Enabled = true,
            LastSentAt = UtcMinValue()
        };

        var reminderTwo = new Reminder
        {
            ReminderId = Guid.NewGuid(),
            HabitId = habit.HabitId,
            MemberId = memberTwo.MemberId,
            Enabled = true,
            LastSentAt = UtcMinValue()
        };

        db.Reminders.AddRange(reminderOne, reminderTwo);
        await db.SaveChangesAsync();

        TestHelper.SetAuthenticatedUser(controller, memberOne.MemberId);

        var result = await controller.ChangeReminder(habit.HabitId, new ChangeReminderRequest
        {
            Enabled = false
        });

        Assert.IsType<OkObjectResult>(result);

        var updatedOne = await db.Reminders.FindAsync(reminderOne.ReminderId);
        var updatedTwo = await db.Reminders.FindAsync(reminderTwo.ReminderId);

        Assert.NotNull(updatedOne);
        Assert.NotNull(updatedTwo);

        Assert.False(updatedOne!.Enabled);
        Assert.True(updatedTwo!.Enabled);
    }

    [Fact]
    public async Task ChangeReminder_WhenReminderMissing_CreatesPreferenceForCurrentUser()
    {
        var (controller, db) = CreateController();

        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);

        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);

        habit.ReminderTime = DateTime.UtcNow;
        await db.SaveChangesAsync();

        TestHelper.SetAuthenticatedUser(controller, member.MemberId);

        var result = await controller.ChangeReminder(habit.HabitId, new ChangeReminderRequest
        {
            Enabled = false
        });

        Assert.IsType<OkObjectResult>(result);

        var reminder = await db.Reminders.SingleAsync(r =>
            r.HabitId == habit.HabitId &&
            r.MemberId == member.MemberId);

        Assert.False(reminder.Enabled);
    }

    [Fact]
    public async Task GetMyReminders_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController();

        var result = await controller.GetMyReminders();

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task GetMyReminders_ReturnsOnlyCurrentUsersActiveHabitReminders()
    {
        var (controller, db) = CreateController();

        var creator = TestHelper.SeedMember(db);
        var currentUser = TestHelper.SeedMember(db, name: "current");
        var otherUser = TestHelper.SeedMember(db, name: "other");

        var team = TestHelper.SeedTeam(
            db,
            creator.MemberId,
            extraMemberIds: new[] { currentUser.MemberId, otherUser.MemberId });

        var activeHabit = TestHelper.SeedHabit(
            db,
            team.HabitTeamId,
            creator.MemberId,
            name: "Active habit",
            state: HabitState.Active);

        activeHabit.ReminderTime = DateTime.UtcNow;

        var archivedHabit = TestHelper.SeedHabit(
            db,
            team.HabitTeamId,
            creator.MemberId,
            name: "Archived habit",
            state: HabitState.Archived);

        archivedHabit.ReminderTime = DateTime.UtcNow;

        var noTimeHabit = TestHelper.SeedHabit(
            db,
            team.HabitTeamId,
            creator.MemberId,
            name: "No time habit",
            state: HabitState.Active);

        db.Reminders.AddRange(
            new Reminder
            {
                ReminderId = Guid.NewGuid(),
                HabitId = activeHabit.HabitId,
                MemberId = currentUser.MemberId,
                Enabled = true,
                LastSentAt = UtcMinValue()
            },
            new Reminder
            {
                ReminderId = Guid.NewGuid(),
                HabitId = activeHabit.HabitId,
                MemberId = otherUser.MemberId,
                Enabled = true,
                LastSentAt = UtcMinValue()
            },
            new Reminder
            {
                ReminderId = Guid.NewGuid(),
                HabitId = archivedHabit.HabitId,
                MemberId = currentUser.MemberId,
                Enabled = true,
                LastSentAt = UtcMinValue()
            },
            new Reminder
            {
                ReminderId = Guid.NewGuid(),
                HabitId = noTimeHabit.HabitId,
                MemberId = currentUser.MemberId,
                Enabled = true,
                LastSentAt = UtcMinValue()
            });

        await db.SaveChangesAsync();

        TestHelper.SetAuthenticatedUser(controller, currentUser.MemberId);

        var result = await controller.GetMyReminders();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var reminders = Assert.IsAssignableFrom<List<ReminderResponse>>(ok.Value);

        Assert.Single(reminders);
        Assert.Equal(activeHabit.HabitId, reminders[0].HabitId);
        Assert.Equal(currentUser.MemberId, reminders[0].MemberId);
        Assert.Equal("Active habit", reminders[0].HabitName);
    }

    [Fact]
    public async Task GetMyReminders_DoesNotReturnRemindersForInactiveMembership()
    {
        var (controller, db) = CreateController();

        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);

        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });
        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);

        habit.ReminderTime = DateTime.UtcNow;

        var membership = await db.Memberships.SingleAsync(m => m.MemberId == member.MemberId);
        membership.Status = MembershipStatus.Left;

        db.Reminders.Add(new Reminder
        {
            ReminderId = Guid.NewGuid(),
            HabitId = habit.HabitId,
            MemberId = member.MemberId,
            Enabled = true,
            LastSentAt = UtcMinValue()
        });

        await db.SaveChangesAsync();

        TestHelper.SetAuthenticatedUser(controller, member.MemberId);

        var result = await controller.GetMyReminders();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var reminders = Assert.IsAssignableFrom<List<ReminderResponse>>(ok.Value);

        Assert.Empty(reminders);
    }
}