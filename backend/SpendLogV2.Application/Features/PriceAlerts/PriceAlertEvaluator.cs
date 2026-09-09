using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Domain.Entities;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Application.Features.PriceAlerts;

public class PriceAlertEvaluator
{
    private readonly IAppDbContext _context;
    private readonly ITelegramNotificationService _telegramService;
    private readonly ILogger<PriceAlertEvaluator> _logger;

    public PriceAlertEvaluator(
        IAppDbContext context,
        ITelegramNotificationService telegramService,
        ILogger<PriceAlertEvaluator> logger)
    {
        _context = context;
        _telegramService = telegramService;
        _logger = logger;
    }

    public async Task EvaluateAlertsAsync(Dictionary<string, decimal> updatedPrices, CancellationToken cancellationToken = default)
    {
        if (updatedPrices == null || updatedPrices.Count == 0) return;

        try
        {
            // Aktif olan tüm alarmları çek
            var activeAlerts = await _context.PriceAlerts
                .IgnoreQueryFilters()
                .Where(a => a.IsActive && (!a.IsTriggered || a.IsRecurring) && !a.IsDeleted)
                .ToListAsync(cancellationToken);

            if (activeAlerts.Count == 0) return;

            foreach (var alert in activeAlerts)
            {
                var sym = alert.Symbol.ToUpper().Trim();
                if (!updatedPrices.TryGetValue(sym, out var currentPrice) || currentPrice <= 0)
                {
                    continue;
                }

                bool isTriggered = false;
                if (alert.Condition == PriceAlertCondition.AboveOrEqual && currentPrice >= alert.TargetPrice)
                {
                    isTriggered = true;
                }
                else if (alert.Condition == PriceAlertCondition.BelowOrEqual && currentPrice <= alert.TargetPrice)
                {
                    isTriggered = true;
                }

                if (isTriggered)
                {
                    alert.IsTriggered = true;
                    alert.TriggeredAt = DateTime.UtcNow;
                    alert.TriggeredPrice = currentPrice;

                    if (!alert.IsRecurring)
                    {
                        alert.IsActive = false; // Tek seferlik alarmlar pasife alınır
                    }

                    // Kullanıcı bilgilerini ve TelegramChatId'sini bul
                    // EF Core DbContext üzerinden AppUser sorgulayalım
                    if (_context is DbContext dbCtx)
                    {
                        var user = await dbCtx.Set<AppUser>()
                            .AsNoTracking()
                            .FirstOrDefaultAsync(u => u.Id == alert.UserId, cancellationToken);

                        if (user != null && user.TelegramChatId.HasValue)
                        {
                            var currencySymbol = alert.Currency == Currency.USD ? "$" : alert.Currency == Currency.EUR ? "€" : "₺";
                            var conditionSymbol = alert.Condition == PriceAlertCondition.AboveOrEqual ? "▲ Hedefe Ulaştı (≥)" : "▼ Hedefin Altına Düştü (≤)";

                            var msg = $"🚨 *SPENDLOG FİYAT ALARMI TETİKLENDİ!*\n\n" +
                                      $"🪙 *Varlık:* `{alert.Symbol}` ({alert.Name})\n" +
                                      $"🎯 *Hedef:* `{alert.TargetPrice:N2} {currencySymbol}` ({conditionSymbol})\n" +
                                      $"📈 *Anlık Fiyat:* `{currentPrice:N2} {currencySymbol}`\n";

                            if (!string.IsNullOrWhiteSpace(alert.Note))
                            {
                                msg += $"📝 *Not:* _{alert.Note}_\n";
                            }

                            msg += $"⏰ *Zaman:* {DateTime.Now:dd.MM.yyyy HH:mm}";

                            await _telegramService.SendMessageAsync(user.TelegramChatId.Value, msg, cancellationToken);
                            _logger.LogInformation("Fiyat alarmı tetiklendi ve Telegram bildirimi gönderildi. Symbol: {Symbol}, Price: {Price}", alert.Symbol, currentPrice);
                        }
                    }
                }
            }

            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Fiyat alarmları değerlendirilirken hata oluştu.");
        }
    }
}
