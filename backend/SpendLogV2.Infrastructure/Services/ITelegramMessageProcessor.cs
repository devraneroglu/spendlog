using SpendLogV2.Domain.Entities;
using Telegram.Bot;
using Telegram.Bot.Types;

namespace SpendLogV2.Infrastructure.Services;

public interface ITelegramMessageProcessor
{
    Task ProcessUpdateAsync(ITelegramBotClient botClient, Update update, AppUser? resolvedUser = null, CancellationToken cancellationToken = default);
}
