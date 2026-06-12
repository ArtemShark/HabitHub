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

        var nowUtc = DateTime.UtcNow;

        var reminders = await db.Reminders
            .Include(r => r.Member)
            .Include(r => r.Habit)
                .ThenInclude(h => h.Team)
                    .ThenInclude(t => t.Memberships)
            .Where(r =>
                r.Enabled &&
                r.Habit.HabitState == HabitState.Active &&
                r.Habit.ReminderTime != null &&
                r.Habit.ExpiryDate > nowUtc)
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

            var memberTimeZone = GetMemberTimeZone(reminder.Member.Timezone);
            var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, memberTimeZone);
            var reminderWallClockTime = ToReminderWallClockTime(habit.ReminderTime!.Value);

            if (!IsReminderDueToday(reminderWallClockTime, nowLocal))
                continue;

            if (WasReminderAlreadySentToday(reminder.LastSentAt, nowLocal, memberTimeZone))
                continue;

            var startOfTodayUtc = TimeZoneInfo.ConvertTimeToUtc(nowLocal.Date, memberTimeZone);
            var endOfTodayUtc = TimeZoneInfo.ConvertTimeToUtc(nowLocal.Date.AddDays(1), memberTimeZone);

            var alreadyLoggedToday = await db.HabitEntries.AnyAsync(e =>
                    e.HabitId == reminder.HabitId &&
                    e.MemberId == reminder.MemberId &&
                    e.Date >= startOfTodayUtc &&
                    e.Date < endOfTodayUtc,
                cancellationToken);

            if (alreadyLoggedToday)
                continue;

            db.Notifications.Add(new Notification
            {
                NotificationId = Guid.NewGuid(),
                MemberId = reminder.MemberId,
                Content = $"Reminder: it is time to log \"{habit.Name}\".",
                CreatedAt = nowUtc,
                IsRead = false
            });

            reminder.LastSentAt = nowUtc;
            sentCount++;
        }

        if (sentCount == 0 && disabledInactiveCount == 0)
            return;

        await db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Reminder dispatch finished. Sent {SentCount} notification(s). Disabled {DisabledCount} inactive reminder(s).",
            sentCount,
            disabledInactiveCount);
    }

    private static bool IsReminderDueToday(DateTime reminderWallClockTime, DateTime nowLocal)
    {
        if (reminderWallClockTime.Date > nowLocal.Date)
            return false;

        return nowLocal.TimeOfDay >= reminderWallClockTime.TimeOfDay;
    }

    private static bool WasReminderAlreadySentToday(
        DateTime lastSentAt,
        DateTime nowLocal,
        TimeZoneInfo memberTimeZone)
    {
        if (lastSentAt.Year <= 1)
            return false;

        var lastSentAtUtc = ToUtc(lastSentAt);
        var lastSentAtLocal = TimeZoneInfo.ConvertTimeFromUtc(lastSentAtUtc, memberTimeZone);

        return lastSentAtLocal.Date == nowLocal.Date;
    }

    private static TimeZoneInfo GetMemberTimeZone(string? timezone)
    {
        if (string.IsNullOrWhiteSpace(timezone))
            return TimeZoneInfo.Utc;

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timezone);
        }
        catch
        {
            try
            {
                if (TimeZoneInfo.TryConvertIanaIdToWindowsId(timezone, out var windowsId))
                {
                    return TimeZoneInfo.FindSystemTimeZoneById(windowsId);
                }
            }
            catch
            {
                return TimeZoneInfo.Utc;
            }

            return TimeZoneInfo.Utc;
        }
    }

    private static DateTime ToReminderWallClockTime(DateTime value)
    {
        return new DateTime(
            value.Year,
            value.Month,
            value.Day,
            value.Hour,
            value.Minute,
            0,
            DateTimeKind.Utc);
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