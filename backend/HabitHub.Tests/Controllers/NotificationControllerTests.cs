namespace HabitHub.Tests.Controllers;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using HabitHub.Api.Data;
using HabitHub.Api.Models;
using HabitHub.Tests.Helpers;
using Microsoft.Extensions.DependencyInjection;

public class NotificationsControllerTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public NotificationsControllerTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<(HttpClient client, Member member)> CreateAuthenticatedClientAsync()
    {
        var client = _factory.CreateClient();

        var registerPayload = new
        {
            username = $"notif_user_{Guid.NewGuid():N}",
            email = $"notif_{Guid.NewGuid():N}@test.com",
            password = "Test1234!"
        };

        var register = await client.PostAsJsonAsync("/api/auth/register", registerPayload);
        register.EnsureSuccessStatusCode();

        var login = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email = registerPayload.email,
            password = registerPayload.password
        });
        login.EnsureSuccessStatusCode();

        var loginBody = await login.Content.ReadFromJsonAsync<LoginResponse>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", loginBody!.Token);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var member = db.Members.First(m => m.Email == registerPayload.email);

        return (client, member);
    }

    private async Task SeedNotificationAsync(Guid memberId, string content, bool isRead = false)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        db.Notifications.Add(new Notification
        {
            NotificationId = Guid.NewGuid(),
            MemberId = memberId,
            Content = content,
            IsRead = isRead,
            CreatedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetNotifications_ReturnsOk_WithEmptyList_WhenNoNotifications()
    {
        var (client, _) = await CreateAuthenticatedClientAsync();

        var response = await client.GetAsync("/api/notifications");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<List<NotificationResponse>>();
        Assert.NotNull(body);
        Assert.Empty(body);
    }

    [Fact]
    public async Task GetNotifications_ReturnsOwnNotifications_OrderedByCreatedAtDescending()
    {
        var (client, member) = await CreateAuthenticatedClientAsync();

        await SeedNotificationAsync(member.MemberId, "First notification");
        await Task.Delay(10);
        await SeedNotificationAsync(member.MemberId, "Second notification");

        var response = await client.GetAsync("/api/notifications");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<List<NotificationResponse>>();
        Assert.NotNull(body);
        Assert.Equal(2, body.Count);

        Assert.Equal("Second notification", body[0].Content);
        Assert.Equal("First notification", body[1].Content);
    }

    [Fact]
    public async Task GetNotifications_DoesNotReturn_OtherUsersNotifications()
    {
        var (client, member) = await CreateAuthenticatedClientAsync();
        var (_, otherMember) = await CreateAuthenticatedClientAsync();

        await SeedNotificationAsync(otherMember.MemberId, "Other user's notification");
        await SeedNotificationAsync(member.MemberId, "My notification");

        var response = await client.GetAsync("/api/notifications");
        var body = await response.Content.ReadFromJsonAsync<List<NotificationResponse>>();

        Assert.NotNull(body);
        Assert.All(body, n => Assert.Equal("My notification", n.Content));
        Assert.DoesNotContain(body, n => n.Content == "Other user's notification");
    }

    [Fact]
    public async Task GetNotifications_ReturnsReadField_CorrectlyMapped()
    {
        var (client, member) = await CreateAuthenticatedClientAsync();

        await SeedNotificationAsync(member.MemberId, "Unread one", isRead: false);
        await SeedNotificationAsync(member.MemberId, "Read one", isRead: true);

        var response = await client.GetAsync("/api/notifications");
        var body = await response.Content.ReadFromJsonAsync<List<NotificationResponse>>();

        Assert.NotNull(body);

        var unread = body.First(n => n.Content == "Unread one");
        var read = body.First(n => n.Content == "Read one");

        Assert.False(unread.Read);
        Assert.True(read.Read);
    }

    [Fact]
    public async Task GetNotifications_Returns401_WhenNotAuthenticated()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/notifications");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }


    [Fact]
    public async Task MarkAsRead_ReturnsNoContent_WhenNotificationExists()
    {
        var (client, member) = await CreateAuthenticatedClientAsync();
        await SeedNotificationAsync(member.MemberId, "Mark me as read");

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var notification = db.Notifications.First(n => n.MemberId == member.MemberId);

        var response = await client.PutAsync(
            $"/api/notifications/{notification.NotificationId}/read",
            null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task MarkAsRead_SetsIsRead_ToTrue_InDatabase()
    {
        var (client, member) = await CreateAuthenticatedClientAsync();
        await SeedNotificationAsync(member.MemberId, "Should become read", isRead: false);

        Guid notificationId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            notificationId = db.Notifications
                .First(n => n.MemberId == member.MemberId)
                .NotificationId;
        }

        await client.PutAsync($"/api/notifications/{notificationId}/read", null);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var notification = db.Notifications.Find(notificationId);
            Assert.NotNull(notification);
            Assert.True(notification!.IsRead);
        }
    }

    [Fact]
    public async Task MarkAsRead_IsIdempotent_WhenAlreadyRead()
    {
        var (client, member) = await CreateAuthenticatedClientAsync();
        await SeedNotificationAsync(member.MemberId, "Already read", isRead: true);

        Guid notificationId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            notificationId = db.Notifications
                .First(n => n.MemberId == member.MemberId)
                .NotificationId;
        }

        var first = await client.PutAsync($"/api/notifications/{notificationId}/read", null);
        var second = await client.PutAsync($"/api/notifications/{notificationId}/read", null);

        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, second.StatusCode);
    }

    [Fact]
    public async Task MarkAsRead_Returns404_WhenNotificationDoesNotExist()
    {
        var (client, _) = await CreateAuthenticatedClientAsync();

        var response = await client.PutAsync(
            $"/api/notifications/{Guid.NewGuid()}/read",
            null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task MarkAsRead_Returns404_WhenNotificationBelongsToOtherUser()
    {
        var (client, _) = await CreateAuthenticatedClientAsync();
        var (_, otherMember) = await CreateAuthenticatedClientAsync();

        await SeedNotificationAsync(otherMember.MemberId, "Not yours");

        Guid notificationId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            notificationId = db.Notifications
                .First(n => n.MemberId == otherMember.MemberId)
                .NotificationId;
        }

        var response = await client.PutAsync(
            $"/api/notifications/{notificationId}/read",
            null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task MarkAsRead_Returns401_WhenNotAuthenticated()
    {
        var client = _factory.CreateClient();
        var response = await client.PutAsync(
            $"/api/notifications/{Guid.NewGuid()}/read",
            null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UpdatePassword_CreatesNotification_WithCorrectContent()
    {
        var (client, member) = await CreateAuthenticatedClientAsync();

        await client.PutAsJsonAsync("/api/profile/password", new
        {
            currentPassword = "Test1234!",
            newPassword = "NewPass5678!"
        });

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var notification = db.Notifications
            .Where(n => n.MemberId == member.MemberId)
            .OrderByDescending(n => n.CreatedAt)
            .FirstOrDefault();

        Assert.NotNull(notification);
        Assert.Equal("Password changed successfully", notification!.Content);
        Assert.False(notification.IsRead);
    }

    [Fact]
    public async Task UpdateEmail_CreatesNotification_WithCorrectContent()
    {
        var (client, member) = await CreateAuthenticatedClientAsync();

        await client.PutAsJsonAsync("/api/profile/info", new
        {
            email = $"newemail_{Guid.NewGuid():N}@test.com"
        });

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var notification = db.Notifications
            .Where(n => n.MemberId == member.MemberId)
            .OrderByDescending(n => n.CreatedAt)
            .FirstOrDefault();

        Assert.NotNull(notification);
        Assert.Equal("Email updated successfully.", notification!.Content);
        Assert.False(notification.IsRead);
    }

    [Fact]
    public async Task UpdateUsername_CreatesNotification_WithCorrectContent()
    {
        var (client, member) = await CreateAuthenticatedClientAsync();

        await client.PutAsJsonAsync("/api/profile/info", new
        {
            username = $"newuser_{Guid.NewGuid():N}"
        });

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var notification = db.Notifications
            .Where(n => n.MemberId == member.MemberId)
            .OrderByDescending(n => n.CreatedAt)
            .FirstOrDefault();

        Assert.NotNull(notification);
        Assert.Equal("Username updated successfully.", notification!.Content);
        Assert.False(notification.IsRead);
    }

    private record NotificationResponse(
        Guid NotificationId,
        string Content,
        DateTime CreatedAt,
        bool Read
    );

    private record LoginResponse(string Token);
}