using SpendLogV2.Domain.Common;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Domain.Entities;

public class Transaction : BaseEntity
{
    public int AccountId { get; set; }
    public Account? Account { get; set; }

    public int? CategoryId { get; set; }
    public Category? Category { get; set; }

    public int? SubCategoryId { get; set; }
    public Category? SubCategory { get; set; }

    public decimal Amount { get; set; }
    public TransactionType Type { get; set; } = TransactionType.Expense;
    public DateTime TransactionDate { get; set; } = DateTime.UtcNow;
    public string? Description { get; set; }
    public string? Tags { get; set; }
}
