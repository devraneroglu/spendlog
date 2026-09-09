using SpendLogV2.Domain.Common;

namespace SpendLogV2.Domain.Entities;

public class PortfolioSnapshot : BaseEntity
{
    public DateTime SnapshotDate { get; set; } = DateTime.UtcNow;
    public decimal TotalValueTRY { get; set; }
    public decimal TotalValueUSD { get; set; }
    public decimal StockValueTRY { get; set; }
    public decimal CryptoValueTRY { get; set; }
    public decimal CommodityValueTRY { get; set; }
    public decimal ETFValueTRY { get; set; }
    public decimal BondValueTRY { get; set; }
    public decimal ExchangeRate { get; set; }
    public int ActiveItemsCount { get; set; }
}
