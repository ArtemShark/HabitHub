using HabitHub.Api.Models;

namespace HabitHub.Api.Services;

public interface IJwtTokenService
{
    (string Token, DateTime ExpiresAtUtc) CreateToken(Member member, Guid sessionId);
}