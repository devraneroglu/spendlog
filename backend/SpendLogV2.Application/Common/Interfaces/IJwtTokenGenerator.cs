using SpendLogV2.Domain.Entities;

namespace SpendLogV2.Application.Common.Interfaces;

public interface IJwtTokenGenerator
{
    string GenerateAccessToken(AppUser user, IList<string> roles);
    string GenerateRefreshToken();
}
