using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using HabitHub.Api.Contracts.Auth;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Api.Models;
using HabitHub.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace HabitHub.Tests.Helpers;

public static class TestHelper
{

    public static AppDbContext CreateInMemoryDbContext(string? dbName = null)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: dbName ?? Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    public static Mock<IJwtTokenService> CreateMockJwtService()
    {
        var mock = new Mock<IJwtTokenService>();

        mock.Setup(s => s.CreateToken(It.IsAny<Member>()))
            .Returns(("fake-jwt-token", DateTime.UtcNow.AddHours(1)));

        return mock;
    }


    public static void SetAuthenticatedUser(ControllerBase controller, Guid userId)
    {
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Name, $"user-{userId}")
        }, authenticationType: "TestAuth");

        var principal = new ClaimsPrincipal(identity);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };
    }


    public static void SetUnauthenticatedUser(ControllerBase controller)
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity());
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };
    }


    public static Member SeedMember(
        AppDbContext db,
        string? name = null,
        string? email = null,
        string password = "Password123!")
    {
        var member = new Member
        {
            MemberId = Guid.NewGuid(),
            Name = name ?? $"user-{Guid.NewGuid():N}".Substring(0, 12),
            Email = email ?? $"{Guid.NewGuid():N}@example.com",
            Timezone = "UTC"
        };

        var hasher = new PasswordHasher<Member>();
        member.PasswordHash = hasher.HashPassword(member, password);

        db.Members.Add(member);
        db.SaveChanges();
        return member;
    }


    public static HabitTeam SeedTeam(
        AppDbContext db,
        Guid creatorId,
        string name = "Test Team",
        params Guid[] extraMemberIds)
    {
        var creator = db.Members.First(m => m.MemberId == creatorId);

        var teamId = Guid.NewGuid();
        var chat = new TeamChat { TeamChatId = Guid.NewGuid(), HabitTeamId = teamId };

        var team = new HabitTeam
        {
            HabitTeamId = teamId,
            Name = name,
            CreatorId = creatorId,
            Creator = creator,
            Chat = chat
        };
        chat.Team = team;

        team.Memberships.Add(new Membership
        {
            MembershipId = Guid.NewGuid(),
            MemberId = creatorId,
            Member = creator,
            HabitTeamId = teamId,
            Team = team,
            Role = MembershipRole.Creator,
            Status = MembershipStatus.Active
        });

        foreach (var extraId in extraMemberIds)
        {
            var extra = db.Members.First(m => m.MemberId == extraId);
            team.Memberships.Add(new Membership
            {
                MembershipId = Guid.NewGuid(),
                MemberId = extraId,
                Member = extra,
                HabitTeamId = teamId,
                Team = team,
                Role = MembershipRole.Member,
                Status = MembershipStatus.Active
            });
        }

        db.HabitTeams.Add(team);
        db.SaveChanges();
        return team;
    }

    public static Habit SeedHabit(
        AppDbContext db,
        Guid teamId,
        Guid creatorId,
        string name = "Drink water",
        string goal = "8 glasses per day",
        HabitType type = HabitType.Quantitative,
        string? unit = "glasses",
        HabitState state = HabitState.Active,
        DateTime? expiryDate = null)
    {
        var habit = new Habit
        {
            HabitId = Guid.NewGuid(),
            HabitTeamId = teamId,
            CreatorId = creatorId,
            Name = name,
            Goal = goal,
            HabitType = type,
            Unit = type == HabitType.Binary ? null : unit,
            HabitState = state,
            ExpiryDate = expiryDate ?? DateTime.UtcNow.AddDays(30)
        };

        db.Habits.Add(habit);
        db.SaveChanges();
        return habit;
    }

    public static InviteCode SeedInviteCode(
        AppDbContext db,
        Guid teamId,
        string? code = null,
        DateTime? expiryDate = null,
        CodeState status = CodeState.Active)
    {
        var invite = new InviteCode
        {
            InviteCodeId = Guid.NewGuid(),
            HabitTeamId = teamId,
            Code = code ?? Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(),
            ExpiryDate = expiryDate ?? DateTime.UtcNow.AddDays(5),
            CodeStatus = status
        };

        db.InviteCodes.Add(invite);
        db.SaveChanges();
        return invite;
    }

    
    public static async Task<AuthResponse> RegisterAndAuthenticateAsync(
        HttpClient client,
        string? username = null,
        string? email = null,
        string password = "Password123!")
    {
        var request = new RegisterRequest
        {
            Username = username ?? $"user{Guid.NewGuid():N}".Substring(0, 12),
            Email = email ?? $"api-{Guid.NewGuid()}@example.com",
            Password = password
        };

        var response = await client.PostAsJsonAsync("/api/auth/register", request);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<AuthResponse>()
                   ?? throw new InvalidOperationException("Register response was empty");

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.Token);
        return body;
    }

    public static async Task<(HttpClient Client, AuthResponse Auth)> CreateSecondaryClientAsync(
        Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> factory)
    {
        var client = factory.CreateClient();
        var auth = await RegisterAndAuthenticateAsync(client);
        return (client, auth);
    }
}