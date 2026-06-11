using HabitHub.Api.Contracts.Member;
using HabitHub.Api.Contracts.Team;
using HabitHub.Api.Controllers;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Tests.Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HabitHub.Tests.Controllers;

public class HabitTeamControllerTests
{
    private static (HabitTeamController controller, AppDbContext db) CreateController(Guid? userId = null)
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var controller = new HabitTeamController(db);

        if (userId.HasValue)
            TestHelper.SetAuthenticatedUser(controller, userId.Value);
        else
            TestHelper.SetUnauthenticatedUser(controller);

        return (controller, db);
    }


    [Fact]
    public async Task GetMyTeams_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController(userId: null);

        var result = await controller.GetMyTeams();

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task GetMyTeams_ReturnsOnlyTeamsWhereUserIsMember()
    {
        var (controller, db) = CreateController();

        var me = TestHelper.SeedMember(db, name: "me");
        var other = TestHelper.SeedMember(db, name: "other");

        var myTeam = TestHelper.SeedTeam(db, me.MemberId, "My team");
        TestHelper.SeedTeam(db, other.MemberId, "Not my team");
        var sharedTeam = TestHelper.SeedTeam(db, other.MemberId, "Shared", me.MemberId);

        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.GetMyTeams();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var teams = Assert.IsAssignableFrom<List<TeamResponse>>(ok.Value);

        Assert.Equal(2, teams.Count);
        Assert.Contains(teams, t => t.HabitTeamId == myTeam.HabitTeamId);
        Assert.Contains(teams, t => t.HabitTeamId == sharedTeam.HabitTeamId);
    }


    [Fact]
    public async Task GetTeam_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController(userId: null);

        var result = await controller.GetTeam(Guid.NewGuid());

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task GetTeam_WhenTeamMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.GetTeam(Guid.NewGuid());

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task GetTeam_WhenNotMember_ReturnsForbid()
    {
        var (controller, db) = CreateController();
        var outsider = TestHelper.SeedMember(db, name: "outsider");
        var creator = TestHelper.SeedMember(db, name: "creator");
        var team = TestHelper.SeedTeam(db, creator.MemberId);

        TestHelper.SetAuthenticatedUser(controller, outsider.MemberId);

        var result = await controller.GetTeam(team.HabitTeamId);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task GetTeam_WhenMember_ReturnsOkWithTeam()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId, "Yoga team");
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.GetTeam(team.HabitTeamId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var body = Assert.IsType<TeamResponse>(ok.Value);
        Assert.Equal(team.HabitTeamId, body.HabitTeamId);
        Assert.Equal("Yoga team", body.Name);
        Assert.Equal(me.MemberId, body.CreatorId);
        Assert.Single(body.Members);
        Assert.Equal(MembershipRole.Creator, body.Members[0].Role);
    }

    [Fact]
    public async Task GetTeamMembers_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController(userId: null);

        var result = await controller.GetTeamMembers(Guid.NewGuid());

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task GetTeamMembers_WhenTeamMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.GetTeamMembers(Guid.NewGuid());

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task GetTeamMembers_WhenNotMember_ReturnsForbid()
    {
        var (controller, db) = CreateController();
        var outsider = TestHelper.SeedMember(db, name: "outsider");
        var creator = TestHelper.SeedMember(db, name: "creator");
        var team = TestHelper.SeedTeam(db, creator.MemberId);

        TestHelper.SetAuthenticatedUser(controller, outsider.MemberId);

        var result = await controller.GetTeamMembers(team.HabitTeamId);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task GetTeamMembers_WhenCreator_ReturnsOkWithMembers()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db, name: "creator");
        var member = TestHelper.SeedMember(db, name: "member");
        var team = TestHelper.SeedTeam(db, creator.MemberId, "Team", extraMemberIds: new[] { member.MemberId });

        TestHelper.SetAuthenticatedUser(controller, creator.MemberId);

        var result = await controller.GetTeamMembers(team.HabitTeamId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var members = Assert.IsAssignableFrom<List<TeamMemberResponse>>(ok.Value);
        Assert.Equal(2, members.Count);
        Assert.Contains(members, m => m.MemberId == creator.MemberId && m.Role == MembershipRole.Creator);
        Assert.Contains(members, m => m.MemberId == member.MemberId && m.Role == MembershipRole.Member);
    }

    [Fact]
    public async Task GetTeamMembers_WhenMember_ReturnsOkWithMembers()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db, name: "creator");
        var member = TestHelper.SeedMember(db, name: "member");
        var team = TestHelper.SeedTeam(db, creator.MemberId, "Team", extraMemberIds: new[] { member.MemberId });

        TestHelper.SetAuthenticatedUser(controller, member.MemberId);

        var result = await controller.GetTeamMembers(team.HabitTeamId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var members = Assert.IsAssignableFrom<List<TeamMemberResponse>>(ok.Value);
        Assert.Equal(2, members.Count);
    }

    [Fact]
    public async Task GetTeamMembers_ExcludesKickedAndLeftMembers()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db, name: "creator");
        var active = TestHelper.SeedMember(db, name: "active");
        var kicked = TestHelper.SeedMember(db, name: "kicked");
        var left = TestHelper.SeedMember(db, name: "left");

        var team = TestHelper.SeedTeam(db, creator.MemberId, "Team",
            extraMemberIds: new[] { active.MemberId, kicked.MemberId, left.MemberId });

        var kickedMembership = await db.Memberships.FirstAsync(m =>
            m.HabitTeamId == team.HabitTeamId && m.MemberId == kicked.MemberId);
        kickedMembership.Status = MembershipStatus.Kicked;

        var leftMembership = await db.Memberships.FirstAsync(m =>
            m.HabitTeamId == team.HabitTeamId && m.MemberId == left.MemberId);
        leftMembership.Status = MembershipStatus.Left;

        await db.SaveChangesAsync();

        TestHelper.SetAuthenticatedUser(controller, creator.MemberId);

        var result = await controller.GetTeamMembers(team.HabitTeamId);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var members = Assert.IsAssignableFrom<List<TeamMemberResponse>>(ok.Value);

        Assert.Equal(2, members.Count);
        Assert.Contains(members, m => m.MemberId == creator.MemberId);
        Assert.Contains(members, m => m.MemberId == active.MemberId);
        Assert.DoesNotContain(members, m => m.MemberId == kicked.MemberId);
        Assert.DoesNotContain(members, m => m.MemberId == left.MemberId);
    }


    [Fact]
    public async Task CreateTeam_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController(userId: null);

        var result = await controller.CreateTeam(new CreateTeamRequest { Name = "Ignored" });

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task CreateTeam_WhenCreatorNotInDb_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController(userId: Guid.NewGuid());

        var result = await controller.CreateTeam(new CreateTeamRequest { Name = "Ghost team" });

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task CreateTeam_PersistsTeamAndCreatorMembership()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db, name: "founder");
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.CreateTeam(new CreateTeamRequest { Name = "Founders" });

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var body = Assert.IsType<TeamResponse>(created.Value);

        Assert.Equal("Founders", body.Name);
        Assert.Equal(me.MemberId, body.CreatorId);

        var persisted = await db.HabitTeams
            .Include(t => t.Memberships)
            .FirstAsync(t => t.HabitTeamId == body.HabitTeamId);

        Assert.Single(persisted.Memberships);
        Assert.Equal(MembershipRole.Creator, persisted.Memberships.First().Role);
        Assert.Equal(MembershipStatus.Active, persisted.Memberships.First().Status);
    }


    [Fact]
    public async Task KickMember_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController(userId: null);

        var result = await controller.KickMember(Guid.NewGuid(), Guid.NewGuid());

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task KickMember_WhenKickingSelf_ReturnsConflict()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.KickMember(Guid.NewGuid(), me.MemberId);

        var conflict = Assert.IsType<ConflictObjectResult>(result.Result);
        Assert.Equal("cannot-kick-self", conflict.Value);
    }

    [Fact]
    public async Task KickMember_WhenTeamMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var victim = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.KickMember(Guid.NewGuid(), victim.MemberId);

        var notFound = Assert.IsType<NotFoundObjectResult>(result.Result);
        Assert.Equal("not-found", notFound.Value);
    }

    [Fact]
    public async Task KickMember_WhenCallerNotCreator_ReturnsForbid()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db, name: "creator");
        var member = TestHelper.SeedMember(db, name: "member");
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });

        TestHelper.SetAuthenticatedUser(controller, member.MemberId);

        var result = await controller.KickMember(team.HabitTeamId, creator.MemberId);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task KickMember_WhenVictimNotActiveMember_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var stranger = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        TestHelper.SetAuthenticatedUser(controller, creator.MemberId);

        var result = await controller.KickMember(team.HabitTeamId, stranger.MemberId);

        var notFound = Assert.IsType<NotFoundObjectResult>(result.Result);
        Assert.Equal("not-found", notFound.Value);
    }

    [Fact]
    public async Task KickMember_HappyPath_SetsStatusKicked()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var victim = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { victim.MemberId });
        TestHelper.SetAuthenticatedUser(controller, creator.MemberId);

        var result = await controller.KickMember(team.HabitTeamId, victim.MemberId);

        Assert.IsType<OkObjectResult>(result.Result);

        var membership = await db.Memberships.FirstAsync(m =>
            m.HabitTeamId == team.HabitTeamId &&
            m.MemberId == victim.MemberId);
        Assert.Equal(MembershipStatus.Kicked, membership.Status);
    }


    [Fact]
    public async Task LeaveTeam_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController(userId: null);

        var result = await controller.LeaveTeam(Guid.NewGuid());

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task LeaveTeam_WhenTeamMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.LeaveTeam(Guid.NewGuid());

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal("not-found", notFound.Value);
    }

    [Fact]
    public async Task LeaveTeam_WhenCallerIsCreator_ReturnsConflict()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.LeaveTeam(team.HabitTeamId);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal("creator-cannot-leave", conflict.Value);
    }

    [Fact]
    public async Task LeaveTeam_WhenCallerNotActiveMember_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var stranger = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        TestHelper.SetAuthenticatedUser(controller, stranger.MemberId);

        var result = await controller.LeaveTeam(team.HabitTeamId);

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal("not-found", notFound.Value);
    }

    [Fact]
    public async Task LeaveTeam_HappyPath_SetsStatusLeft()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });
        TestHelper.SetAuthenticatedUser(controller, member.MemberId);

        var result = await controller.LeaveTeam(team.HabitTeamId);

        Assert.IsType<OkObjectResult>(result);
        var membership = await db.Memberships.FirstAsync(m =>
            m.HabitTeamId == team.HabitTeamId &&
            m.MemberId == member.MemberId);
        Assert.Equal(MembershipStatus.Left, membership.Status);
    }


    [Fact]
    public async Task DeleteTeam_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController(userId: null);

        var result = await controller.DeleteTeam(Guid.NewGuid());

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task DeleteTeam_WhenTeamMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.DeleteTeam(Guid.NewGuid());

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal("not-found", notFound.Value);
    }

    [Fact]
    public async Task DeleteTeam_WhenCallerNotCreator_ReturnsForbid()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId });
        TestHelper.SetAuthenticatedUser(controller, member.MemberId);

        var result = await controller.DeleteTeam(team.HabitTeamId);

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task DeleteTeam_HappyPath_RemovesTeam()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.DeleteTeam(team.HabitTeamId);

        Assert.IsType<NoContentResult>(result);
        Assert.Null(await db.HabitTeams.FindAsync(team.HabitTeamId));
    }
}
