using SpendLogV2.Domain.Common;

namespace SpendLogV2.Domain.Entities;

public class Transfer : BaseEntity
{
    public int FromAccountId { get; set; }
    public Account? FromAccount { get; set; }

    public int ToAccountId { get; set; }
    public Account? ToAccount { get; set; }

    public decimal Amount { get; set; }
    public decimal? Fee { get; set; }
    public DateTime TransferDate { get; set; } = DateTime.UtcNow;
    public string? Description { get; set; }
}
