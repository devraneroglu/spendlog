using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Infrastructure.Data;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;

namespace SpendLogV2.Infrastructure.Services;

public class TelegramAlertService : ITelegramAlertService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TelegramAlertService> _logger;
    private readonly ITelegramBotClient? _botClient;
    private static readonly ConcurrentDictionary<string, DateTime> _lastAlertTimes = new();
    private static readonly TimeSpan _alertThrottleDuration = TimeSpan.FromMinutes(5);

    public TelegramAlertService(IServiceProvider serviceProvider, IConfiguration configuration, ILogger<TelegramAlertService> logger)
    {
        _serviceProvider = serviceProvider;
        _configuration = configuration;
        _logger = logger;

        var botToken = _configuration["Telegram:BotToken"];
        if (!string.IsNullOrWhiteSpace(botToken) && !botToken.Contains("YOUR_TELEGRAM_BOT_TOKEN"))
        {
            _botClient = new TelegramBotClient(botToken);
        }
    }

    public async Task SendCriticalAlertAsync(string source, string errorMessage, string? traceId = null, Exception? exception = null)
    {
        if (_botClient == null) return;

        // Anti-Spam / Throttling: Aynı hata için 5 dakika içinde tekrar mesaj atma
        var alertKey = $"{source}:{errorMessage}";
        if (_lastAlertTimes.TryGetValue(alertKey, out var lastSent) && (DateTime.UtcNow - lastSent) < _alertThrottleDuration)
        {
            _logger.LogInformation("Telegram alarmı throttled (Son 5 dk içinde zaten iletildi): {Source}", source);
            return;
        }

        _lastAlertTimes[alertKey] = DateTime.UtcNow;

        var traceStr = string.IsNullOrWhiteSpace(traceId) ? $"SL-{Guid.NewGuid().ToString()[..8].ToUpper()}" : traceId;
        var exceptionDetails = exception != null ? $"\n\n*Hata Detayı:* `{exception.GetType().Name}: {exception.Message[..Math.Min(150, exception.Message.Length)]}`" : "";

        var alertMsg = $"🚨 *[KRİTİK SİSTEM ALARMI]*\n\n" +
                       $"• *Kaynak:* `{source}`\n" +
                       $"• *Zaman:* `{DateTime.Now:dd.MM.yyyy HH:mm:ss}`\n" +
                       $"• *Hata:* `{errorMessage}`\n" +
                       $"• *Takip Kodu (TraceId):* `{traceStr}`" +
                       $"{exceptionDetails}\n\n" +
                       $"⚠️ _Lütfen sunucu loglarını ve veritabanı durumunu kontrol ediniz._";

        await BroadcastToActiveUsersAsync(alertMsg);
    }

    public async Task SendWarningAlertAsync(string source, string message, string? traceId = null)
    {
        if (_botClient == null) return;

        var alertKey = $"WARN:{source}:{message}";
        if (_lastAlertTimes.TryGetValue(alertKey, out var lastSent) && (DateTime.UtcNow - lastSent) < _alertThrottleDuration)
        {
            return;
        }

        _lastAlertTimes[alertKey] = DateTime.UtcNow;

        var traceStr = string.IsNullOrWhiteSpace(traceId) ? $"SL-{Guid.NewGuid().ToString()[..8].ToUpper()}" : traceId;

        var alertMsg = $"⚠️ *[SİSTEM UYARISI]*\n\n" +
                       $"• *Kaynak:* `{source}`\n" +
                       $"• *Zaman:* `{DateTime.Now:dd.MM.yyyy HH:mm:ss}`\n" +
                       $"• *Mesaj:* {message}\n" +
                       $"• *Takip Kodu:* `{traceStr}`";

        await BroadcastToActiveUsersAsync(alertMsg);
    }

    private async Task BroadcastToActiveUsersAsync(string text)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<SpendLogDbContext>();

            var activeUsers = await context.Users
                .Where(u => u.TelegramChatId != null && u.IsTelegramActive)
                .ToListAsync();

            foreach (var user in activeUsers)
            {
                if (user.TelegramChatId.HasValue && _botClient != null)
                {
                    try
                    {
                        await _botClient.SendMessage(
                            chatId: user.TelegramChatId.Value,
                            text: text,
                            parseMode: ParseMode.Markdown);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning("Markdown ile alarm iletilemedi ({UserId}), düz metin deneniyor: {Message}", user.Id, ex.Message);
                        try
                        {
                            await _botClient.SendMessage(
                                chatId: user.TelegramChatId.Value,
                                text: text);
                        }
                        catch (Exception innerEx)
                        {
                            _logger.LogWarning("Telegram alarmı kullanıcıya ({UserId}) iletilemedi: {Message}", user.Id, innerEx.Message);
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Telegram alarm yayını esnasında hata oluştu.");
        }
    }
}
