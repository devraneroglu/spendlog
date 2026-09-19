using SpendLogV2.Domain.Common;

namespace SpendLogV2.Domain.Entities;

public class TelegramRule : BaseEntity
{
    public string Command { get; set; } = string.Empty; // Örn: "harcama", "bakiye", "gelir", "transfer", "durum"
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty; // Serbest açıklama
    public string Pattern { get; set; } = string.Empty; // Regex veya şablon
    public string ActionType { get; set; } = "Custom"; // "CreateTransaction", "CreateTransfer", "GetBalance", "GetSummary", "GetSystemStatus", "MonthlyReport", "Custom"
    public int? DefaultAccountId { get; set; }
    public int? DefaultCategoryId { get; set; }
    public string ResponseTemplate { get; set; } = "✅ İşlem kaydedildi: {tutar} ₺ ({kategori})";
    public bool IsActive { get; set; } = true;

    // MSSQL Agent Job Scheduler & Gönderim Türü Alanları
    public string SendType { get; set; } = "Text"; // "Text", "Image", "Pdf", "ChartAndPdf"
    public string ScheduleType { get; set; } = "Manual"; // "Manual", "Recurring"
    public string Frequency { get; set; } = "Daily"; // "Daily", "Weekly", "Interval"
    public string? ExecutionTime { get; set; } = "09:00"; // "HH:mm"
    public int? IntervalMinutes { get; set; } // Örn: 30, 60, 120 dk
    public string? DaysOfWeek { get; set; } // Örn: "1,2,3,4,5"
    public DateTime? LastRunAt { get; set; }
    public DateTime? NextRunAt { get; set; }
}
