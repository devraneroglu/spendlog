using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SpendLogV2.Domain.Entities;
using SpendLogV2.Infrastructure.Data;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;

namespace SpendLogV2.Infrastructure.Services;

public class TelegramSchedulerBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TelegramSchedulerBackgroundService> _logger;

    public TelegramSchedulerBackgroundService(
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        ILogger<TelegramSchedulerBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("⏰ Telegram Scheduler Background Service (MSSQL Agent Style) başlatıldı.");

        // İlk açılışta 15 saniye bekle
        await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessScheduledRulesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Telegram zamanlanmış görevleri işlenirken hata oluştu.");
            }

            // Her 30 saniyede bir kontrol et
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
    }

    private async Task ProcessScheduledRulesAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<SpendLogDbContext>();
        var processor = scope.ServiceProvider.GetRequiredService<ITelegramMessageProcessor>();

        var recurringRules = await context.TelegramRules
            .IgnoreQueryFilters()
            .Where(r => r.IsActive && !r.IsDeleted && r.ScheduleType == "Recurring")
            .ToListAsync(stoppingToken);

        if (recurringRules.Count == 0)
            return;

        // Türkiye saati (UTC+3)
        var trTime = DateTime.UtcNow.AddHours(3);

        foreach (var rule in recurringRules)
        {
            var user = await context.Users.FirstOrDefaultAsync(u => u.Id == rule.UserId, stoppingToken);
            if (user == null || !user.TelegramChatId.HasValue || !user.IsTelegramActive)
                continue;

            bool shouldRun = false;

            if (rule.Frequency.Equals("Daily", StringComparison.OrdinalIgnoreCase))
            {
                if (TimeSpan.TryParse(rule.ExecutionTime, out var targetTime))
                {
                    // Saat ve dakika eşleşiyor mu ve son 20 saat içinde çalışmamış mı?
                    if (trTime.Hour == targetTime.Hours && trTime.Minute == targetTime.Minutes)
                    {
                        if (rule.LastRunAt == null || (DateTime.UtcNow - rule.LastRunAt.Value).TotalHours >= 20)
                        {
                            shouldRun = true;
                        }
                    }
                }
            }
            else if (rule.Frequency.Equals("Interval", StringComparison.OrdinalIgnoreCase) && rule.IntervalMinutes.HasValue && rule.IntervalMinutes > 0)
            {
                if (rule.LastRunAt == null || (DateTime.UtcNow - rule.LastRunAt.Value).TotalMinutes >= rule.IntervalMinutes.Value)
                {
                    shouldRun = true;
                }
            }

            if (shouldRun)
            {
                _logger.LogInformation("🚀 Zamanlanmış Kural Tetikleniyor: '{Title}' (Cmd: {Cmd}, User: {User})", rule.Title, rule.Command, user.Email);

                var botToken = !string.IsNullOrEmpty(user.CustomTelegramBotToken)
                    ? user.CustomTelegramBotToken
                    : _configuration["Telegram:BotToken"];

                if (string.IsNullOrWhiteSpace(botToken) || botToken.Contains("YOUR_TELEGRAM_BOT_TOKEN"))
                    continue;

                var botClient = new TelegramBotClient(botToken);

                // Tetikleyici komutu mesaj olarak simüle et
                var cmdText = rule.Command.StartsWith("/") ? rule.Command : "/" + rule.Command;
                if (rule.ActionType == "MonthlyReport" || rule.Command == "rapor")
                {
                    cmdText = $"{trTime.Year}-{trTime.Month}";
                }

                var syntheticUpdate = new Update
                {
                    Message = new Message
                    {
                        Chat = new Chat { Id = user.TelegramChatId.Value },
                        Text = cmdText,
                        Date = DateTime.UtcNow
                    }
                };

                try
                {
                    await processor.ProcessUpdateAsync(botClient, syntheticUpdate, user, stoppingToken);

                    rule.LastRunAt = DateTime.UtcNow;
                    if (rule.Frequency.Equals("Interval", StringComparison.OrdinalIgnoreCase) && rule.IntervalMinutes.HasValue)
                    {
                        rule.NextRunAt = DateTime.UtcNow.AddMinutes(rule.IntervalMinutes.Value);
                    }
                    else if (TimeSpan.TryParse(rule.ExecutionTime, out var targetTime))
                    {
                        rule.NextRunAt = DateTime.UtcNow.Date.AddDays(1).Add(targetTime).AddHours(-3);
                    }

                    await context.SaveChangesAsync(stoppingToken);
                }
                catch (Exception runEx)
                {
                    _logger.LogError(runEx, "Zamanlanmış kural yürütülürken hata: {Title}", rule.Title);
                }
            }
        }
    }
}
