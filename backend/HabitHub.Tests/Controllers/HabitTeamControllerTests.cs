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

        var result = await controller.CreateTeam(new CreateTeamRequest { Name = "Runners" });

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var body = Assert.IsType<TeamResponse>(created.Value);
        Assert.Equal("Runners", body.Name);
        Assert.Equal(me.MemberId, body.CreatorId);
        Assert.Single(body.Members);

        var dbTeam = await db.HabitTeams
            .Include(t => t.Memberships)
            .Include(t => t.Chat)
            .FirstAsync(t => t.HabitTeamId == body.HabitTeamId);

        Assert.NotNull(dbTeam.Chat);
        Assert.Single(dbTeam.Memberships);
        Assert.Equal(MembershipRole.Creator, dbTeam.Memberships.First().Role);
        Assert.Equal(MembershipStatus.Active, dbTeam.Memberships.First().Status);
    }


    [Fact]
    public async Task GenerateInviteCode_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController(userId: null);

        var result = await controller.GenerateInviteCode(Guid.NewGuid());

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task GenerateInviteCode_WhenTeamMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.GenerateInviteCode(Guid.NewGuid());

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task GenerateInviteCode_WhenCallerNotCreator_ReturnsForbid()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db, name: "creator");
        var impostor = TestHelper.SeedMember(db, name: "impostor");
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { impostor.MemberId });
        TestHelper.SetAuthenticatedUser(controller, impostor.MemberId);

        var result = await controller.GenerateInviteCode(team.HabitTeamId);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task GenerateInviteCode_WhenCreator_ReturnsCreatedWithCodeAndExpiry()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var before = DateTime.UtcNow;
        var result = await controller.GenerateInviteCode(team.HabitTeamId);

        var status = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status201Created, status.StatusCode);
        var body = Assert.IsType<CodeResponse>(status.Value);

        Assert.Equal(team.HabitTeamId, body.HabitTeamId);
        Assert.False(string.IsNullOrWhiteSpace(body.Code));
        Assert.True(body.ExpiryDate > before.AddDays(9));
        Assert.True(body.ExpiryDate <= DateTime.UtcNow.AddDays(10).AddSeconds(1));
        Assert.Single(db.InviteCodes.Where(i => i.HabitTeamId == team.HabitTeamId));
    }


    [Fact]
    public async Task JoinTeam_WithoutAuth_ReturnsUnauthorized()
    {
        var (controller, _) = CreateController(userId: null);

        var result = await controller.JoinTeam(new JoinTeamRequest { Code = "ABC12345" });

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task JoinTeam_WithBlankCode_ReturnsBadRequest(string? code)
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.JoinTeam(new JoinTeamRequest { Code = code! });

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task JoinTeam_WhenMemberNotInDb_ReturnsUnauthorized()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        var invite = TestHelper.SeedInviteCode(db, team.HabitTeamId);

        TestHelper.SetAuthenticatedUser(controller, Guid.NewGuid());

        var result = await controller.JoinTeam(new JoinTeamRequest { Code = invite.Code });

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task JoinTeam_WhenCodeNotFound_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.JoinTeam(new JoinTeamRequest { Code = "DOESNOTEXIST" });

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task JoinTeam_WhenCodeExpiredByDate_MarksExpiredAndReturnsConflict()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var joiner = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        var invite = TestHelper.SeedInviteCode(
            db, team.HabitTeamId,
            expiryDate: DateTime.UtcNow.AddDays(-1),
            status: CodeState.Active);

        TestHelper.SetAuthenticatedUser(controller, joiner.MemberId);

        var result = await controller.JoinTeam(new JoinTeamRequest { Code = invite.Code });

        Assert.IsType<ConflictObjectResult>(result.Result);

        var refreshed = await db.InviteCodes.FindAsync(invite.InviteCodeId);
        Assert.Equal(CodeState.Expired, refreshed!.CodeStatus);
    }

    [Theory]
    [InlineData(CodeState.Invalid)]
    [InlineData(CodeState.Expired)]
    public async Task JoinTeam_WhenCodeStatusNotActive_ReturnsConflict(CodeState status)
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var joiner = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        var invite = TestHelper.SeedInviteCode(
            db, team.HabitTeamId,
            expiryDate: DateTime.UtcNow.AddDays(5), 
            status: status);

        TestHelper.SetAuthenticatedUser(controller, joiner.MemberId);

        var result = await controller.JoinTeam(new JoinTeamRequest { Code = invite.Code });

        Assert.IsType<ConflictObjectResult>(result.Result);
    }

    [Fact]
    public async Task JoinTeam_WhenAlreadyActiveMember_ReturnsConflict()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var joiner = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { joiner.MemberId });
        var invite = TestHelper.SeedInviteCode(db, team.HabitTeamId);

        TestHelper.SetAuthenticatedUser(controller, joiner.MemberId);

        var result = await controller.JoinTeam(new JoinTeamRequest { Code = invite.Code });

        Assert.IsType<ConflictObjectResult>(result.Result);
    }

    [Fact]
    public async Task JoinTeam_HappyPath_AddsMembershipAndReturnsTeam()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var joiner = TestHelper.SeedMember(db, name: "joiner");
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        var invite = TestHelper.SeedInviteCode(db, team.HabitTeamId);

        TestHelper.SetAuthenticatedUser(controller, joiner.MemberId);

        var result = await controller.JoinTeam(new JoinTeamRequest { Code = invite.Code });

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var body = Assert.IsType<TeamResponse>(ok.Value);

        Assert.Equal(team.HabitTeamId, body.HabitTeamId);
        Assert.Equal(2, body.Members.Count);
        Assert.Contains(body.Members, m => m.MemberId == joiner.MemberId && m.Role == MembershipRole.Member);
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
        var team = TestHelper.SeedTeam(db, me.MemberId);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.KickMember(team.HabitTeamId, me.MemberId);

        Assert.IsType<ConflictObjectResult>(result.Result);
    }

    [Fact]
    public async Task KickMember_WhenTeamMissing_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.KickMember(Guid.NewGuid(), Guid.NewGuid());

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task KickMember_WhenCallerNotCreator_ReturnsForbid()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var member = TestHelper.SeedMember(db);
        var victim = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { member.MemberId, victim.MemberId });

        TestHelper.SetAuthenticatedUser(controller, member.MemberId);

        var result = await controller.KickMember(team.HabitTeamId, victim.MemberId);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task KickMember_WhenVictimNotActiveMember_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        TestHelper.SetAuthenticatedUser(controller, creator.MemberId);

        var result = await controller.KickMember(team.HabitTeamId, Guid.NewGuid());

        Assert.IsType<NotFoundObjectResult>(result.Result);
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

        var kicked = await db.Memberships.FirstAsync(m =>
            m.HabitTeamId == team.HabitTeamId && m.MemberId == victim.MemberId);
        Assert.Equal(MembershipStatus.Kicked, kicked.Status);
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

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task LeaveTeam_WhenCallerIsCreator_ReturnsConflict()
    {
        var (controller, db) = CreateController();
        var me = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, me.MemberId);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.LeaveTeam(team.HabitTeamId);

        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public async Task LeaveTeam_WhenCallerNotActiveMember_ReturnsNotFound()
    {
        var (controller, db) = CreateController();
        var creator = TestHelper.SeedMember(db);
        var outsider = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        TestHelper.SetAuthenticatedUser(controller, outsider.MemberId);

        var result = await controller.LeaveTeam(team.HabitTeamId);

        Assert.IsType<NotFoundObjectResult>(result);
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

        var updated = await db.Memberships.FirstAsync(m =>
            m.HabitTeamId == team.HabitTeamId && m.MemberId == member.MemberId);
        Assert.Equal(MembershipStatus.Left, updated.Status);
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

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task DeleteTeam_WhenNotCreator_ReturnsForbid()
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
