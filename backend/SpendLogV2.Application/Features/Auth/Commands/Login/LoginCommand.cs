using MediatR;
using Microsoft.AspNetCore.Identity;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Application.Common.Models;
using SpendLogV2.Domain.Entities;

namespace SpendLogV2.Application.Features.Auth.Commands.Login;

public record LoginCommand(
    string Email,
    string Password,
    string? IpAddress = null,
    string? UserAgent = null) : IRequest<AuthResponse>;

public class LoginCommandHandler : IRequestHandler<LoginCommand, AuthResponse>
{
    private readonly UserManager<AppUser> _userManager;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly IAppDbContext _context;

    public LoginCommandHandler(
        UserManager<AppUser> userManager,
        IJwtTokenGenerator jwtTokenGenerator,
        IAppDbContext context)
    {
        _userManager = userManager;
        _jwtTokenGenerator = jwtTokenGenerator;
        _context = context;
    }

    public async Task<AuthResponse> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user == null)
        {
            _context.SecurityAuditLogs.Add(new SecurityAuditLog
            {
                Email = request.Email,
                Action = "Login_Failed",
                Success = false,
                FailureReason = "Kullanıcı bulunamadı",
                IpAddress = request.IpAddress,
                UserAgent = request.UserAgent
            });
            await _context.SaveChangesAsync(cancellationToken);

            return new AuthResponse { Success = false, Message = "Geçersiz e-posta veya şifre." };
        }

        // 1. Hesap Kilitli mi Kontrolü (Lockout)
        if (await _userManager.IsLockedOutAsync(user))
        {
            var remainingMinutes = user.LockoutEnd.HasValue
                ? Math.Max(1, (int)Math.Ceiling((user.LockoutEnd.Value - DateTimeOffset.UtcNow).TotalMinutes))
                : 15;

            _context.SecurityAuditLogs.Add(new SecurityAuditLog
            {
                UserId = user.Id,
                Email = user.Email ?? request.Email,
                Action = "Login_LockedOut",
                Success = false,
                FailureReason = $"Hesap kilitli. Kalan süre: {remainingMinutes} dk",
                IpAddress = request.IpAddress,
                UserAgent = request.UserAgent
            });
            await _context.SaveChangesAsync(cancellationToken);

            return new AuthResponse
            {
                Success = false,
                Message = $"Hesabınız 3 ardışık hatalı deneme nedeniyle kilitlenmiştir. Lütfen {remainingMinutes} dakika sonra tekrar deneyin."
            };
        }

        // 2. Şifre Doğrulama
        var isPasswordValid = await _userManager.CheckPasswordAsync(user, request.Password);
        if (!isPasswordValid)
        {
            // Başarısız deneme sayısını artır (3'e ulaşırsa hesap 15 dk kilitlenir)
            await _userManager.AccessFailedAsync(user);

            // Kilitlenme durumunu tekrar kontrol et
            if (await _userManager.IsLockedOutAsync(user))
            {
                _context.SecurityAuditLogs.Add(new SecurityAuditLog
                {
                    UserId = user.Id,
                    Email = user.Email ?? request.Email,
                    Action = "Login_LockedOut",
                    Success = false,
                    FailureReason = "3. ardışık hatalı deneme ile hesap kilitlendi (15 dk)",
                    IpAddress = request.IpAddress,
                    UserAgent = request.UserAgent
                });
                await _context.SaveChangesAsync(cancellationToken);

                return new AuthResponse
                {
                    Success = false,
                    Message = "Hesabınız 3 ardışık hatalı deneme nedeniyle 15 dakika süreyle kilitlenmiştir."
                };
            }

            var failedCount = await _userManager.GetAccessFailedCountAsync(user);
            var remainingAttempts = Math.Max(0, 3 - failedCount);

            _context.SecurityAuditLogs.Add(new SecurityAuditLog
            {
                UserId = user.Id,
                Email = user.Email ?? request.Email,
                Action = "Login_Failed",
                Success = false,
                FailureReason = $"Hatalı şifre. Kalan hak: {remainingAttempts}",
                IpAddress = request.IpAddress,
                UserAgent = request.UserAgent
            });
            await _context.SaveChangesAsync(cancellationToken);

            return new AuthResponse
            {
                Success = false,
                Message = $"Geçersiz e-posta veya şifre. Kalan deneme hakkı: {remainingAttempts}."
            };
        }

        // 3. Başarılı Giriş — Başarısız sayacı sıfırla
        await _userManager.ResetAccessFailedCountAsync(user);

        var roles = await _userManager.GetRolesAsync(user);
        var accessToken = _jwtTokenGenerator.GenerateAccessToken(user, roles);
        var refreshToken = _jwtTokenGenerator.GenerateRefreshToken();

        user.PreviousRefreshToken = user.RefreshToken;
        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await _userManager.UpdateAsync(user);

        _context.SecurityAuditLogs.Add(new SecurityAuditLog
        {
            UserId = user.Id,
            Email = user.Email ?? request.Email,
            Action = "Login_Success",
            Success = true,
            IpAddress = request.IpAddress,
            UserAgent = request.UserAgent
        });
        await _context.SaveChangesAsync(cancellationToken);

        return new AuthResponse
        {
            Success = true,
            Message = "Giriş başarılı.",
            AccessToken = accessToken,
            RefreshToken = refreshToken,
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
