using SpendLogV2.Domain.Common;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Domain.Entities;

public class PriceAlert : BaseEntity
{
    public string Symbol { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public AssetType AssetType { get; set; } = AssetType.Stock;
    public Currency Currency { get; set; } = Currency.TRY;
    public decimal TargetPrice { get; set; }
    public PriceAlertCondition Condition { get; set; } = PriceAlertCondition.AboveOrEqual;
    public string? Note { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsTriggered { get; set; } = false;
    public DateTime? TriggeredAt { get; set; }
    public decimal? TriggeredPrice { get; set; }
    public bool IsRecurring { get; set; } = false; // Tek seferlik mi, tekrarlayan mı
}
