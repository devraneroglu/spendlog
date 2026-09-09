using SpendLogV2.Domain.Common;

namespace SpendLogV2.Domain.Entities;

public class TelegramRule : BaseEntity
{
    public string Command { get; set; } = string.Empty; // Örn: "harcama", "bakiye", "gelir", "transfer"
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Pattern { get; set; } = string.Empty; // Regex veya şablon örn: "{tutar} {kategori} {aciklama} {hesap}"
    public string ActionType { get; set; } = string.Empty; // "CreateTransaction", "CreateTransfer", "GetBalance", "GetSummary"
    public int? DefaultAccountId { get; set; }
    public int? DefaultCategoryId { get; set; }
    public string ResponseTemplate { get; set; } = "✅ İşlem kaydedildi: {tutar} ₺ ({kategori})";
    public bool IsActive { get; set; } = true;
}
