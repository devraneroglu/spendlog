using SpendLogV2.Domain.Common;

namespace SpendLogV2.Domain.Entities;

public class CreditCardExpense : BaseEntity
{
    public int? AccountId { get; set; }
    public Account? Account { get; set; }

    public int? CategoryId { get; set; }
    public Category? CategoryRef { get; set; }

    public int? SubCategoryId { get; set; }
    public Category? SubCategoryRef { get; set; }

    public DateTime Tarih { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? DescriptionInfo { get; set; } // Örn: "6/6 Taksit"
    public decimal Tutar { get; set; } // Harcama ise negatif, ödeme/iade ise pozitif
    public string? CardNumberMasked { get; set; }
    public string? MainCategory { get; set; }
    public string? Category { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public int Day { get; set; }

    public bool IsPayment { get; set; }
    public bool IsExpense { get; set; }

    // Ekstre Özet Bilgileri
    public DateTime? StatementDate { get; set; }
    public DateTime? DueDate { get; set; }
    public decimal? PeriodDebt { get; set; }
    public decimal? MinimumPayment { get; set; }
    public decimal? CardLimit { get; set; }
    public decimal? AvailableLimit { get; set; }

    // Canlı Ön-Ekstre & Fiş Entegrasyonu (Live Pre-Statement Ledger)
    public bool IsLiveEntry { get; set; } = false;
    public string? OriginalNote { get; set; }
    public string? ReceiptImageUrl { get; set; }
}
