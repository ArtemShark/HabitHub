using HabitHub.Api.Data;
using HabitHub.Api.Models;
using HabitHub.Api.Services;
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
}