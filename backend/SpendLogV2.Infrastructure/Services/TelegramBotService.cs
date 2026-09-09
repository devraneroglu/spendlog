using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SpendLogV2.Domain.Entities;
using SpendLogV2.Domain.Enums;
using SpendLogV2.Infrastructure.Data;
using Telegram.Bot;
using Telegram.Bot.Exceptions;
using Telegram.Bot.Polling;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;

namespace SpendLogV2.Infrastructure.Services;

public class TelegramBotService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TelegramBotService> _logger;
    private ITelegramBotClient? _botClient;
    private static readonly DateTime _startTime = DateTime.UtcNow;

    public TelegramBotService(IServiceProvider serviceProvider, IConfiguration configuration, ILogger<TelegramBotService> logger)
    {
        _serviceProvider = serviceProvider;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var botToken = _configuration["Telegram:BotToken"];

        if (string.IsNullOrWhiteSpace(botToken) || botToken.Contains("YOUR_TELEGRAM_BOT_TOKEN"))
        {
            _logger.LogInformation("Telegram Bot Token henüz ayarlanmadı. Dinleme beklemede.");
            return;
        }

        try
        {
            _botClient = new TelegramBotClient(botToken);

            var receiverOptions = new ReceiverOptions
            {
                AllowedUpdates = new[] { UpdateType.Message }
            };

            _botClient.StartReceiving(
                updateHandler: HandleUpdateAsync,
                errorHandler: HandlePollingErrorAsync,
                receiverOptions: receiverOptions,
                cancellationToken: stoppingToken
            );

            _logger.LogInformation("🚀 Telegram Bot Başarıyla Başlatıldı.");

            // Bot başladığında aktif kullanıcılara açılış bildirimi gönder
            _ = Task.Run(async () =>
            {
                await Task.Delay(2000, stoppingToken);
                await NotifyStartupAsync(stoppingToken);
            }, stoppingToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Telegram Bot başlatılırken hata oluştu.");
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("🛑 Telegram Bot Servisi Durduruluyor...");
        try
        {
            await NotifyShutdownAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Kapanış bildirimi gönderilirken hata oluştu.");
        }

        await base.StopAsync(cancellationToken);
    }

    private async Task NotifyStartupAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<SpendLogDbContext>();

            var activeUsers = await context.Users
                .Where(u => u.TelegramChatId != null && u.IsTelegramActive)
                .ToListAsync(cancellationToken);

            var startupMsg = $"🟢 *SPENDLOG V2 SERVİSİ BAŞLATILDI*\n\n" +
                             $"• *Durum:* Sistem Aktif ve Komutları Dinliyor\n" +
                             $"• *Sürüm:* `v2.0 (.NET 10)`\n" +
                             $"• *Başlangıç:* `{DateTime.Now:dd.MM.yyyy HH:mm:ss}`\n\n" +
                             $"💡 _Bakiye için `/bakiye`, yakıt için `/yakit`, kredi kartı için `/kk`, sistem kontrolü için `/durum` yazabilirsiniz._";

            foreach (var user in activeUsers)
            {
                if (user.TelegramChatId.HasValue && _botClient != null)
                {
                    try
                    {
                        await _botClient.SendMessage(
                            chatId: user.TelegramChatId.Value,
                            text: startupMsg,
                            parseMode: ParseMode.Markdown,
                            cancellationToken: cancellationToken);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning("Başlangıç mesajı kullanıcıya iletilemedi ({UserId}): {Message}", user.Id, ex.Message);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Başlangıç bildirimleri gönderilemedi: {Message}", ex.Message);
        }
    }

    private async Task NotifyShutdownAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<SpendLogDbContext>();

            var activeUsers = await context.Users
                .Where(u => u.TelegramChatId != null && u.IsTelegramActive)
                .ToListAsync(cancellationToken);

            var shutdownMsg = $"🟡 *SPENDLOG V2 SERVİSİ BAKIM MODUNDA*\n\n" +
                              $"• *Durum:* Servis Güncelleme / Yeniden Başlatma\n" +
                              $"• *Kapanış Zamanı:* `{DateTime.Now:dd.MM.yyyy HH:mm:ss}`\n\n" +
                              $"ℹ️ _Servis tekrar ayağa kalktığında otomatik bildirim alacaksınız._";

            foreach (var user in activeUsers)
            {
                if (user.TelegramChatId.HasValue && _botClient != null)
                {
                    try
                    {
                        await _botClient.SendMessage(
                            chatId: user.TelegramChatId.Value,
                            text: shutdownMsg,
                            parseMode: ParseMode.Markdown,
                            cancellationToken: cancellationToken);
                    }
                    catch { /* Shutdown esnasında hata fırlatma */ }
                }
            }
        }
        catch { /* Shutdown esnasında hata fırlatma */ }
    }

    private async Task HandleUpdateAsync(ITelegramBotClient botClient, Update update, CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var processor = scope.ServiceProvider.GetRequiredService<ITelegramMessageProcessor>();
            await processor.ProcessUpdateAsync(botClient, update, null, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Telegram güncellemesi işlenirken hata oluştu.");
        }
    }

    private Task HandlePollingErrorAsync(ITelegramBotClient botClient, Exception exception, CancellationToken cancellationToken)
    {
        _logger.LogError(exception, "Telegram Polling Error");
        return Task.CompletedTask;
    }
}
