using MediatR;
using Microsoft.AspNetCore.Identity;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Application.Common.Models;
using SpendLogV2.Application.Features.Categories;
using SpendLogV2.Domain.Entities;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Application.Features.Auth.Commands.Register;

public record RegisterCommand(string Email, string Password, string FullName) : IRequest<AuthResponse>;

public class RegisterCommandHandler : IRequestHandler<RegisterCommand, AuthResponse>
{
    private readonly UserManager<AppUser> _userManager;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly IAppDbContext _context;
    private readonly IMediator _mediator;

    public RegisterCommandHandler(
        UserManager<AppUser> userManager,
        IJwtTokenGenerator jwtTokenGenerator,
        IAppDbContext context,
        IMediator mediator)
    {
        _userManager = userManager;
        _jwtTokenGenerator = jwtTokenGenerator;
        _context = context;
        _mediator = mediator;
    }

    public async Task<AuthResponse> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        var existingUser = await _userManager.FindByEmailAsync(request.Email);
        if (existingUser != null)
        {
            return new AuthResponse { Success = false, Message = "Bu e-posta adresi zaten kullanılıyor." };
        }

        var user = new AppUser
        {
            UserName = request.Email,
            Email = request.Email,
            FullName = request.FullName,
            CreatedAt = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return new AuthResponse { Success = false, Message = $"Kayıt başarısız: {errors}" };
        }

        // Yeni kullanıcıya varsayılan "User" rolünü ata
        await _userManager.AddToRoleAsync(user, "User");

        // Onboarding: Yeni kullanıcı için varsayılan hesap, Telegram kuralları ve kategoriler
        try
        {
            // 1. Varsayılan Hesap: Nakit Cüzdan
            var defaultAccount = new Account
            {
                Name = "Nakit Cüzdan",
                AccountType = AccountType.Cash,
                Currency = Currency.TRY,
                InitialBalance = 0,
                CurrentBalance = 0,
                Color = "#10b981",
                Icon = "banknote",
                Description = "Varsayılan Nakit Cüzdan",
                UserId = user.Id,
                IsActive = true
            };
            _context.Accounts.Add(defaultAccount);

            // 2. Varsayılan Telegram Kuralları (4 Adet Temel Kural)
            var defaultRules = new List<TelegramRule>
            {
                new()
                {
                    Command = "bakiye",
                    Title = "Bakiye Sorgulama",
                    Description = "Tüm hesapların güncel bakiyelerini listeler.",
                    Pattern = "^/bakiye$",
                    ActionType = "GetBalance",
                    ResponseTemplate = "💰 *Hesap Bakiyeleriniz:*\n{hesap_listesi}\n*Toplam Varlık:* {toplam_varlik} ₺",
                    UserId = user.Id
                },
                new()
                {
                    Command = "harcama",
                    Title = "Harcama Ekleme",
                    Description = "Hızlı harcama kaydeder (Örn: /harcama 250 Yemek Kahve)",
                    Pattern = @"^/harcama\s+(\d+(?:[.,]\d+)?)\s+(\S+)(?:\s+(.*))?$",
                    ActionType = "CreateTransaction",
                    ResponseTemplate = "✅ *Harcama Kaydedildi!*\nTutar: {tutar} ₺\nKategori: {kategori}\nAçıklama: {aciklama}\nHesap: {hesap}",
                    UserId = user.Id
                },
                new()
                {
                    Command = "kk",
                    Title = "Kredi Kartı Canlı Harcama (Ön-Ekstre)",
                    Description = "Sıradaki ekstre dönemine harcama notu ekler (Örn: /kk 546 çocuklar ile kahve)",
                    Pattern = @"^/(kk|kart)\s+(\d+(?:[.,]\d+)?)(?:\s+(.*))?$",
                    ActionType = "CreateCreditCardExpense",
                    ResponseTemplate = "💳 *Kredi Kartı Harcaması İşlendi!*\nTutar: -{tutar} ₺\nNot: {not}\nDönem: {donem}",
                    UserId = user.Id
                },
                new()
                {
                    Command = "durum",
                    Title = "Sistem ve Sunucu Durumu (Health Check)",
                    Description = "Uptime süresi, DB ping gecikmesi ve servis durumlarını listeler.",
                    Pattern = "^/(durum|ping|health|sistem)$",
                    ActionType = "GetSystemStatus",
                    ResponseTemplate = "🖥️ *SpendLog V2 Sistem Durumu:*\nUptime: {uptime}\nDB Ping: {ping} ms",
                    UserId = user.Id
                },
                new()
                {
                    Command = "rapor",
                    Title = "Aylık Harcama Grafiği & PDF Dökümü",
                    Description = "Belirtilen ayın (Örn: 2026-8 veya /rapor 2026-8) kategori harcama grafiğini (PNG) ve detaylı PDF dökümünü üretir.",
                    Pattern = @"^(?:/rapor\s+)?(\d{4}-(?:1[0-2]|0[1-9]|[1-9]))$",
                    ActionType = "MonthlyReport",
                    ResponseTemplate = "📊 Aylık harcama dağılım grafiği ve PDF dökümü hazırlanıyor...",
                    SendType = "ChartAndPdf",
                    ScheduleType = "Manual",
                    UserId = user.Id
                },
                new()
                {
                    Command = "EVENT_PRICE_ALERT",
                    Title = "Fiyat Alarmı Bildirimi",
                    Description = "Varlık hedef fiyata ulaştığında veya altına düştüğünde iletilen dinamik Telegram alarm şablonu.",
                    Pattern = "EVENT_PRICE_ALERT",
                    ActionType = "PriceAlert",
                    ResponseTemplate = "🚨 *SPENDLOG FİYAT ALARMI TETİKLENDİ!*\n\n🪙 *Varlık:* `{Symbol}` ({Name})\n🎯 *Hedef:* `{TargetPrice} {Currency}` ({Condition})\n📈 *Anlık Fiyat:* `{CurrentPrice} {Currency}`\n📝 *Not:* _{Note}_\n⏰ *Zaman:* {Time}",
                    SendType = "Text",
                    ScheduleType = "Manual",
                    IsActive = true,
                    UserId = user.Id
                }
            };
            _context.TelegramRules.AddRange(defaultRules);

            await _context.SaveChangesAsync(cancellationToken);

            // 3. Varsayılan Kategoriler (8 Ana, 38 Alt Kategori)
            await _mediator.Send(new SeedDefaultCategoriesCommand(OverwriteExisting: false, TargetUserId: user.Id), cancellationToken);
        }
        catch
        {
            // Onboarding işlemlerindeki olası istisna kayıt işlemini iptal etmemeli
        }

        var roles = await _userManager.GetRolesAsync(user);
        var accessToken = _jwtTokenGenerator.GenerateAccessToken(user, roles);
        var refreshToken = _jwtTokenGenerator.GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await _userManager.UpdateAsync(user);

        _context.SecurityAuditLogs.Add(new SecurityAuditLog
        {
            UserId = user.Id,
            Email = user.Email ?? request.Email,
            Action = "Register_Success",
            Success = true,
            Timestamp = DateTime.UtcNow
        });
        await _context.SaveChangesAsync(cancellationToken);

        return new AuthResponse
        {
            Success = true,
            Message = "Kullanıcı başarıyla oluşturuldu.",
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
