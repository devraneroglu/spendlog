using SpendLogV2.Domain.Common;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Domain.Entities;

public class Account : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public AccountType AccountType { get; set; }
    public Currency Currency { get; set; } = Currency.TRY;
    public decimal InitialBalance { get; set; }
    public decimal CurrentBalance { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public string? Iban { get; set; }
    public string? CardNumberMasked { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Description { get; set; }

    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
    public ICollection<Transfer> FromTransfers { get; set; } = new List<Transfer>();
    public ICollection<Transfer> ToTransfers { get; set; } = new List<Transfer>();
    public ICollection<CreditCardExpense> CreditCardExpenses { get; set; } = new List<CreditCardExpense>();
}
