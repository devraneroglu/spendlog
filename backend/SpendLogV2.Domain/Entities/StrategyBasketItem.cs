using SpendLogV2.Domain.Common;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Domain.Entities;

public class StrategyBasketItem : BaseEntity
{
    public int StrategyBasketId { get; set; }
    public StrategyBasket StrategyBasket { get; set; } = null!;

    public string Symbol { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public AssetType AssetType { get; set; }
    public Currency Currency { get; set; } = Currency.TRY;

    public decimal Quantity { get; set; }
    public decimal CurrentPrice { get; set; }
    public decimal TargetPrice { get; set; }
    public decimal TargetProfitPercent { get; set; }

    public string? Platform { get; set; }
    public string? Notes { get; set; }

    public decimal RequiredCapital => Quantity * CurrentPrice;
    public decimal TargetValue => Quantity * TargetPrice;
    public decimal TargetProfitLoss => TargetValue - RequiredCapital;
    public decimal CalculatedProfitPercent => RequiredCapital > 0 ? (TargetProfitLoss / RequiredCapital) * 100 : 0;
}
