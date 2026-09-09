using SpendLogV2.Domain.Common;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Domain.Entities;

public class Category : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public CategoryType Type { get; set; } = CategoryType.Expense;
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public int DisplayOrder { get; set; } = 0;
    
    public int? ParentCategoryId { get; set; }
    public Category? ParentCategory { get; set; }
    public ICollection<Category> SubCategories { get; set; } = new List<Category>();

    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
    public ICollection<CreditCardExpense> CreditCardExpenses { get; set; } = new List<CreditCardExpense>();
}
