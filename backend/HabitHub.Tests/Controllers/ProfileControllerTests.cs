using HabitHub.Api.Controllers;
using HabitHub.Api.Data;
using HabitHub.Api.Models;
using HabitHub.Tests.Helpers;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace HabitHub.Tests.Controllers;

public class ProfileControllerTests
{
    private static (ProfileController controller, AppDbContext db, PasswordHasher<Member> hasher) CreateController(Guid? userId = null)
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var hasher = new PasswordHasher<Member>();
        var controller = new ProfileController(db, hasher);

        if (userId.HasValue)
            TestHelper.SetAuthenticatedUser(controller, userId.Value);
        else
            TestHelper.SetUnauthenticatedUser(controller);

        return (controller, db, hasher);
    }

    [Fact]
    public async Task UpdateInfo_WhenUserMissing_ReturnsNotFound()
    {
        var (controller, _, _) = CreateController(Guid.NewGuid());

        var result = await controller.UpdateInfo(new UpdateInfoRequest { Username = "New" });

        Assert.IsType<NotFoundResult>(result);
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData("", null)]
    [InlineData("   ", null)]
    [InlineData(null, "")]
    [InlineData(null, "   ")]
    [InlineData("   ", "   ")]
    public async Task UpdateInfo_WhenNoEffectiveChangesProvided_ReturnsBadRequest(string? username, string? email)
    {
        var (controller, db, _) = CreateController();
        var me = TestHelper.SeedMember(db, name: "Alice", email: "alice@example.com");
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.UpdateInfo(new UpdateInfoRequest
        {
            Username = username,
            Email = email
        });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("No changes provided", badRequest.Value);
    }

    [Fact]
    public async Task UpdateInfo_NormalizesEmailAndUpdatesName()
    {
        var (controller, db, _) = CreateController();
        var me = TestHelper.SeedMember(db, name: "Alice", email: "alice@example.com");
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.UpdateInfo(new UpdateInfoRequest
        {
            Username = "Alice Updated",
            Email = "  NEW@Example.COM  "
        });

        var ok = Assert.IsType<OkObjectResult>(result);
        var persisted = await db.Members.FindAsync(me.MemberId);
        Assert.NotNull(persisted);
        Assert.Equal("Alice Updated", persisted!.Name);
        Assert.Equal("new@example.com", persisted.Email);
        Assert.Contains("Profile updated successfully", ok.Value?.ToString());
    }

    [Fact]
    public async Task UpdatePassword_WhenUserMissing_ReturnsNotFound()
    {
        var (controller, _, _) = CreateController(Guid.NewGuid());

        var result = await controller.UpdatePassword(new UpdatePasswordRequest
        {
            CurrentPassword = "Old123!",
            NewPassword = "New123!"
        });

        Assert.IsType<NotFoundResult>(result);
    }

    [Theory]
    [InlineData(null, "NewPassword123!", "Current password is required")]
    [InlineData("", "NewPassword123!", "Current password is required")]
    [InlineData(" ", "NewPassword123!", "Current password is required")]
    [InlineData("   ", "NewPassword123!", "Current password is required")]
    [InlineData("Password123!", null, "New password cannot be empty")]
    [InlineData("Password123!", "", "New password cannot be empty")]
    [InlineData("Password123!", " ", "New password cannot be empty")]
    [InlineData("Password123!", "   ", "New password cannot be empty")]
    public async Task UpdatePassword_InvalidCurrentOrNewPassword_ReturnsBadRequest(
        string? currentPassword,
        string? newPassword,
        string expectedMessage)
    {
        var (controller, db, _) = CreateController();
        var me = TestHelper.SeedMember(db, password: "Password123!");
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.UpdatePassword(new UpdatePasswordRequest
        {
            CurrentPassword = currentPassword,
            NewPassword = newPassword
        });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(expectedMessage, badRequest.Value);
    }

    [Fact]
    public async Task UpdatePassword_WhenUserHasNoPasswordSet_ReturnsBadRequest()
    {
        var (controller, db, _) = CreateController();
        var me = new Member
        {
            MemberId = Guid.NewGuid(),
            Name = "NoPassword",
            Email = "nopassword@example.com",
            PasswordHash = string.Empty,
            Timezone = "UTC"
        };
        db.Members.Add(me);
        await db.SaveChangesAsync();
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.UpdatePassword(new UpdatePasswordRequest
        {
            CurrentPassword = "Anything123!",
            NewPassword = "NewPassword123!"
        });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("User has no password set", badRequest.Value);
    }

    [Fact]
    public async Task UpdatePassword_WhenCurrentPasswordIncorrect_ReturnsBadRequest()
    {
        var (controller, db, _) = CreateController();
        var me = TestHelper.SeedMember(db, password: "Password123!");
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.UpdatePassword(new UpdatePasswordRequest
        {
            CurrentPassword = "WrongPassword!",
            NewPassword = "NewPassword123!"
        });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Current password is incorrect", badRequest.Value);
    }

    [Fact]
    public async Task UpdatePassword_HappyPath_RehashesPassword()
    {
        var (controller, db, hasher) = CreateController();
        var me = TestHelper.SeedMember(db, password: "Password123!");
        var oldHash = me.PasswordHash;
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.UpdatePassword(new UpdatePasswordRequest
        {
            CurrentPassword = "Password123!",
            NewPassword = "NewPassword123!"
        });

        var ok = Assert.IsType<OkObjectResult>(result);
        var persisted = await db.Members.FindAsync(me.MemberId);
        Assert.NotNull(persisted);
        Assert.NotEqual(oldHash, persisted!.PasswordHash);
        Assert.Equal(
            PasswordVerificationResult.Success,
            hasher.VerifyHashedPassword(persisted, persisted.PasswordHash, "NewPassword123!"));
        Assert.Contains("Password changed successfully", ok.Value?.ToString());
    }
}