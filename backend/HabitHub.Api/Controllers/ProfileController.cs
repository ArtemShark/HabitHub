namespace HabitHub.Api.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using HabitHub.Api.Data;
using HabitHub.Api.Models;
using HabitHub.Api.Util;

[Authorize]
[ApiController]
[Route("api/profile")]
public class ProfileController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly PasswordHasher<Member> _passwordHasher;

    public ProfileController(AppDbContext context, PasswordHasher<Member> passwordHasher)
    {
        _context = context;
        _passwordHasher = passwordHasher;
    }

    [HttpPut("info")]
    public async Task<IActionResult> UpdateInfo(UpdateInfoRequest request)
    {
        var userId = GetCurrentUserId.GetUserId(User);
        var user = await _context.Members.FindAsync(userId);

        if (user == null)
            return NotFound();

        bool updated = false;

        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var email = request.Email.Trim().ToLowerInvariant();

            if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
            {
                user.Email = email;
                _context.Notifications.Add(new Notification
                {
                    NotificationId = Guid.NewGuid(),
                    MemberId = user.MemberId,
                    Content = "Email updated successfully."
                });
                updated = true;
            }
        }

        if (!string.IsNullOrWhiteSpace(request.Username))
        {
            var username = request.Username.Trim();

            if (!string.Equals(user.Name, username, StringComparison.Ordinal))
            {
                user.Name = username;
                _context.Notifications.Add(new Notification
                {
                    NotificationId = Guid.NewGuid(),
                    MemberId = user.MemberId,
                    Content = "Username updated successfully."
                });
                updated = true;
            }
        }

        if (!updated)
        {
            return BadRequest("No changes provided");
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = "Profile updated successfully." });
    }

    [HttpPut("password")]
    public async Task<IActionResult> UpdatePassword(UpdatePasswordRequest request)
    {
        var userId = GetCurrentUserId.GetUserId(User);
        var user = await _context.Members.FindAsync(userId);

        if (user == null)
            return NotFound();

        if (string.IsNullOrWhiteSpace(request.CurrentPassword))
            return BadRequest("Current password is required");

        if (string.IsNullOrWhiteSpace(request.NewPassword))
            return BadRequest("New password cannot be empty");

        if (string.IsNullOrWhiteSpace(user.PasswordHash))
            return BadRequest("User has no password set");

        var result = _passwordHasher.VerifyHashedPassword(
            user,
            user.PasswordHash,
            request.CurrentPassword
        );

        if (result == PasswordVerificationResult.Failed)
            return BadRequest("Current password is incorrect");

        user.PasswordHash = _passwordHasher.HashPassword(user, request.NewPassword);
        _context.Notifications.Add(new Notification
        {
            NotificationId = Guid.NewGuid(),
            MemberId = user.MemberId,
            Content = "Password changed successfully"
        });
        await _context.SaveChangesAsync();

        return Ok(new { message = "Password changed successfully" });
    }
}
