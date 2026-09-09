using SpendLogV2.Domain.Common;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Domain.Entities;

public class PortfolioItem : BaseEntity
{
    public string Symbol { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public AssetType AssetType { get; set; }
    public Currency Currency { get; set; } = Currency.TRY;
    public decimal Quantity { get; set; }
    public decimal PurchasePrice { get; set; }
    public decimal CurrentPrice { get; set; }
    public DateTime PurchaseDate { get; set; } = DateTime.UtcNow;
    public string? Platform { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public decimal? TargetPrice { get; set; }
    public decimal? SalePrice { get; set; }
    public DateTime? SaleDate { get; set; }

    public decimal Cost => Quantity * PurchasePrice;
    public decimal CurrentValue => Quantity * (!IsActive && SalePrice.HasValue ? SalePrice.Value : CurrentPrice);
    public decimal ProfitLoss => CurrentValue - Cost;
    public decimal ProfitLossPercent => Cost > 0 ? (ProfitLoss / Cost) * 100 : 0;
}
