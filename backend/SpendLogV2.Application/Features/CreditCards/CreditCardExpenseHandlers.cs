using MediatR;
using Microsoft.EntityFrameworkCore;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Domain.Entities;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Application.Features.CreditCards;

public record CreditCardExpenseDto(
    int Id,
    int? AccountId,
    string? AccountName,
    int? CategoryId,
    string? CategoryName,
    int? SubCategoryId,
    string? SubCategoryName,
    DateTime Tarih,
    string Description,
    string? DescriptionInfo,
    decimal Tutar,
    string? CardNumberMasked,
    string? MainCategory,
    string? Category,
    int Year,
    int Month,
    int Day,
    bool IsPayment,
    bool IsExpense,
    DateTime? StatementDate,
    DateTime? DueDate,
    decimal? PeriodDebt,
    decimal? MinimumPayment,
    decimal? CardLimit,
    decimal? AvailableLimit,
    bool IsLiveEntry = false,
    string? OriginalNote = null,
    string? ReceiptImageUrl = null);

public record PeriodCardBreakdownDto(
    string CardFormatted,
    decimal TotalExpense,
    int Count);

public record PeriodSummaryDto(
    string PeriodKey, // Örn: "2024-07"
    string DisplayDate,
    decimal PeriodDebt,
    decimal TotalPayment,
    decimal TotalExpense,
    int ExpenseCount,
    DateTime? StatementDate,
    DateTime? DueDate,
    bool IsLive = false,
    List<PeriodCardBreakdownDto>? CardBreakdowns = null);

public record GetCreditCardExpensesQuery(
    int? AccountId = null,
    int? Year = null,
    int? Month = null,
    int? CategoryId = null,
    string? Search = null,
    bool? IsLiveEntry = null) : IRequest<List<CreditCardExpenseDto>>;

public class GetCreditCardExpensesQueryHandler : IRequestHandler<GetCreditCardExpensesQuery, List<CreditCardExpenseDto>>
{
    private readonly IAppDbContext _context;

    public GetCreditCardExpensesQueryHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<List<CreditCardExpenseDto>> Handle(GetCreditCardExpensesQuery request, CancellationToken cancellationToken)
    {
        var query = _context.CreditCardExpenses
            .Include(c => c.Account)
            .Include(c => c.CategoryRef)
            .Include(c => c.SubCategoryRef)
            .AsQueryable();

        if (request.AccountId.HasValue)
            query = query.Where(c => c.AccountId == request.AccountId.Value);

        if (request.IsLiveEntry.HasValue)
            query = query.Where(c => c.IsLiveEntry == request.IsLiveEntry.Value);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim();
            query = query.Where(c =>
                EF.Functions.Like(c.Description, $"%{search}%") ||
                c.Description.Contains(search) ||
                (c.CardNumberMasked != null && c.CardNumberMasked.Contains(search)) ||
                (c.OriginalNote != null && EF.Functions.Like(c.OriginalNote, $"%{search}%")));
        }
        else
        {
            if (request.Year.HasValue)
                query = query.Where(c => c.Year == request.Year.Value);

            if (request.Month.HasValue)
                query = query.Where(c => c.Month == request.Month.Value);
        }

        if (request.CategoryId.HasValue)
            query = query.Where(c => c.CategoryId == request.CategoryId.Value || c.SubCategoryId == request.CategoryId.Value);

        var items = await query
            .OrderByDescending(c => c.Tarih)
            .ThenByDescending(c => c.Id)
            .ToListAsync(cancellationToken);

        return items.Select(c => new CreditCardExpenseDto(
            c.Id,
            c.AccountId,
            c.Account?.Name,
            c.CategoryId,
            c.CategoryRef?.Name ?? c.MainCategory,
            c.SubCategoryId,
            c.SubCategoryRef?.Name ?? c.Category,
            c.Tarih,
            c.Description,
            c.DescriptionInfo,
            c.Tutar,
            c.CardNumberMasked,
            c.MainCategory,
            c.Category,
            c.Year,
            c.Month,
            c.Day,
            c.IsPayment,
            c.IsExpense,
            c.StatementDate,
            c.DueDate,
            c.PeriodDebt,
            c.MinimumPayment,
            c.CardLimit,
            c.AvailableLimit,
            c.IsLiveEntry,
            c.OriginalNote,
            c.ReceiptImageUrl)).ToList();
    }
}

public record GetPeriodSummariesQuery(int? AccountId = null, bool? IsLiveEntry = null) : IRequest<List<PeriodSummaryDto>>;

public class GetPeriodSummariesQueryHandler : IRequestHandler<GetPeriodSummariesQuery, List<PeriodSummaryDto>>
{
    private readonly IAppDbContext _context;

    public GetPeriodSummariesQueryHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<List<PeriodSummaryDto>> Handle(GetPeriodSummariesQuery request, CancellationToken cancellationToken)
    {
        var query = _context.CreditCardExpenses.AsQueryable();

        if (request.IsLiveEntry.HasValue)
        {
            query = query.Where(c => c.IsLiveEntry == request.IsLiveEntry.Value);
        }
        else
        {
            query = query.Where(c => !c.IsLiveEntry);
        }

        if (request.AccountId.HasValue)
            query = query.Where(c => c.AccountId == request.AccountId.Value);

        var items = await query.ToListAsync(cancellationToken);
        var isLive = request.IsLiveEntry == true;

        var groups = items
            .GroupBy(c => new { c.Year, c.Month })
            .OrderByDescending(g => g.Key.Year)
            .ThenByDescending(g => g.Key.Month)
            .Select(g =>
            {
                var periodKey = $"{g.Key.Year}-{g.Key.Month:D2}";
                var first = g.First();
                var periodDebt = g.Where(x => x.PeriodDebt.HasValue).Select(x => x.PeriodDebt!.Value).FirstOrDefault();
                if (periodDebt == 0)
                {
                    periodDebt = Math.Abs(g.Where(x => x.IsExpense).Sum(x => x.Tutar));
                }

                var totalPayment = g
                    .Where(x => x.IsPayment && (x.DescriptionInfo == "Ödeme / Havale" || x.Description.Contains("Borç Ödeme Transferi") || x.Description.Contains("Transfer")))
                    .Sum(x => Math.Abs(x.Tutar));
                var totalExpense = g.Where(x => x.IsExpense).Sum(x => Math.Abs(x.Tutar));

                var cardBreakdowns = g
                    .Where(x => x.IsExpense)
                    .GroupBy(x => !string.IsNullOrEmpty(x.CardNumberMasked)
                        ? (x.CardNumberMasked.Length >= 4 ? $"•••• {x.CardNumberMasked.Substring(x.CardNumberMasked.Length - 4)}" : x.CardNumberMasked)
                        : "Asıl Kart")
                    .Select(cg => new PeriodCardBreakdownDto(
                        cg.Key,
                        cg.Sum(x => Math.Abs(x.Tutar)),
                        cg.Count()))
                    .OrderByDescending(cb => cb.TotalExpense)
                    .ToList();

                var displayDate = isLive ? $"{g.Key.Month:D2}/{g.Key.Year} - Canlı" : $"{g.Key.Month:D2}/{g.Key.Year}";

                return new PeriodSummaryDto(
                    periodKey,
                    displayDate,
                    periodDebt,
                    totalPayment,
                    totalExpense,
                    g.Count(),
                    first.StatementDate,
                    first.DueDate,
                    isLive,
                    cardBreakdowns);
            })
            .ToList();

        return groups;
    }
}

public record BatchSaveCreditCardExpensesCommand(
    int? AccountId,
    List<CreditCardExpenseDto> Expenses) : IRequest<int>;

public class BatchSaveCreditCardExpensesCommandHandler : IRequestHandler<BatchSaveCreditCardExpensesCommand, int>
{
    private readonly IAppDbContext _context;

    public BatchSaveCreditCardExpensesCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<int> Handle(BatchSaveCreditCardExpensesCommand request, CancellationToken cancellationToken)
    {
        if (request.Expenses == null || !request.Expenses.Any())
            return 0;

        // Mevcut kategorileri alıp otomatik eşleme yapalım
        var categories = await _context.Categories.ToListAsync(cancellationToken);
        var mainCategories = categories.Where(c => !c.ParentCategoryId.HasValue).ToList();
        var subCategories = categories.Where(c => c.ParentCategoryId.HasValue).ToList();

        // Mevcut ön-kayıtları (Live Entries) bu hesap için çekelim
        var targetAccountId = request.AccountId ?? request.Expenses.FirstOrDefault()?.AccountId;
        var existingLiveEntries = await _context.CreditCardExpenses
            .Where(c => c.IsLiveEntry && (!targetAccountId.HasValue || c.AccountId == targetAccountId.Value))
            .ToListAsync(cancellationToken);

        var entities = new List<CreditCardExpense>();

        foreach (var dto in request.Expenses)
        {
            int? matchedMainId = dto.CategoryId;
            int? matchedSubId = dto.SubCategoryId;

            // Eğer kategori ID atanmamışsa, isim eşleşmesi yap
            if (!matchedSubId.HasValue && !string.IsNullOrWhiteSpace(dto.Category))
            {
                var sub = subCategories.FirstOrDefault(c => c.Name.Equals(dto.Category, StringComparison.OrdinalIgnoreCase) || dto.Category.Contains(c.Name, StringComparison.OrdinalIgnoreCase));
                if (sub != null)
                {
                    matchedSubId = sub.Id;
                    matchedMainId = sub.ParentCategoryId;
                }
            }

            if (!matchedMainId.HasValue && !string.IsNullOrWhiteSpace(dto.MainCategory))
            {
                var main = mainCategories.FirstOrDefault(c => c.Name.Equals(dto.MainCategory, StringComparison.OrdinalIgnoreCase) || dto.MainCategory.Contains(c.Name, StringComparison.OrdinalIgnoreCase));
                if (main != null)
                {
                    matchedMainId = main.Id;
                }
            }

            // Canlı Ön-Kayıt ile eşleşme var mı? (Tutar aynı ve tarih ±2 gün)
            var matchedLiveEntry = existingLiveEntries.FirstOrDefault(le => 
                Math.Abs(le.Tutar - dto.Tutar) < 0.05m && 
                Math.Abs((le.Tarih.Date - dto.Tarih.Date).TotalDays) <= 2);

            if (matchedLiveEntry != null)
            {
                // Canlı ön-kaydı resmi ekstre satırıyla birleştir!
                matchedLiveEntry.IsLiveEntry = false;
                if (!string.IsNullOrWhiteSpace(matchedLiveEntry.OriginalNote))
                {
                    matchedLiveEntry.Description = $"{matchedLiveEntry.OriginalNote} ({dto.Description})";
                }
                else
                {
                    matchedLiveEntry.Description = dto.Description;
                }
                matchedLiveEntry.DescriptionInfo = dto.DescriptionInfo;
                matchedLiveEntry.CardNumberMasked = dto.CardNumberMasked;
                matchedLiveEntry.MainCategory = dto.MainCategory;
                matchedLiveEntry.Category = dto.Category;
                matchedLiveEntry.CategoryId = matchedMainId ?? matchedLiveEntry.CategoryId;
                matchedLiveEntry.SubCategoryId = matchedSubId ?? matchedLiveEntry.SubCategoryId;
                matchedLiveEntry.Year = dto.Year > 0 ? dto.Year : dto.Tarih.Year;
                matchedLiveEntry.Month = dto.Month > 0 ? dto.Month : dto.Tarih.Month;
                matchedLiveEntry.Day = dto.Day > 0 ? dto.Day : dto.Tarih.Day;
                matchedLiveEntry.StatementDate = dto.StatementDate;
                matchedLiveEntry.DueDate = dto.DueDate;
                matchedLiveEntry.PeriodDebt = dto.PeriodDebt;
                matchedLiveEntry.MinimumPayment = dto.MinimumPayment;
                matchedLiveEntry.CardLimit = dto.CardLimit;
                matchedLiveEntry.AvailableLimit = dto.AvailableLimit;

                existingLiveEntries.Remove(matchedLiveEntry); // Tekrar eşleşmesin
                continue;
            }

            var entity = new CreditCardExpense
            {
                AccountId = request.AccountId ?? dto.AccountId,
                Tarih = dto.Tarih,
                Description = dto.Description,
                DescriptionInfo = dto.DescriptionInfo,
                Tutar = dto.Tutar,
                CardNumberMasked = dto.CardNumberMasked,
                MainCategory = dto.MainCategory,
                Category = dto.Category,
                CategoryId = matchedMainId,
                SubCategoryId = matchedSubId,
                Year = dto.Year > 0 ? dto.Year : dto.Tarih.Year,
                Month = dto.Month > 0 ? dto.Month : dto.Tarih.Month,
                Day = dto.Day > 0 ? dto.Day : dto.Tarih.Day,
                IsPayment = dto.IsPayment,
                IsExpense = dto.IsExpense,
                StatementDate = dto.StatementDate,
                DueDate = dto.DueDate,
                PeriodDebt = dto.PeriodDebt,
                MinimumPayment = dto.MinimumPayment,
                CardLimit = dto.CardLimit,
                AvailableLimit = dto.AvailableLimit,
                IsLiveEntry = false
            };

            entities.Add(entity);
        }

        if (entities.Count > 0)
        {
            _context.CreditCardExpenses.AddRange(entities);
        }
        await _context.SaveChangesAsync(cancellationToken);

        return entities.Count;
    }
}

public record UpdateCreditCardExpenseCategoryCommand(
    int Id,
    int? CategoryId,
    int? SubCategoryId) : IRequest<bool>;

public class UpdateCreditCardExpenseCategoryCommandHandler : IRequestHandler<UpdateCreditCardExpenseCategoryCommand, bool>
{
    private readonly IAppDbContext _context;

    public UpdateCreditCardExpenseCategoryCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(UpdateCreditCardExpenseCategoryCommand request, CancellationToken cancellationToken)
    {
        var item = await _context.CreditCardExpenses.FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);
        if (item == null) return false;

        item.CategoryId = request.CategoryId;
        item.SubCategoryId = request.SubCategoryId;

        if (request.CategoryId.HasValue)
        {
            var mainCat = await _context.Categories.FirstOrDefaultAsync(c => c.Id == request.CategoryId.Value, cancellationToken);
            item.MainCategory = mainCat?.Name;
        }
        else
        {
            item.MainCategory = null;
        }

        if (request.SubCategoryId.HasValue)
        {
            var subCat = await _context.Categories.FirstOrDefaultAsync(c => c.Id == request.SubCategoryId.Value, cancellationToken);
            item.Category = subCat?.Name;
        }
        else
        {
            item.Category = null;
        }

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public record DeleteCreditCardExpenseCommand(int Id) : IRequest<bool>;

public class DeleteCreditCardExpenseCommandHandler : IRequestHandler<DeleteCreditCardExpenseCommand, bool>
{
    private readonly IAppDbContext _context;

    public DeleteCreditCardExpenseCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteCreditCardExpenseCommand request, CancellationToken cancellationToken)
    {
        var item = await _context.CreditCardExpenses.FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);
        if (item == null) return false;

        _context.CreditCardExpenses.Remove(item);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public record DeleteCreditCardPeriodCommand(int Year, int Month, int? AccountId = null) : IRequest<int>;

public class DeleteCreditCardPeriodCommandHandler : IRequestHandler<DeleteCreditCardPeriodCommand, int>
{
    private readonly IAppDbContext _context;

    public DeleteCreditCardPeriodCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<int> Handle(DeleteCreditCardPeriodCommand request, CancellationToken cancellationToken)
    {
        var query = _context.CreditCardExpenses
            .Where(c => c.Year == request.Year && c.Month == request.Month);

        if (request.AccountId.HasValue)
            query = query.Where(c => c.AccountId == request.AccountId.Value);

        var items = await query.ToListAsync(cancellationToken);
        if (!items.Any()) return 0;

        _context.CreditCardExpenses.RemoveRange(items);
        await _context.SaveChangesAsync(cancellationToken);
        return items.Count;
    }
}

