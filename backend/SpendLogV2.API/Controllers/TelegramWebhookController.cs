using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SpendLogV2.Infrastructure.Data;
using SpendLogV2.Infrastructure.Services;
using Telegram.Bot;
using Telegram.Bot.Types;

namespace SpendLogV2.API.Controllers;

[ApiController]
[Route("api/telegram/webhook")]
[AllowAnonymous]
public class TelegramWebhookController : ControllerBase
{
    private readonly SpendLogDbContext _context;
    private readonly ITelegramMessageProcessor _messageProcessor;
    private readonly ILogger<TelegramWebhookController> _logger;

    public TelegramWebhookController(
        SpendLogDbContext context,
        ITelegramMessageProcessor messageProcessor,
        ILogger<TelegramWebhookController> logger)
    {
        _context = context;
        _messageProcessor = messageProcessor;
        _logger = logger;
    }

    [HttpPost("{secret}")]
    public async Task<IActionResult> HandleWebhook(string secret, [FromBody] Update update, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(secret))
        {
            return BadRequest();
        }

        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.TelegramWebhookSecret == secret, cancellationToken);

        if (user == null || string.IsNullOrWhiteSpace(user.CustomTelegramBotToken))
        {
            _logger.LogWarning("Geçersiz webhook secret çağrısı veya kullanıcı bot token'ı yok: {Secret}", secret);
            return Ok(); // Telegram sunucularına 200 OK dönerek sonsuz retry döngüsünü engelliyoruz
        }

        try
        {
            var botClient = new TelegramBotClient(user.CustomTelegramBotToken);
            await _messageProcessor.ProcessUpdateAsync(botClient, update, user, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Webhook üzerinden gelen Telegram mesajı işlenirken hata oluştu. Kullanıcı: {UserId}", user.Id);
        }

        return Ok();
    }
}
