namespace HabitHub.Tests.Api;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using HabitHub.Api.Data;
using HabitHub.Api.Models;
using HabitHub.Tests.Helpers;
using Microsoft.Extensions.DependencyInjection;

public class NotificationsApiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public NotificationsApiTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }


    private async Task<(HttpClient client, Guid memberId)> RegisterAndLoginAsync()
    {
        var client = _factory.CreateClient();

        var email = $"api_notif_{Guid.NewGuid():N}@test.com";
        var password = "Test1234!";

        var register = await client.PostAsJsonAsync("/api/auth/register", new
        {
            username = $"api_notif_{Guid.NewGuid():N}",
            email,
            password
        });
        register.EnsureSuccessStatusCode();

        var login = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        login.EnsureSuccessStatusCode();

        var loginBody = await login.Content.ReadFromJsonAsync<LoginResponse>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", loginBody!.Token);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var member = db.Members.First(m => m.Email == email);

        return (client, member.MemberId);
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
    public async Task FullFlow_GetNotifications_ThenMarkAsRead_UpdatesState()
    {
        var (client, memberId) = await RegisterAndLoginAsync();
        await SeedNotificationAsync(memberId, "You have a new message", isRead: false);

        var getResponse = await client.GetAsync("/api/notifications");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var notifications = await getResponse.Content
            .ReadFromJsonAsync<List<NotificationResponse>>();
        Assert.NotNull(notifications);
        Assert.Single(notifications);
        Assert.False(notifications![0].Read);

        var notificationId = notifications[0].NotificationId;

        var putResponse = await client.PutAsync(
            $"/api/notifications/{notificationId}/read", null);
        Assert.Equal(HttpStatusCode.NoContent, putResponse.StatusCode);

        var getResponse2 = await client.GetAsync("/api/notifications");
        var updated = await getResponse2.Content
            .ReadFromJsonAsync<List<NotificationResponse>>();

        Assert.NotNull(updated);
        Assert.True(updated![0].Read);
    }

    [Fact]
    public async Task FullFlow_PasswordChange_CreatesNotification_VisibleInGetEndpoint()
    {
        var (client, _) = await RegisterAndLoginAsync();

        // change password
        var changeResp = await client.PutAsJsonAsync("/api/profile/password", new
        {
            currentPassword = "Test1234!",
            newPassword = "NewSecure99!"
        });
        Assert.Equal(HttpStatusCode.OK, changeResp.StatusCode);

        var getResp = await client.GetAsync("/api/notifications");
        var body = await getResp.Content.ReadFromJsonAsync<List<NotificationResponse>>();

        Assert.NotNull(body);
        Assert.Contains(body!, n => n.Content == "Password changed successfully");
    }

    [Fact]
    public async Task FullFlow_EmailUpdate_CreatesNotification_VisibleInGetEndpoint()
    {
        var (client, _) = await RegisterAndLoginAsync();

        var newEmail = $"updated_{Guid.NewGuid():N}@test.com";
        var updateResp = await client.PutAsJsonAsync("/api/profile/info", new { email = newEmail });
        Assert.Equal(HttpStatusCode.OK, updateResp.StatusCode);

        var getResp = await client.GetAsync("/api/notifications");
        var body = await getResp.Content.ReadFromJsonAsync<List<NotificationResponse>>();

        Assert.NotNull(body);
        Assert.Contains(body!, n => n.Content == "Email updated successfully.");
    }

    [Fact]
    public async Task FullFlow_UsernameUpdate_CreatesNotification_VisibleInGetEndpoint()
    {
        var (client, _) = await RegisterAndLoginAsync();

        var updateResp = await client.PutAsJsonAsync("/api/profile/info", new
        {
            username = $"updated_{Guid.NewGuid():N}"
        });
        Assert.Equal(HttpStatusCode.OK, updateResp.StatusCode);

        var getResp = await client.GetAsync("/api/notifications");
        var body = await getResp.Content.ReadFromJsonAsync<List<NotificationResponse>>();

        Assert.NotNull(body);
        Assert.Contains(body!, n => n.Content == "Username updated successfully.");
    }

    [Fact]
    public async Task FullFlow_MultipleUpdates_CreatesMultipleNotifications()
    {
        var (client, _) = await RegisterAndLoginAsync();

        await client.PutAsJsonAsync("/api/profile/info", new
        {
            email = $"multi_{Guid.NewGuid():N}@test.com"
        });

        await client.PutAsJsonAsync("/api/profile/password", new
        {
            currentPassword = "Test1234!",
            newPassword = "Another99!"
        });

        var getResp = await client.GetAsync("/api/notifications");
        var body = await getResp.Content.ReadFromJsonAsync<List<NotificationResponse>>();

        Assert.NotNull(body);
        Assert.True(body!.Count >= 2);
        Assert.Contains(body, n => n.Content == "Email updated successfully.");
        Assert.Contains(body, n => n.Content == "Password changed successfully");
    }

    [Fact]
    public async Task FullFlow_TwoUsers_CannotSeeEachOthersNotifications()
    {
        var (clientA, memberAId) = await RegisterAndLoginAsync();
        var (clientB, _) = await RegisterAndLoginAsync();

        await SeedNotificationAsync(memberAId, "Only for user A");

        var responseB = await clientB.GetAsync("/api/notifications");
        var bodyB = await responseB.Content.ReadFromJsonAsync<List<NotificationResponse>>();

        Assert.NotNull(bodyB);
        Assert.DoesNotContain(bodyB!, n => n.Content == "Only for user A");
    }

    [Fact]
    public async Task FullFlow_MarkAsRead_ThenGetNotifications_ShowsCorrectReadStatus()
    {
        var (client, memberId) = await RegisterAndLoginAsync();

        await SeedNotificationAsync(memberId, "Notification A");
        await SeedNotificationAsync(memberId, "Notification B");

        var getResp1 = await client.GetAsync("/api/notifications");
        var initial = await getResp1.Content.ReadFromJsonAsync<List<NotificationResponse>>();
        Assert.NotNull(initial);

        var firstId = initial![0].NotificationId;
        await client.PutAsync($"/api/notifications/{firstId}/read", null);

        var getResp2 = await client.GetAsync("/api/notifications");
        var afterMark = await getResp2.Content.ReadFromJsonAsync<List<NotificationResponse>>();
        Assert.NotNull(afterMark);

        var markedOne = afterMark!.First(n => n.NotificationId == firstId);
        var unmarkedOne = afterMark.First(n => n.NotificationId != firstId);

        Assert.True(markedOne.Read);
        Assert.False(unmarkedOne.Read);
    }

    private record NotificationResponse(
        Guid NotificationId,
        string Content,
        DateTime CreatedAt,
        bool Read
    );

    private record LoginResponse(string Token);
}