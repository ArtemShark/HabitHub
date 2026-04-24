using HabitHub.Api.Controllers;
using HabitHub.Api.Contracts.Member;
using HabitHub.Api.Data;
using HabitHub.Tests.Helpers;
using Microsoft.AspNetCore.Mvc;

namespace HabitHub.Tests.Controllers;

public class MembersControllerTests
{
    private static (MembersController controller, AppDbContext db) CreateController()
    {
        var db = TestHelper.CreateInMemoryDbContext();
        var controller = new MembersController(db);
        return (controller, db);
    }

    [Theory]
    [InlineData("")]
    [InlineData("bad-id")]
    [InlineData("bad-id,another-bad-id")]
    [InlineData(",,")]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    public async Task GetBasicMembers_WithNoValidIds_ReturnsEmptyList(string ids)
    {
        var (controller, _) = CreateController();

        var result = await controller.GetBasicMembers(ids);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var members = Assert.IsAssignableFrom<List<MemberInfoResponse>>(ok.Value);
        Assert.Empty(members);
    }

    [Fact]
    public async Task GetBasicMembers_IgnoresInvalidIdsAndDeduplicates()
    {
        var (controller, db) = CreateController();
        var a = TestHelper.SeedMember(db, name: "Alice");
        var b = TestHelper.SeedMember(db, name: "Bob");

        var ids = $"{a.MemberId},not-a-guid,{a.MemberId},{b.MemberId},,00000000-0000-0000-0000-000000000000";

        var result = await controller.GetBasicMembers(ids);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var members = Assert.IsAssignableFrom<List<MemberInfoResponse>>(ok.Value);
        Assert.Equal(2, members.Count);
        Assert.Contains(members, m => m.MemberId == a.MemberId && m.Name == "Alice");
        Assert.Contains(members, m => m.MemberId == b.MemberId && m.Name == "Bob");
    }
}