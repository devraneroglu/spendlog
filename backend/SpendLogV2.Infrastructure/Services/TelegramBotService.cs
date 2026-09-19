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

            // Bot menü komutlarını Telegram istemcisine kaydet
            try
            {
                var botCommands = new[]
                {
                    new BotCommand { Command = "bakiye", Description = "Hesap bakiyeleri ve toplam likit varlık" },
                    new BotCommand { Command = "yakit", Description = "Akaryakıt tüketim kaydı" },
                    new BotCommand { Command = "kk", Description = "Kredi kartı harcama girişi" },
                    new BotCommand { Command = "durum", Description = "Sistem sağlık ve uptime raporu" },
                    new BotCommand { Command = "temizle", Description = "Sohbet geçmişini temizle" },
                    new BotCommand { Command = "help", Description = "Komut yardım ve rehberi" }
                };
                await _botClient.SetMyCommands(botCommands, cancellationToken: stoppingToken);
            }
            catch (Exception cmdEx)
            {
                _logger.LogWarning(cmdEx, "Telegram bot komut menüsü kaydedilemedi.");
            }

            // Bot başladığında aktif kullanıcılara açılış bildirimi gönder (yapılandırılabilir)
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
            if (!_configuration.GetValue<bool>("Telegram:SendStartupNotification", true))
                return;

            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<SpendLogDbContext>();

            var activeUsers = await context.Users
                .Where(u => u.TelegramChatId != null && u.IsTelegramActive)
                .ToListAsync(cancellationToken);

            var startupMsg = $"🟢 *SpendLog API aktif* (`v2.0` • `{DateTime.Now:HH:mm}`)";

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
                            disableNotification: true,
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
            if (!_configuration.GetValue<bool>("Telegram:SendStartupNotification", true))
                return;

            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<SpendLogDbContext>();

            var activeUsers = await context.Users
                .Where(u => u.TelegramChatId != null && u.IsTelegramActive)
                .ToListAsync(cancellationToken);

            var shutdownMsg = $"🟡 *SpendLog API bakım modunda* (`{DateTime.Now:HH:mm}`)";

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
                            disableNotification: true,
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
