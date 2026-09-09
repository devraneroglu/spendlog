using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SpendLogV2.Application.Common.Interfaces;
using Telegram.Bot;
using Telegram.Bot.Types.Enums;

namespace SpendLogV2.Infrastructure.Services;

public class TelegramNotificationService : ITelegramNotificationService
{
    private readonly ITelegramBotClient? _botClient;
    private readonly ILogger<TelegramNotificationService> _logger;

    public TelegramNotificationService(IConfiguration configuration, ILogger<TelegramNotificationService> logger)
    {
        _logger = logger;
        var botToken = configuration["Telegram:BotToken"];

        if (!string.IsNullOrWhiteSpace(botToken) && !botToken.Contains("YOUR_TELEGRAM_BOT_TOKEN"))
        {
            _botClient = new TelegramBotClient(botToken);
        }
    }

    public async Task SendMessageAsync(long chatId, string message, CancellationToken cancellationToken = default)
    {
        if (_botClient == null)
        {
            _logger.LogWarning("Telegram Bot Client başlatılamadı. Bildirim gönderilemedi.");
            return;
        }

        try
        {
            await _botClient.SendMessage(
                chatId: chatId,
                text: message,
                parseMode: ParseMode.Markdown,
                cancellationToken: cancellationToken);

            _logger.LogInformation("Telegram bildirimi başarıyla gönderildi. ChatId: {ChatId}", chatId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Telegram bildirimi gönderilirken hata oluştu. ChatId: {ChatId}", chatId);
        }
    }
}
