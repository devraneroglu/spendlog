using SpendLogV2.Domain.Common;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Domain.Entities;

public class PaymentPlan : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateTime FirstInstallmentDate { get; set; }
    public int InstallmentCount { get; set; } = 1;
    public bool IsOneTime { get; set; } = false;
    public PaymentPlanType Type { get; set; } = PaymentPlanType.Expense;
    public bool IsIncome { get; set; } = false;
    public string? Description { get; set; }
}
