using SpendLogV2.Domain.Common;

namespace SpendLogV2.Domain.Entities;

public class StrategyBasket : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime? TargetDate { get; set; }
    public bool IsArchived { get; set; } = false;

    public ICollection<StrategyBasketItem> Items { get; set; } = new List<StrategyBasketItem>();
}
