using MediatR;
using Microsoft.EntityFrameworkCore;
using SpendLogV2.Application.Common.Helpers;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Domain.Entities;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Application.Features.Transactions;

public record TransactionDto(
    int Id,
    int AccountId,
    string AccountName,
    int? CategoryId,
    string? CategoryName,
    int? SubCategoryId,
    string? SubCategoryName,
    decimal Amount,
    TransactionType Type,
    DateTime TransactionDate,
    string? Description,
    string? Tags,
    bool IsTransfer = false,
    int? TransferId = null,
    string? TransferTargetAccountName = null);

public record GetTransactionsQuery(
    int? AccountId = null,
    int? CategoryId = null,
    TransactionType? Type = null,
    DateTime? StartDate = null,
    DateTime? EndDate = null,
    string? Search = null) : IRequest<List<TransactionDto>>;

public class GetTransactionsQueryHandler : IRequestHandler<GetTransactionsQuery, List<TransactionDto>>
{
    private readonly IAppDbContext _context;

    public GetTransactionsQueryHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<List<TransactionDto>> Handle(GetTransactionsQuery request, CancellationToken cancellationToken)
    {
        // 1. Standart Gelir/Gider İşlemleri
        var query = _context.Transactions
            .Include(t => t.Account)
            .Include(t => t.Category)
            .Include(t => t.SubCategory)
            .AsQueryable();

        if (request.AccountId.HasValue)
            query = query.Where(t => t.AccountId == request.AccountId.Value);

        if (request.CategoryId.HasValue)
            query = query.Where(t => t.CategoryId == request.CategoryId.Value || t.SubCategoryId == request.CategoryId.Value);

        if (request.Type.HasValue)
            query = query.Where(t => t.Type == request.Type.Value);

        if (request.StartDate.HasValue)
            query = query.Where(t => t.TransactionDate >= request.StartDate.Value);

        if (request.EndDate.HasValue)
            query = query.Where(t => t.TransactionDate <= request.EndDate.Value);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.ToLower();
            query = query.Where(t => 
                (t.Description != null && t.Description.ToLower().Contains(search)) ||
                (t.Tags != null && t.Tags.ToLower().Contains(search)));
        }

        var items = await query.ToListAsync(cancellationToken);

        var list = items.Select(t => new TransactionDto(
            t.Id,
            t.AccountId,
            t.Account?.Name ?? "Bilinmeyen",
            t.CategoryId,
            t.Category?.Name,
            t.SubCategoryId,
            t.SubCategory?.Name,
            t.Amount,
            t.Type,
            t.TransactionDate,
            t.Description,
            t.Tags,
            false,
            null,
            null)).ToList();

        // 2. Transfer Kayıtlarını Unified Ledger Olarak Dahil Et
        // Eğer kategori filtresi seçildiyse transferler kategoriye bağlı olmadığı için dahil edilmez
        if (!request.CategoryId.HasValue)
        {
            var transferQuery = _context.Transfers
                .Include(t => t.FromAccount)
                .Include(t => t.ToAccount)
                .AsQueryable();

            if (request.StartDate.HasValue)
                transferQuery = transferQuery.Where(t => t.TransferDate >= request.StartDate.Value);

            if (request.EndDate.HasValue)
                transferQuery = transferQuery.Where(t => t.TransferDate <= request.EndDate.Value);

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var search = request.Search.ToLower();
                transferQuery = transferQuery.Where(t =>
                    (t.Description != null && t.Description.ToLower().Contains(search)) ||
                    (t.FromAccount != null && t.FromAccount.Name.ToLower().Contains(search)) ||
                    (t.ToAccount != null && t.ToAccount.Name.ToLower().Contains(search)));
            }

            var transfers = await transferQuery.ToListAsync(cancellationToken);

            foreach (var tr in transfers)
            {
                // Belirli bir hesap seçildiyse:
                if (request.AccountId.HasValue)
                {
                    int accId = request.AccountId.Value;

                    // Bu hesaptan GİDEN Transfer -> Expense
                    if (tr.FromAccountId == accId && (!request.Type.HasValue || request.Type.Value == TransactionType.Expense))
                    {
                        list.Add(new TransactionDto(
                            tr.Id + 1_000_000, // Çakışma olmaması için sanal ID
                            tr.FromAccountId,
                            tr.FromAccount?.Name ?? "Hesap",
                            null,
                            "Transfer (Giden)",
                            null,
                            null,
                            tr.Amount + (tr.Fee ?? 0),
                            TransactionType.Expense,
                            tr.TransferDate,
                            string.IsNullOrWhiteSpace(tr.Description) 
                                ? $"Transfer ➔ {tr.ToAccount?.Name ?? "Hedef Hesap"}" 
                                : $"{tr.Description} (➔ {tr.ToAccount?.Name ?? "Hedef"})",
                            "transfer",
                            true,
                            tr.Id,
                            tr.ToAccount?.Name));
                    }

                    // Bu hesaba GELEN Transfer -> Income
                    if (tr.ToAccountId == accId && (!request.Type.HasValue || request.Type.Value == TransactionType.Income))
                    {
                        list.Add(new TransactionDto(
                            tr.Id + 2_000_000,
                            tr.ToAccountId,
                            tr.ToAccount?.Name ?? "Hesap",
                            null,
                            "Transfer (Gelen)",
                            null,
                            null,
                            tr.Amount,
                            TransactionType.Income,
                            tr.TransferDate,
                            string.IsNullOrWhiteSpace(tr.Description) 
                                ? $"Transfer  {tr.FromAccount?.Name ?? "Kaynak Hesap"}" 
                                : $"{tr.Description} ( {tr.FromAccount?.Name ?? "Kaynak"})",
                            "transfer",
                            true,
                            tr.Id,
                            tr.FromAccount?.Name));
                    }
                }
                else
                {
                    // Genel liste (Tüm hesaplar) - Her transferi çıkış ve giriş olarak veya tekil transfer olarak temsil edebiliriz
                    if (!request.Type.HasValue || request.Type.Value == TransactionType.Expense)
                    {
                        list.Add(new TransactionDto(
                            tr.Id + 1_000_000,
                            tr.FromAccountId,
                            tr.FromAccount?.Name ?? "Kaynak Hesap",
                            null,
                            "Transfer",
                            null,
                            null,
                            tr.Amount,
                            TransactionType.Expense,
                            tr.TransferDate,
                            string.IsNullOrWhiteSpace(tr.Description)
                                ? $"Virman: {tr.FromAccount?.Name} ➔ {tr.ToAccount?.Name}"
                                : $"{tr.Description} ({tr.FromAccount?.Name} ➔ {tr.ToAccount?.Name})",
                            "transfer",
                            true,
                            tr.Id,
                            tr.ToAccount?.Name));
                    }
                }
            }
        }

        return list
            .OrderByDescending(t => t.TransactionDate)
            .ThenByDescending(t => t.Id)
            .ToList();
    }
}

public record CreateTransactionCommand(
    int AccountId,
    int? CategoryId,
    int? SubCategoryId,
    decimal Amount,
    TransactionType Type,
    DateTime TransactionDate,
    string? Description,
    string? Tags) : IRequest<TransactionDto>;

public class CreateTransactionCommandHandler : IRequestHandler<CreateTransactionCommand, TransactionDto>
{
    private readonly IAppDbContext _context;

    public CreateTransactionCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<TransactionDto> Handle(CreateTransactionCommand request, CancellationToken cancellationToken)
    {
        var account = await _context.Accounts.FirstOrDefaultAsync(a => a.Id == request.AccountId, cancellationToken);
        if (account == null) throw new InvalidOperationException("Hesap bulunamadı.");

        var transaction = new Transaction
        {
            AccountId = request.AccountId,
            CategoryId = request.CategoryId,
            SubCategoryId = request.SubCategoryId,
            Amount = Math.Abs(request.Amount),
            Type = request.Type,
            TransactionDate = request.TransactionDate,
            Description = request.Description,
            Tags = request.Tags
        };

        _context.Transactions.Add(transaction);
        await _context.SaveChangesAsync(cancellationToken);

        // Hesap Bakiyesini Kesin Matematiksel Olarak Yeniden Hesapla
        await AccountBalanceHelper.RecalculateBalanceAsync(_context, transaction.AccountId, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        var category = transaction.CategoryId.HasValue ? await _context.Categories.FirstOrDefaultAsync(c => c.Id == transaction.CategoryId.Value, cancellationToken) : null;
        var subCategory = transaction.SubCategoryId.HasValue ? await _context.Categories.FirstOrDefaultAsync(c => c.Id == transaction.SubCategoryId.Value, cancellationToken) : null;

        return new TransactionDto(
            transaction.Id,
            transaction.AccountId,
            account.Name,
            transaction.CategoryId,
            category?.Name,
            transaction.SubCategoryId,
            subCategory?.Name,
            transaction.Amount,
            transaction.Type,
            transaction.TransactionDate,
            transaction.Description,
            transaction.Tags);
    }
}

public record UpdateTransactionCommand(
    int Id,
    int AccountId,
    int? CategoryId,
    int? SubCategoryId,
    decimal Amount,
    TransactionType Type,
    DateTime TransactionDate,
    string? Description,
    string? Tags) : IRequest<TransactionDto>;

public class UpdateTransactionCommandHandler : IRequestHandler<UpdateTransactionCommand, TransactionDto>
{
    private readonly IAppDbContext _context;

    public UpdateTransactionCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<TransactionDto> Handle(UpdateTransactionCommand request, CancellationToken cancellationToken)
    {
        var transaction = await _context.Transactions
            .FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken);

        if (transaction == null) throw new InvalidOperationException("İşlem bulunamadı.");

        var oldAccountId = transaction.AccountId;
        var newAccount = await _context.Accounts.FirstOrDefaultAsync(a => a.Id == request.AccountId, cancellationToken);
        if (newAccount == null) throw new InvalidOperationException("Yeni hesap bulunamadı.");

        var newAmount = Math.Abs(request.Amount);

        // Bilgileri güncelle
        transaction.AccountId = request.AccountId;
        transaction.CategoryId = request.CategoryId;
        transaction.SubCategoryId = request.SubCategoryId;
        transaction.Amount = newAmount;
        transaction.Type = request.Type;
        transaction.TransactionDate = request.TransactionDate;
        transaction.Description = request.Description;
        transaction.Tags = request.Tags;

        await _context.SaveChangesAsync(cancellationToken);

        // Hem eski hem yeni hesabın bakiyesini kesin hesapla
        await AccountBalanceHelper.RecalculateBalanceAsync(_context, oldAccountId, cancellationToken);
        if (oldAccountId != request.AccountId)
        {
            await AccountBalanceHelper.RecalculateBalanceAsync(_context, request.AccountId, cancellationToken);
        }
        await _context.SaveChangesAsync(cancellationToken);

        var category = transaction.CategoryId.HasValue ? await _context.Categories.FirstOrDefaultAsync(c => c.Id == transaction.CategoryId.Value, cancellationToken) : null;
        var subCategory = transaction.SubCategoryId.HasValue ? await _context.Categories.FirstOrDefaultAsync(c => c.Id == transaction.SubCategoryId.Value, cancellationToken) : null;

        return new TransactionDto(
            transaction.Id,
            transaction.AccountId,
            newAccount.Name,
            transaction.CategoryId,
            category?.Name,
            transaction.SubCategoryId,
            subCategory?.Name,
            transaction.Amount,
            transaction.Type,
            transaction.TransactionDate,
            transaction.Description,
            transaction.Tags);
    }
}

public record DeleteTransactionCommand(int Id) : IRequest<bool>;

public class DeleteTransactionCommandHandler : IRequestHandler<DeleteTransactionCommand, bool>
{
    private readonly IAppDbContext _context;

    public DeleteTransactionCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteTransactionCommand request, CancellationToken cancellationToken)
    {
        var transaction = await _context.Transactions
            .FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken);

        if (transaction == null) return false;

        transaction.IsDeleted = true;
        await _context.SaveChangesAsync(cancellationToken);

        // Hesap Bakiyesini Kesin Matematiksel Olarak Yeniden Hesapla
        await AccountBalanceHelper.RecalculateBalanceAsync(_context, transaction.AccountId, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
