using SpendLogV2.Domain.Common;

namespace SpendLogV2.Domain.Entities;

public class SchedulerJobSetting : BaseEntity
{
    public string JobKey { get; set; } = string.Empty; // Örn: "BIST_STOCKS", "GOLD_COMMODITIES", "CRYPTO_PRICES", "CURRENCY_RATES"
    public string JobName { get; set; } = string.Empty;
    public string CronExpression { get; set; } = "*/5 * * * *"; // Varsayılan 5 dk
    public bool IsEnabled { get; set; } = true;
    public DateTime? LastRunTime { get; set; }
    public DateTime? NextRunTime { get; set; }
    public string? LastStatus { get; set; } // "Success", "Failed", "Running"
    public string? LastErrorMessage { get; set; }
    public int TimeoutSeconds { get; set; } = 30;
}
