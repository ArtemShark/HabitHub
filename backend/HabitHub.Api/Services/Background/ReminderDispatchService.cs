using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HabitHub.Api.Services.Background;

public class ReminderDispatchService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ReminderDispatchService> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromMinutes(1);

    public ReminderDispatchService(
        IServiceScopeFactory scopeFactory,
        ILogger<ReminderDispatchService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("ReminderDispatchService started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await DispatchDueRemindersAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while dispatching reminders.");
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }

    public async Task DispatchDueRemindersAsync(CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var now = DateTime.UtcNow;
        var startOfToday = now.Date;
        var endOfToday = startOfToday.AddDays(1);

        var reminders = await db.Reminders
            .Include(r => r.Habit)
                .ThenInclude(h => h.Team)
                    .ThenInclude(t => t.Memberships)
            .Where(r =>
                r.Enabled &&
                r.Habit.HabitState == HabitState.Active &&
                r.Habit.ReminderTime != null &&
                r.Habit.ExpiryDate > now)
            .ToListAsync(cancellationToken);

        var sentCount = 0;
        var disabledInactiveCount = 0;

        foreach (var reminder in reminders)
        {
            var habit = reminder.Habit;

            var isActiveMember = habit.Team.Memberships.Any(m =>
                m.MemberId == reminder.MemberId &&
                m.Status == MembershipStatus.Active);

            if (!isActiveMember)
            {
                reminder.Enabled = false;
                disabledInactiveCount++;
                continue;
            }

            if (!IsReminderDueToday(habit.ReminderTime!.Value, now))
                continue;

            if (WasReminderAlreadySentToday(reminder.LastSentAt, now))
                continue;

            var alreadyLoggedToday = await db.HabitEntries.AnyAsync(e =>
                    e.HabitId == reminder.HabitId &&
                    e.MemberId == reminder.MemberId &&
                    e.Date >= startOfToday &&
                    e.Date < endOfToday,
                cancellationToken);

            if (alreadyLoggedToday)
                continue;

            db.Notifications.Add(new Notification
            {
                NotificationId = Guid.NewGuid(),
                MemberId = reminder.MemberId,
                Content = $"Reminder: it is time to log \"{habit.Name}\".",
                CreatedAt = now,
                IsRead = false
            });

            reminder.LastSentAt = now;
            sentCount++;
        }

        if (sentCount == 0 && disabledInactiveCount == 0)
            return;

        await db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Dispatched {SentCount} reminder notification(s). Disabled {DisabledCount} inactive reminder(s).",
            sentCount,
            disabledInactiveCount);
    }

    private static bool IsReminderDueToday(DateTime reminderTime, DateTime nowUtc)
    {
        var reminderTimeUtc = ToUtc(reminderTime);

        if (reminderTimeUtc.Date > nowUtc.Date)
            return false;

        return nowUtc.TimeOfDay >= reminderTimeUtc.TimeOfDay;
    }

    private static bool WasReminderAlreadySentToday(DateTime lastSentAt, DateTime nowUtc)
    {
        if (lastSentAt.Year <= 1)
            return false;

        var lastSentAtUtc = ToUtc(lastSentAt);
        return lastSentAtUtc.Date == nowUtc.Date;
    }

    private static DateTime ToUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }
}