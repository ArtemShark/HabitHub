using System.Security.Claims;
using HabitHub.Api.Controllers;
using HabitHub.Api.Contracts.Leaderboard;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HabitHub.Tests.Controllers;

public class LeaderboardControllerTests
{
    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static LeaderboardController CreateController(
        AppDbContext context,
        Guid? userId = null)
    {
        var controller = new LeaderboardController(context);

        var claims = new List<Claim>();

        if (userId.HasValue)
        {
            claims.Add(new Claim(ClaimTypes.NameIdentifier, userId.Value.ToString()));
            claims.Add(new Claim("sub", userId.Value.ToString()));
        }

        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = principal
            }
        };

        return controller;
    }

    private static HabitType GetNonBinaryHabitType()
    {
        return Enum
            .GetValues<HabitType>()
            .First(type => type != HabitType.Binary);
    }

    private static Member CreateMember(Guid memberId, string name)
    {
        return new Member
        {
            MemberId = memberId,
            Name = name,
            Email = $"{name.ToLower()}@test.com",
            PasswordHash = "test-password-hash",
            Timezone = "UTC"
        };
    }

    private static HabitTeam CreateTeam(Guid teamId, Member creator, string name = "Test Team")
    {
        var chat = new TeamChat
        {
            TeamChatId = Guid.NewGuid(),
            HabitTeamId = teamId
        };

        var team = new HabitTeam
        {
            HabitTeamId = teamId,
            Name = name,
            CreatorId = creator.MemberId,
            Creator = creator,
            Chat = chat
        };

        chat.Team = team;

        return team;
    }

    private static Habit CreateHabit(
        Guid habitId,
        HabitTeam team,
        Member creator,
        string name,
        HabitType habitType)
    {
        return new Habit
        {
            HabitId = habitId,
            HabitTeamId = team.HabitTeamId,
            Team = team,
            CreatorId = creator.MemberId,
            Creator = creator,
            Name = name,
            Goal = "100",
            HabitState = default,
            ExpiryDate = DateTime.UtcNow.AddDays(30),
            HabitType = habitType,
            Unit = null
        };
    }

    private static Membership CreateMembership(
        Member member,
        HabitTeam team,
        MembershipStatus status = MembershipStatus.Active)
    {
        return new Membership
        {
            MembershipId = Guid.NewGuid(),
            MemberId = member.MemberId,
            Member = member,
            HabitTeamId = team.HabitTeamId,
            Team = team,
            Status = status,
            Role = default
        };
    }

    private static HabitEntry CreateEntry(
        Habit habit,
        Member member,
        float? value)
    {
        return new HabitEntry
        {
            HabitEntryId = Guid.NewGuid(),
            HabitId = habit.HabitId,
            Habit = habit,
            MemberId = member.MemberId,
            Member = member,
            Date = DateTime.UtcNow,
            Status = default,
            Value = value,
            Notes = ""
        };
    }

    [Fact]
    public async Task ViewLeaderboard_ReturnsUnauthorized_WhenUserIdIsMissing()
    {
        await using var context = CreateDbContext();

        var controller = CreateController(context);

        var result = await controller.ViewLeaderboard(Guid.NewGuid());

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task ViewLeaderboard_ReturnsNotFound_WhenHabitDoesNotExist()
    {
        await using var context = CreateDbContext();

        var currentUserId = Guid.NewGuid();
        var controller = CreateController(context, currentUserId);

        var result = await controller.ViewLeaderboard(Guid.NewGuid());

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task ViewLeaderboard_ReturnsForbid_WhenUserIsNotActiveTeamMember()
    {
        await using var context = CreateDbContext();

        var currentUserId = Guid.NewGuid();
        var creator = CreateMember(Guid.NewGuid(), "Creator");

        var teamId = Guid.NewGuid();
        var habitId = Guid.NewGuid();

        var team = CreateTeam(teamId, creator);
        var habit = CreateHabit(
            habitId,
            team,
            creator,
            "Drink Water",
            GetNonBinaryHabitType()
        );

        context.Members.Add(creator);
        context.HabitTeams.Add(team);
        context.Habits.Add(habit);

        await context.SaveChangesAsync();

        var controller = CreateController(context, currentUserId);

        var result = await controller.ViewLeaderboard(habitId);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task ViewLeaderboard_ReturnsLeaderboard_ForNonBinaryHabit()
    {
        await using var context = CreateDbContext();

        var currentUserId = Guid.NewGuid();

        var member1 = CreateMember(currentUserId, "Alice");
        var member2 = CreateMember(Guid.NewGuid(), "Bob");
        var member3 = CreateMember(Guid.NewGuid(), "Charlie");

        var teamId = Guid.NewGuid();
        var habitId = Guid.NewGuid();

        var team = CreateTeam(teamId, member1, "Fitness Team");

        var habit = CreateHabit(
            habitId,
            team,
            member1,
            "Steps",
            GetNonBinaryHabitType()
        );

        var membership = CreateMembership(member1, team);

        var entries = new List<HabitEntry>
        {
            CreateEntry(habit, member1, 10),
            CreateEntry(habit, member1, 15),
            CreateEntry(habit, member2, 40),
            CreateEntry(habit, member3, 5)
        };

        context.Members.AddRange(member1, member2, member3);
        context.HabitTeams.Add(team);
        context.Habits.Add(habit);
        context.Memberships.Add(membership);
        context.HabitEntries.AddRange(entries);

        await context.SaveChangesAsync();

        var controller = CreateController(context, currentUserId);

        var result = await controller.ViewLeaderboard(habitId);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<LeaderboardResponse>(okResult.Value);

        Assert.Equal(habitId, response.HabitId);
        Assert.Equal("Steps", response.HabitName);

        Assert.Equal(3, response.Entries.Count);

        Assert.Equal("Bob", response.Entries[0].Username);
        Assert.Equal(40, response.Entries[0].TotalProgress);
        Assert.Equal(1, response.Entries[0].Rank);

        Assert.Equal("Alice", response.Entries[1].Username);
        Assert.Equal(25, response.Entries[1].TotalProgress);
        Assert.Equal(2, response.Entries[1].Rank);

        Assert.Equal("Charlie", response.Entries[2].Username);
        Assert.Equal(5, response.Entries[2].TotalProgress);
        Assert.Equal(3, response.Entries[2].Rank);
    }

    [Fact]
    public async Task ViewLeaderboard_ReturnsLeaderboard_ForBinaryHabit()
    {
        await using var context = CreateDbContext();

        var currentUserId = Guid.NewGuid();

        var member1 = CreateMember(currentUserId, "Alice");
        var member2 = CreateMember(Guid.NewGuid(), "Bob");

        var teamId = Guid.NewGuid();
        var habitId = Guid.NewGuid();

        var team = CreateTeam(teamId, member1, "Health Team");

        var habit = CreateHabit(
            habitId,
            team,
            member1,
            "Meditation",
            HabitType.Binary
        );

        var membership = CreateMembership(member1, team);

        var entries = new List<HabitEntry>
        {
            CreateEntry(habit, member1, null),
            CreateEntry(habit, member1, null),
            CreateEntry(habit, member2, null)
        };

        context.Members.AddRange(member1, member2);
        context.HabitTeams.Add(team);
        context.Habits.Add(habit);
        context.Memberships.Add(membership);
        context.HabitEntries.AddRange(entries);

        await context.SaveChangesAsync();

        var controller = CreateController(context, currentUserId);

        var result = await controller.ViewLeaderboard(habitId);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<LeaderboardResponse>(okResult.Value);

        Assert.Equal(habitId, response.HabitId);
        Assert.Equal("Meditation", response.HabitName);

        Assert.Equal(2, response.Entries.Count);

        Assert.Equal("Alice", response.Entries[0].Username);
        Assert.Equal(2, response.Entries[0].TotalProgress);
        Assert.Equal(1, response.Entries[0].Rank);

        Assert.Equal("Bob", response.Entries[1].Username);
        Assert.Equal(1, response.Entries[1].TotalProgress);
        Assert.Equal(2, response.Entries[1].Rank);
    }

    [Fact]
    public async Task ViewLeaderboard_TreatsNullValueAsZero_ForNonBinaryHabit()
    {
        await using var context = CreateDbContext();

        var currentUserId = Guid.NewGuid();

        var member = CreateMember(currentUserId, "Alice");

        var teamId = Guid.NewGuid();
        var habitId = Guid.NewGuid();

        var team = CreateTeam(teamId, member, "Study Team");

        var habit = CreateHabit(
            habitId,
            team,
            member,
            "Read Pages",
            GetNonBinaryHabitType()
        );

        var membership = CreateMembership(member, team);
        var entry = CreateEntry(habit, member, null);

        context.Members.Add(member);
        context.HabitTeams.Add(team);
        context.Habits.Add(habit);
        context.Memberships.Add(membership);
        context.HabitEntries.Add(entry);

        await context.SaveChangesAsync();

        var controller = CreateController(context, currentUserId);

        var result = await controller.ViewLeaderboard(habitId);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<LeaderboardResponse>(okResult.Value);

        Assert.Single(response.Entries);

        Assert.Equal("Alice", response.Entries[0].Username);
        Assert.Equal(0, response.Entries[0].TotalProgress);
        Assert.Equal(1, response.Entries[0].Rank);
    }
}