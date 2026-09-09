using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Application.Common.Models;
using SpendLogV2.Domain.Entities;

namespace SpendLogV2.Application.Features.Auth.Commands.RefreshToken;

public record RefreshTokenCommand(
    string AccessToken,
    string RefreshToken,
    string? IpAddress = null,
    string? UserAgent = null) : IRequest<AuthResponse>;

public class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, AuthResponse>
{
    private readonly UserManager<AppUser> _userManager;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly IAppDbContext _context;

    public RefreshTokenCommandHandler(
        UserManager<AppUser> userManager,
        IJwtTokenGenerator jwtTokenGenerator,
        IAppDbContext context)
    {
        _userManager = userManager;
        _jwtTokenGenerator = jwtTokenGenerator;
        _context = context;
    }

    public async Task<AuthResponse> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return new AuthResponse { Success = false, Message = "Yenileme belirteci (refresh token) bulunamadı." };
        }

        // 1. Doğrudan SQL üzerinde O(1) indeksli sorgu (Users.ToList bellek sızıntısı giderildi)
        var user = await _userManager.Users
            .SingleOrDefaultAsync(u => u.RefreshToken == request.RefreshToken, cancellationToken);

        // 2. Token Reuse Detection (Çalınma & Tekrar Kullanım Tespiti)
        if (user == null)
        {
            var compromisedUser = await _userManager.Users
                .SingleOrDefaultAsync(u => u.PreviousRefreshToken == request.RefreshToken, cancellationToken);

            if (compromisedUser != null)
            {
                // Kritik Güvenlik Olayı: Eski bir token tekrar sunuluyor (Token çalınması şüphesi!)
                // Kullanıcının tüm oturumlarını anında iptal et
                compromisedUser.RefreshToken = null;
                compromisedUser.PreviousRefreshToken = null;
                compromisedUser.RefreshTokenExpiryTime = null;
                await _userManager.UpdateSecurityStampAsync(compromisedUser);
                await _userManager.UpdateAsync(compromisedUser);

                _context.SecurityAuditLogs.Add(new SecurityAuditLog
                {
                    UserId = compromisedUser.Id,
                    Email = compromisedUser.Email ?? "",
                    Action = "Token_Reused_Revoked_Compromised",
                    Success = false,
                    FailureReason = "Daha önce kullanılmış refresh token tekrar sunuldu. Tüm oturumlar güvenlik gereği sonlandırıldı.",
                    IpAddress = request.IpAddress,
                    UserAgent = request.UserAgent
                });
                await _context.SaveChangesAsync(cancellationToken);

                return new AuthResponse
                {
                    Success = false,
                    Message = "Güvenlik Uyarısı: Bu oturum anahtarı daha önce kullanılmıştır. Hesabınızın güvenliği için tüm açık oturumlar sonlandırıldı. Lütfen yeniden giriş yapın."
                };
            }

            return new AuthResponse { Success = false, Message = "Geçersiz veya süresi dolmuş refresh token." };
        }

        if (user.RefreshTokenExpiryTime <= DateTime.UtcNow)
        {
            return new AuthResponse { Success = false, Message = "Refresh token süresi dolmuş. Lütfen tekrar giriş yapın." };
        }

        // 3. Token Rotation (Yeni Access ve Refresh Token üretimi)
        var roles = await _userManager.GetRolesAsync(user);
        var newAccessToken = _jwtTokenGenerator.GenerateAccessToken(user, roles);
        var newRefreshToken = _jwtTokenGenerator.GenerateRefreshToken();

        // Eski token'ı PreviousRefreshToken'a aktar, yeniyi ata
        user.PreviousRefreshToken = user.RefreshToken;
        user.RefreshToken = newRefreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await _userManager.UpdateAsync(user);

        _context.SecurityAuditLogs.Add(new SecurityAuditLog
        {
            UserId = user.Id,
            Email = user.Email ?? "",
            Action = "Token_Refreshed",
            Success = true,
            IpAddress = request.IpAddress,
            UserAgent = request.UserAgent
        });
        await _context.SaveChangesAsync(cancellationToken);

        return new AuthResponse
        {
            Success = true,
            Message = "Token başarıyla yenilendi.",
            AccessToken = newAccessToken,
            RefreshToken = newRefreshToken,
            Expiration = DateTime.UtcNow.AddMinutes(15),
            User = new UserDto
            {
                Id = user.Id,
                Email = user.Email ?? "",
                FullName = user.FullName,
                TelegramChatId = user.TelegramChatId,
                IsTelegramActive = user.IsTelegramActive,
                Roles = roles.ToList(),
                IsAdmin = roles.Contains("Admin"),
                HasCustomTelegramBot = !string.IsNullOrEmpty(user.CustomTelegramBotToken),
                CustomTelegramBotUsername = user.CustomTelegramBotUsername
            }
        };
    }
}
