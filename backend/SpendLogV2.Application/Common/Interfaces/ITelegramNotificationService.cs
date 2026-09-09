namespace SpendLogV2.Application.Common.Interfaces;

public interface ITelegramNotificationService
{
    Task SendMessageAsync(long chatId, string message, CancellationToken cancellationToken = default);
}
