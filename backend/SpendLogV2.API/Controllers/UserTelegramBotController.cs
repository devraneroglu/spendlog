using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Infrastructure.Data;
using Telegram.Bot;
using Telegram.Bot.Exceptions;

namespace SpendLogV2.API.Controllers;

[ApiController]
[Route("api/telegram/my-bot")]
[Authorize]
public class UserTelegramBotController : ControllerBase
{
    private readonly SpendLogDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<UserTelegramBotController> _logger;

    public UserTelegramBotController(
        SpendLogDbContext context,
        ICurrentUserService currentUserService,
        IConfiguration configuration,
        ILogger<UserTelegramBotController> logger)
    {
        _context = context;
        _currentUserService = currentUserService;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetMyBotStatus(CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
            return NotFound();

        var hasCustomBot = !string.IsNullOrWhiteSpace(user.CustomTelegramBotToken);

        return Ok(new
        {
            hasCustomBot,
            customBotUsername = user.CustomTelegramBotUsername,
            webhookConfigured = !string.IsNullOrWhiteSpace(user.TelegramWebhookSecret),
            chatId = user.TelegramChatId,
            isTelegramActive = user.IsTelegramActive,
            sharedBotUsername = _configuration["Telegram:SharedBotUsername"] ?? "SpendLog_Bot"
        });
    }

    [HttpPost("connect")]
    public async Task<IActionResult> ConnectCustomBot([FromBody] ConnectBotRequest request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.BotToken))
            return BadRequest(new { message = "Bot token alanı zorunludur." });

        var trimmedToken = request.BotToken.Trim();

        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
            return NotFound();

        // 1. Telegram API üzerinden Bot Token Doğrulama
        string botUsername;
        ITelegramBotClient botClient;
        try
        {
            botClient = new TelegramBotClient(trimmedToken);
            var botInfo = await botClient.GetMe(cancellationToken);
            botUsername = botInfo.Username ?? "Özel Bot";
        }
        catch (ApiRequestException apiEx)
        {
            _logger.LogWarning("Geçersiz Telegram bot token girildi: {Message}", apiEx.Message);
            return BadRequest(new { message = $"Telegram API Hatası: Bot token doğrulanamadı ({apiEx.Message}). BotFather'dan aldığınız token'ı kontrol edin." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Bot token test edilirken beklenmeyen hata.");
            return BadRequest(new { message = "Bot token doğrulanırken bir hata oluştu. Lütfen bağlantınızı kontrol edin." });
        }

        // 2. Webhook Secret Üretimi ve Webhook Kaydı
        var secret = Guid.NewGuid().ToString("N");
        var webhookBaseUrl = _configuration["Telegram:WebhookBaseUrl"];
        if (string.IsNullOrWhiteSpace(webhookBaseUrl))
        {
            webhookBaseUrl = $"{Request.Scheme}://{Request.Host}";
        }

        var webhookUrl = $"{webhookBaseUrl.TrimEnd('/')}/api/telegram/webhook/{secret}";
        bool webhookRegistered = false;
        string? webhookWarning = null;

        try
        {
            // Telegram yalnızca geçerli HTTPS URL'lerini webhook olarak kabul eder
            if (webhookUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                await botClient.SetWebhook(url: webhookUrl, cancellationToken: cancellationToken);
                webhookRegistered = true;
            }
            else
            {
                webhookWarning = "Bot başarıyla doğrulandı! Yerel geliştirme ortamında (HTTP) Telegram Webhook desteği için Ngrok veya Cloudflare Tunnel gibi bir HTTPS tüneli gereklidir. Canlı ortamda (HTTPS) webhook tam otomatik olarak devreye girecektir.";
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Webhook kaydedilemedi (Geliştirme ortamı olabilir): {Message}", ex.Message);
            webhookWarning = $"Bot token doğrulandı ancak Telegram Webhook ayarlanamadı: {ex.Message}";
        }

        // 3. Kullanıcı Profilini Güncelle
        user.CustomTelegramBotToken = trimmedToken;
        user.CustomTelegramBotUsername = botUsername;
        user.TelegramWebhookSecret = secret;

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            success = true,
            message = $"@{botUsername} botu başarıyla SpendLog hesabınıza bağlandı!",
            botUsername,
            webhookRegistered,
            webhookWarning,
            webhookUrl
        });
    }

    [HttpPost("disconnect")]
    public async Task<IActionResult> DisconnectCustomBot(CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
            return NotFound();

        // Eğer mevcut bir bot token varsa Telegram sunucularından webhook'u temizle
        if (!string.IsNullOrWhiteSpace(user.CustomTelegramBotToken))
        {
            try
            {
                var botClient = new TelegramBotClient(user.CustomTelegramBotToken);
                await botClient.DeleteWebhook(cancellationToken: cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Webhook silinirken uyarı alındı.");
            }
        }

        user.CustomTelegramBotToken = null;
        user.CustomTelegramBotUsername = null;
        user.TelegramWebhookSecret = null;

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            success = true,
            message = "Özel bot bağlantısı kaldırıldı. Sistem varsayılan ortak bot moduna geçirildi."
        });
    }

    [HttpPost("chat-id")]
    public async Task<IActionResult> UpdateChatId([FromBody] UpdateChatIdRequest request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
            return NotFound();

        user.TelegramChatId = request.ChatId;
        user.IsTelegramActive = request.ChatId.HasValue && request.ChatId.Value > 0;
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new { success = true, chatId = user.TelegramChatId, isTelegramActive = user.IsTelegramActive });
    }
}

public record ConnectBotRequest(string BotToken);
public record UpdateChatIdRequest(long? ChatId);
