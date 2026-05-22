using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Api.Models;
using HabitHub.Api.Services.Background;
using HabitHub.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;

namespace HabitHub.Tests.Services;

public class ReminderDispatchServiceTests
{
    private static (ReminderDispatchService service, AppDbContext db) CreateService()
    {
        var dbName = Guid.NewGuid().ToString();
        var dbRoot = new InMemoryDatabaseRoot();

        var dbOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(dbName, dbRoot)
            .Options;

        var db = new AppDbContext(dbOptions);

        var services = new ServiceCollection();

        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(dbName, dbRoot));

        var provider = services.BuildServiceProvider();

        var scopeFactory = provider.GetRequiredService<IServiceScopeFactory>();
        var logger = new Mock<ILogger<ReminderDispatchService>>();

        var service = new ReminderDispatchService(scopeFactory, logger.Object);

        return (service, db);
    }

    private static DateTime UtcMinValue() =>
        DateTime.SpecifyKind(DateTime.MinValue, DateTimeKind.Utc);

    private static Reminder SeedReminder(
        AppDbContext db,
        Guid habitId,
        Guid memberId,
        bool enabled = true,
        DateTime? lastSentAt = null)
    {
        var reminder = new Reminder
        {
            ReminderId = Guid.NewGuid(),
            HabitId = habitId,
            MemberId = memberId,
            Enabled = enabled,
            LastSentAt = lastSentAt ?? UtcMinValue()
        };

        db.Reminders.Add(reminder);
        db.SaveChanges();

        return reminder;
    }

    [Fact]
    public async Task DispatchDueReminders_CreatesNotificationAndUpdatesLastSentAt()
    {
        var (service, db) = CreateService();

        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });

        var habit = TestHelper.SeedHabit(
            db,
            team.HabitTeamId,
            creator.MemberId,
            name: "Drink water",
            state: HabitState.Active,
            expiryDate: DateTime.UtcNow.AddDays(5));

        habit.ReminderTime = DateTime.UtcNow.AddMinutes(-5);
        await db.SaveChangesAsync();

        var reminder = SeedReminder(db, habit.HabitId, member.MemberId, enabled: true);

        await service.DispatchDueRemindersAsync();

        db.ChangeTracker.Clear();

        var notification = await db.Notifications.SingleOrDefaultAsync(n => n.MemberId == member.MemberId);
        var updatedReminder = await db.Reminders.FindAsync(reminder.ReminderId);

        Assert.NotNull(notification);
        Assert.Contains("Drink water", notification!.Content);
        Assert.False(notification.IsRead);

        Assert.NotNull(updatedReminder);
        Assert.True(updatedReminder!.LastSentAt > UtcMinValue());
    }

    [Fact]
    public async Task DispatchDueReminders_SkipsDisabledReminders()
    {
        var (service, db) = CreateService();

        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });

        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);
        habit.ReminderTime = DateTime.UtcNow.AddMinutes(-5);
        await db.SaveChangesAsync();

        var reminder = SeedReminder(db, habit.HabitId, member.MemberId, enabled: false);

        await service.DispatchDueRemindersAsync();

        db.ChangeTracker.Clear();

        Assert.Empty(await db.Notifications.ToListAsync());

        var updatedReminder = await db.Reminders.FindAsync(reminder.ReminderId);
        Assert.NotNull(updatedReminder);
        Assert.Equal(UtcMinValue(), updatedReminder!.LastSentAt);
    }

    [Fact]
    public async Task DispatchDueReminders_SkipsReminderWhenHabitAlreadyLoggedToday()
    {
        var (service, db) = CreateService();

        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });

        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);
        habit.ReminderTime = DateTime.UtcNow.AddMinutes(-5);

        db.HabitEntries.Add(new HabitEntry
        {
            HabitEntryId = Guid.NewGuid(),
            HabitId = habit.HabitId,
            MemberId = member.MemberId,
            Status = EntryStatus.Logged,
            Value = habit.HabitType == HabitType.Quantitative ? 1 : null,
            Notes = "done",
            Date = DateTime.UtcNow
        });

        await db.SaveChangesAsync();

        var reminder = SeedReminder(db, habit.HabitId, member.MemberId, enabled: true);

        await service.DispatchDueRemindersAsync();

        db.ChangeTracker.Clear();

        Assert.Empty(await db.Notifications.ToListAsync());

        var updatedReminder = await db.Reminders.FindAsync(reminder.ReminderId);
        Assert.NotNull(updatedReminder);
        Assert.Equal(UtcMinValue(), updatedReminder!.LastSentAt);
    }

    [Theory]
    [InlineData(HabitState.Archived)]
    [InlineData(HabitState.Closed)]
    public async Task DispatchDueReminders_SkipsInactiveHabits(HabitState state)
    {
        var (service, db) = CreateService();

        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });

        var habit = TestHelper.SeedHabit(
            db,
            team.HabitTeamId,
            creator.MemberId,
            state: state);

        habit.ReminderTime = DateTime.UtcNow.AddMinutes(-5);
        await db.SaveChangesAsync();

        var reminder = SeedReminder(db, habit.HabitId, member.MemberId, enabled: true);

        await service.DispatchDueRemindersAsync();

        db.ChangeTracker.Clear();

        Assert.Empty(await db.Notifications.ToListAsync());

        var updatedReminder = await db.Reminders.FindAsync(reminder.ReminderId);
        Assert.NotNull(updatedReminder);
        Assert.Equal(UtcMinValue(), updatedReminder!.LastSentAt);
    }

    [Fact]
    public async Task DispatchDueReminders_DisablesReminderForInactiveMemberAndDoesNotSend()
    {
        var (service, db) = CreateService();

        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });

        var membership = await db.Memberships.SingleAsync(m => m.MemberId == member.MemberId);
        membership.Status = MembershipStatus.Kicked;

        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);
        habit.ReminderTime = DateTime.UtcNow.AddMinutes(-5);

        await db.SaveChangesAsync();

        var reminder = SeedReminder(db, habit.HabitId, member.MemberId, enabled: true);

        await service.DispatchDueRemindersAsync();

        db.ChangeTracker.Clear();

        Assert.Empty(await db.Notifications.ToListAsync());

        var updatedReminder = await db.Reminders.FindAsync(reminder.ReminderId);
        Assert.NotNull(updatedReminder);
        Assert.False(updatedReminder!.Enabled);
    }

    [Fact]
    public async Task DispatchDueReminders_DoesNotSendDuplicateReminderOnSameDay()
    {
        var (service, db) = CreateService();

        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });

        var now = DateTime.UtcNow;

        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);
        habit.ReminderTime = now.AddMinutes(-5);
        await db.SaveChangesAsync();

        var alreadySentAtToday = DateTime.SpecifyKind(
            now.Date.AddMinutes(1),
            DateTimeKind.Utc);

        var reminder = SeedReminder(
            db,
            habit.HabitId,
            member.MemberId,
            enabled: true,
            lastSentAt: alreadySentAtToday);

        await service.DispatchDueRemindersAsync();

        db.ChangeTracker.Clear();

        Assert.Empty(await db.Notifications.ToListAsync());

        var updatedReminder = await db.Reminders.FindAsync(reminder.ReminderId);
        Assert.NotNull(updatedReminder);
        Assert.Equal(alreadySentAtToday, updatedReminder!.LastSentAt);
    }

    [Fact]
    public async Task DispatchDueReminders_SkipsReminderWhenTimeIsNotDueYet()
    {
        var (service, db) = CreateService();

        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });

        var habit = TestHelper.SeedHabit(db, team.HabitTeamId, creator.MemberId);
        habit.ReminderTime = DateTime.UtcNow.AddHours(1);
        await db.SaveChangesAsync();

        var reminder = SeedReminder(db, habit.HabitId, member.MemberId, enabled: true);

        await service.DispatchDueRemindersAsync();

        db.ChangeTracker.Clear();

        Assert.Empty(await db.Notifications.ToListAsync());

        var updatedReminder = await db.Reminders.FindAsync(reminder.ReminderId);
        Assert.NotNull(updatedReminder);
        Assert.Equal(UtcMinValue(), updatedReminder!.LastSentAt);
    }

    [Fact]
    public async Task DispatchDueReminders_SkipsExpiredHabits()
    {
        var (service, db) = CreateService();

        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });

        var habit = TestHelper.SeedHabit(
            db,
            team.HabitTeamId,
            creator.MemberId,
            state: HabitState.Active,
            expiryDate: DateTime.UtcNow.AddDays(-1));

        habit.ReminderTime = DateTime.UtcNow.AddMinutes(-5);
        await db.SaveChangesAsync();

        var reminder = SeedReminder(db, habit.HabitId, member.MemberId, enabled: true);

        await service.DispatchDueRemindersAsync();

        db.ChangeTracker.Clear();

        Assert.Empty(await db.Notifications.ToListAsync());

        var updatedReminder = await db.Reminders.FindAsync(reminder.ReminderId);
        Assert.NotNull(updatedReminder);
        Assert.Equal(UtcMinValue(), updatedReminder!.LastSentAt);
    }
}