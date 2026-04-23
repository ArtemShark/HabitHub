using HabitHub.Api.Contracts.Team;
using HabitHub.Api.Controllers;
using HabitHub.Api.Data;
using HabitHub.Api.Enums;
using HabitHub.Tests.Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HabitHub.Api.Models;

public class TeamInviteCodesControllerTests
{
    [Fact]
    public async Task GenerateInviteCode_WithoutAuth_ReturnsUnauthorized()
    {
        var db = TestHelper.CreateInMemoryDbContext();

        var controller = new GenerateCodeController(db);
        TestHelper.SetUnauthenticatedUser(controller);

        var result = await controller.GenerateInviteCode(Guid.NewGuid());

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task GenerateInviteCode_WhenTeamMissing_ReturnsNotFound()
    {
        var db = TestHelper.CreateInMemoryDbContext();

        var controller = new GenerateCodeController(db);        
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.GenerateInviteCode(Guid.NewGuid());

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task GenerateInviteCode_WhenCallerNotCreator_ReturnsForbid()
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var creator = TestHelper.SeedMember(db, name: "creator");
        var impostor = TestHelper.SeedMember(db, name: "impostor");
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { impostor.MemberId });

        var controller = new GenerateCodeController(db);
        TestHelper.SetAuthenticatedUser(controller, impostor.MemberId);

        var result = await controller.GenerateInviteCode(team.HabitTeamId);

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task GenerateInviteCode_WhenCreator_ReturnsCreatedWithCodeAndPersistsInvite()
    {
        var db = TestHelper.CreateInMemoryDbContext();

        var controller = new GenerateCodeController(db);
        var creator = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);

        TestHelper.SetAuthenticatedUser(controller, creator.MemberId);

        var before = DateTime.UtcNow;
        var result = await controller.GenerateInviteCode(team.HabitTeamId);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var body = Assert.IsType<CodeResponse>(created.Value);

        Assert.Equal(team.HabitTeamId, body.HabitTeamId);
        Assert.False(string.IsNullOrWhiteSpace(body.Code));
        Assert.Equal(8, body.Code.Length);
        Assert.True(body.ExpiryDate > before.AddDays(9));
        Assert.True(body.ExpiryDate <= DateTime.UtcNow.AddDays(10).AddSeconds(1));

        var saved = await db.InviteCodes.SingleAsync(i => i.HabitTeamId == team.HabitTeamId);
        Assert.Equal(body.Code, saved.Code);
        Assert.Equal(CodeState.Active, saved.CodeStatus);
        Assert.Equal(team.HabitTeamId, saved.HabitTeamId);
    }

    [Fact]
    public async Task GenerateInviteCode_WhenCalledTwice_GeneratesDifferentCodes()
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var creator = TestHelper.SeedMember(db);
        var team = TestHelper.SeedTeam(db, creator.MemberId);

        var controller = new GenerateCodeController(db);
        TestHelper.SetAuthenticatedUser(controller, creator.MemberId);

        var result1 = await controller.GenerateInviteCode(team.HabitTeamId);
        var result2 = await controller.GenerateInviteCode(team.HabitTeamId);

        var created1 = Assert.IsType<CreatedAtActionResult>(result1);
        var created2 = Assert.IsType<CreatedAtActionResult>(result2);

        var body1 = Assert.IsType<CodeResponse>(created1.Value);
        var body2 = Assert.IsType<CodeResponse>(created2.Value);

        Assert.NotEqual(body1.Code, body2.Code);
        Assert.Equal(2, await db.InviteCodes.CountAsync(i => i.HabitTeamId == team.HabitTeamId));
    }

    [Fact]
    public async Task JoinTeam_WithoutAuth_ReturnsUnauthorized()
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var controller = new GenerateCodeController(db);
        TestHelper.SetUnauthenticatedUser(controller);

        var result = await controller.JoinTeam(new JoinTeamRequest { Code = "ABC12345" });

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task JoinTeam_WithInvalidModelState_ReturnsBadRequest()
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var controller = new GenerateCodeController(db);
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        controller.ModelState.AddModelError("Code", "The Code field is required.");

        var result = await controller.JoinTeam(new JoinTeamRequest { Code = "" });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task JoinTeam_WhenCodeNotFound_ReturnsNotFound()
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var controller = new GenerateCodeController(db);
        var me = TestHelper.SeedMember(db);
        TestHelper.SetAuthenticatedUser(controller, me.MemberId);

        var result = await controller.JoinTeam(new JoinTeamRequest { Code = "DOESNOTEXIST" });

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task JoinTeam_WhenCodeIsInvalid_ReturnsConflict()
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var controller = new GenerateCodeController(db);
        var creator = TestHelper.SeedMember(db, name: "creator");
        var joiner = TestHelper.SeedMember(db, name: "joiner");
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        var invite = TestHelper.SeedInviteCode(
            db,
            team.HabitTeamId,
            expiryDate: DateTime.UtcNow.AddDays(5),
            status: CodeState.Invalid);

        TestHelper.SetAuthenticatedUser(controller, joiner.MemberId);

        var result = await controller.JoinTeam(new JoinTeamRequest { Code = invite.Code });

        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public async Task JoinTeam_WhenCodeAlreadyExpired_ReturnsConflict()
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var controller = new GenerateCodeController(db);
        var creator = TestHelper.SeedMember(db, name: "creator");
        var joiner = TestHelper.SeedMember(db, name: "joiner");
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        var invite = TestHelper.SeedInviteCode(
            db,
            team.HabitTeamId,
            expiryDate: DateTime.UtcNow.AddDays(5),
            status: CodeState.Expired);

        TestHelper.SetAuthenticatedUser(controller, joiner.MemberId);

        var result = await controller.JoinTeam(new JoinTeamRequest { Code = invite.Code });

        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public async Task JoinTeam_WhenCodeExpiredByDate_MarksExpiredAndReturnsConflict()
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var controller = new GenerateCodeController(db);
        var creator = TestHelper.SeedMember(db, name: "creator");
        var joiner = TestHelper.SeedMember(db, name: "joiner");
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        var invite = TestHelper.SeedInviteCode(
            db,
            team.HabitTeamId,
            expiryDate: DateTime.UtcNow.AddDays(-1),
            status: CodeState.Active);

        TestHelper.SetAuthenticatedUser(controller, joiner.MemberId);

        var result = await controller.JoinTeam(new JoinTeamRequest { Code = invite.Code });

        Assert.IsType<ConflictObjectResult>(result);

        var refreshed = await db.InviteCodes.FindAsync(invite.InviteCodeId);
        Assert.NotNull(refreshed);
        Assert.Equal(CodeState.Expired, refreshed!.CodeStatus);
    }

    [Fact]
    public async Task JoinTeam_WhenTeamForInviteDoesNotExist_ReturnsNotFound()
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var controller = new GenerateCodeController(db);
        var joiner = TestHelper.SeedMember(db, name: "joiner");

        var orphanInvite = new InviteCode
        {
            InviteCodeId = Guid.NewGuid(),
            Code = "ORPHAN01",
            HabitTeamId = Guid.NewGuid(),
            ExpiryDate = DateTime.UtcNow.AddDays(5),
            CodeStatus = CodeState.Active
        };

        db.InviteCodes.Add(orphanInvite);
        await db.SaveChangesAsync();

        TestHelper.SetAuthenticatedUser(controller, joiner.MemberId);

        var result = await controller.JoinTeam(new JoinTeamRequest { Code = orphanInvite.Code });

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task JoinTeam_WhenAlreadyActiveMember_ReturnsConflict()
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var controller = new GenerateCodeController(db);
        var creator = TestHelper.SeedMember(db, name: "creator");
        var joiner = TestHelper.SeedMember(db, name: "joiner");
        var team = TestHelper.SeedTeam(db, creator.MemberId, extraMemberIds: new[] { joiner.MemberId });
        var invite = TestHelper.SeedInviteCode(db, team.HabitTeamId);

        TestHelper.SetAuthenticatedUser(controller, joiner.MemberId);

        var result = await controller.JoinTeam(new JoinTeamRequest { Code = invite.Code });

        Assert.IsType<ConflictObjectResult>(result);

        var memberships = await db.Memberships
            .Where(m => m.MemberId == joiner.MemberId && m.HabitTeamId == team.HabitTeamId)
            .ToListAsync();

        Assert.Single(memberships);
    }

    [Fact]
    public async Task JoinTeam_WhenPreviousMembershipWasLeft_CreatesNewActiveMembership()
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var controller = new GenerateCodeController(db);
        var creator = TestHelper.SeedMember(db, name: "creator");
        var joiner = TestHelper.SeedMember(db, name: "joiner");
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        var invite = TestHelper.SeedInviteCode(db, team.HabitTeamId);

        db.Memberships.Add(new Membership
        {
            MembershipId = Guid.NewGuid(),
            MemberId = joiner.MemberId,
            HabitTeamId = team.HabitTeamId,
            Status = MembershipStatus.Left,
            Role = MembershipRole.Member
        });
        await db.SaveChangesAsync();

        TestHelper.SetAuthenticatedUser(controller, joiner.MemberId);

        var result = await controller.JoinTeam(new JoinTeamRequest { Code = invite.Code });

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(ok.Value);

        var activeMemberships = await db.Memberships
            .Where(m => m.MemberId == joiner.MemberId &&
                        m.HabitTeamId == team.HabitTeamId &&
                        m.Status == MembershipStatus.Active)
            .ToListAsync();

        Assert.Single(activeMemberships);
        Assert.Equal(MembershipRole.Member, activeMemberships[0].Role);
    }

    [Fact]
    public async Task JoinTeam_HappyPath_AddsMembershipAndKeepsInviteCodeActive()
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var controller = new GenerateCodeController(db);
        var creator = TestHelper.SeedMember(db, name: "creator");
        var joiner = TestHelper.SeedMember(db, name: "joiner");
        var team = TestHelper.SeedTeam(db, creator.MemberId);
        var invite = TestHelper.SeedInviteCode(
            db,
            team.HabitTeamId,
            expiryDate: DateTime.UtcNow.AddDays(5),
            status: CodeState.Active);

        TestHelper.SetAuthenticatedUser(controller, joiner.MemberId);

        var result = await controller.JoinTeam(new JoinTeamRequest { Code = invite.Code });

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(ok.Value);

        var membership = await db.Memberships.SingleAsync(m =>
            m.MemberId == joiner.MemberId &&
            m.HabitTeamId == team.HabitTeamId);

        Assert.Equal(MembershipStatus.Active, membership.Status);
        Assert.Equal(MembershipRole.Member, membership.Role);

        var refreshedInvite = await db.InviteCodes.FindAsync(invite.InviteCodeId);
        Assert.NotNull(refreshedInvite);
        Assert.Equal(CodeState.Active, refreshedInvite!.CodeStatus);
    }
}