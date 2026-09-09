using MediatR;
using Microsoft.EntityFrameworkCore;
using SpendLogV2.Application.Common.Helpers;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Domain.Entities;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Application.Features.Transfers;

public record TransferDto(
    int Id,
    int FromAccountId,
    string FromAccountName,
    int ToAccountId,
    string ToAccountName,
    decimal Amount,
    decimal? Fee,
    DateTime TransferDate,
    string? Description,
    string? PeriodKey = null);

public record GetTransfersQuery : IRequest<List<TransferDto>>;

public class GetTransfersQueryHandler : IRequestHandler<GetTransfersQuery, List<TransferDto>>
{
    private readonly IAppDbContext _context;

    public GetTransfersQueryHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<List<TransferDto>> Handle(GetTransfersQuery request, CancellationToken cancellationToken)
    {
        var transfers = await _context.Transfers
            .Include(t => t.FromAccount)
            .Include(t => t.ToAccount)
            .OrderByDescending(t => t.TransferDate)
            .ThenByDescending(t => t.Id)
            .ToListAsync(cancellationToken);

        return transfers.Select(t => new TransferDto(
            t.Id,
            t.FromAccountId,
            t.FromAccount?.Name ?? "Bilinmeyen",
            t.ToAccountId,
            t.ToAccount?.Name ?? "Bilinmeyen",
            t.Amount,
            t.Fee,
            t.TransferDate,
            t.Description)).ToList();
    }
}

public record CreateTransferCommand(
    int FromAccountId,
    int ToAccountId,
    decimal Amount,
    decimal? Fee,
    DateTime TransferDate,
    string? Description,
    string? PeriodKey = null) : IRequest<TransferDto>;

public class CreateTransferCommandHandler : IRequestHandler<CreateTransferCommand, TransferDto>
{
    private readonly IAppDbContext _context;

    public CreateTransferCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<TransferDto> Handle(CreateTransferCommand request, CancellationToken cancellationToken)
    {
        if (request.FromAccountId == request.ToAccountId)
            throw new InvalidOperationException("Kaynak ve hedef hesap aynı olamaz.");

        var fromAccount = await _context.Accounts.FirstOrDefaultAsync(a => a.Id == request.FromAccountId, cancellationToken);
        var toAccount = await _context.Accounts.FirstOrDefaultAsync(a => a.Id == request.ToAccountId, cancellationToken);

        if (fromAccount == null || toAccount == null)
            throw new InvalidOperationException("Hesaplar bulunamadı.");

        var transfer = new Transfer
        {
            FromAccountId = request.FromAccountId,
            ToAccountId = request.ToAccountId,
            Amount = request.Amount,
            Fee = request.Fee,
            TransferDate = request.TransferDate,
            Description = request.Description
        };

        _context.Transfers.Add(transfer);

        // Hedef hesap Kredi Kartı ise Ekstre Ödeme Kaydı Oluştur
        if (toAccount.AccountType == AccountType.CreditCard)
        {
            int year = request.TransferDate.Year;
            int month = request.TransferDate.Month;

            if (!string.IsNullOrWhiteSpace(request.PeriodKey) && request.PeriodKey.Contains('-'))
            {
                var parts = request.PeriodKey.Split('-');
                if (int.TryParse(parts[0], out int pYear) && int.TryParse(parts[1], out int pMonth))
                {
                    year = pYear;
                    month = pMonth;
                }
            }

            var ccPayment = new CreditCardExpense
            {
                AccountId = toAccount.Id,
                Tarih = request.TransferDate,
                Description = $"{fromAccount.Name} - Borç Ödeme Transferi",
                DescriptionInfo = "Ödeme / Havale",
                Tutar = request.Amount, // Pozitif = Ödeme
                Year = year,
                Month = month,
                Day = request.TransferDate.Day,
                IsPayment = true,
                IsExpense = false,
                MainCategory = "3-Finansal İşlemler",
                Category = "Kredi Kartı Ödeme"
            };

            _context.CreditCardExpenses.Add(ccPayment);
        }

        await _context.SaveChangesAsync(cancellationToken);

        // Bakiyeleri Kesin Matematiksel Olarak Yeniden Hesapla
        await AccountBalanceHelper.RecalculateBalanceAsync(_context, request.FromAccountId, cancellationToken);
        await AccountBalanceHelper.RecalculateBalanceAsync(_context, request.ToAccountId, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        return new TransferDto(
            transfer.Id,
            fromAccount.Id,
            fromAccount.Name,
            toAccount.Id,
            toAccount.Name,
            transfer.Amount,
            transfer.Fee,
            transfer.TransferDate,
            transfer.Description,
            request.PeriodKey);
    }
}

public record UpdateTransferCommand(
    int Id,
    int FromAccountId,
    int ToAccountId,
    decimal Amount,
    decimal? Fee,
    DateTime TransferDate,
    string? Description,
    string? PeriodKey = null) : IRequest<TransferDto>;

public class UpdateTransferCommandHandler : IRequestHandler<UpdateTransferCommand, TransferDto>
{
    private readonly IAppDbContext _context;

    public UpdateTransferCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<TransferDto> Handle(UpdateTransferCommand request, CancellationToken cancellationToken)
    {
        var transfer = await _context.Transfers
            .FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken);

        if (transfer == null) throw new InvalidOperationException("Transfer bulunamadı.");

        var oldFromId = transfer.FromAccountId;
        var oldToId = transfer.ToAccountId;

        var newFrom = await _context.Accounts.FirstOrDefaultAsync(a => a.Id == request.FromAccountId, cancellationToken);
        var newTo = await _context.Accounts.FirstOrDefaultAsync(a => a.Id == request.ToAccountId, cancellationToken);

        if (newFrom == null || newTo == null) throw new InvalidOperationException("Hesaplar bulunamadı.");

        transfer.FromAccountId = request.FromAccountId;
        transfer.ToAccountId = request.ToAccountId;
        transfer.Amount = request.Amount;
        transfer.Fee = request.Fee;
        transfer.TransferDate = request.TransferDate;
        transfer.Description = request.Description;

        // Hedef hesap Kredi Kartı ise Ekstre Ödeme Kaydını Güncelle / Ekle
        if (newTo.AccountType == AccountType.CreditCard)
        {
            int year = request.TransferDate.Year;
            int month = request.TransferDate.Month;

            if (!string.IsNullOrWhiteSpace(request.PeriodKey) && request.PeriodKey.Contains('-'))
            {
                var parts = request.PeriodKey.Split('-');
                if (int.TryParse(parts[0], out int pYear) && int.TryParse(parts[1], out int pMonth))
                {
                    year = pYear;
                    month = pMonth;
                }
            }

            // Bu transfere ait mevcut bir kredi kartı ödeme kaydı var mı kontrol et
            var existingPayment = await _context.CreditCardExpenses
                .FirstOrDefaultAsync(e => e.AccountId == newTo.Id && e.IsPayment && e.Description.Contains("Borç Ödeme Transferi") && e.Tarih.Date == transfer.TransferDate.Date, cancellationToken);

            if (existingPayment != null)
            {
                existingPayment.Tutar = request.Amount;
                existingPayment.Tarih = request.TransferDate;
                existingPayment.Year = year;
                existingPayment.Month = month;
                existingPayment.Day = request.TransferDate.Day;
                existingPayment.Description = $"{newFrom.Name} - Borç Ödeme Transferi";
            }
            else
            {
                var ccPayment = new CreditCardExpense
                {
                    AccountId = newTo.Id,
                    Tarih = request.TransferDate,
                    Description = $"{newFrom.Name} - Borç Ödeme Transferi",
                    DescriptionInfo = "Ödeme / Havale",
                    Tutar = request.Amount,
                    Year = year,
                    Month = month,
                    Day = request.TransferDate.Day,
                    IsPayment = true,
                    IsExpense = false,
                    MainCategory = "3-Finansal İşlemler",
                    Category = "Kredi Kartı Ödeme"
                };
                _context.CreditCardExpenses.Add(ccPayment);
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        // İlgili tüm hesapların bakiyesini kesin hesapla
        await AccountBalanceHelper.RecalculateBalanceAsync(_context, oldFromId, cancellationToken);
        await AccountBalanceHelper.RecalculateBalanceAsync(_context, oldToId, cancellationToken);
        if (oldFromId != request.FromAccountId)
            await AccountBalanceHelper.RecalculateBalanceAsync(_context, request.FromAccountId, cancellationToken);
        if (oldToId != request.ToAccountId)
            await AccountBalanceHelper.RecalculateBalanceAsync(_context, request.ToAccountId, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        return new TransferDto(
            transfer.Id,
            newFrom.Id,
            newFrom.Name,
            newTo.Id,
            newTo.Name,
            transfer.Amount,
            transfer.Fee,
            transfer.TransferDate,
            transfer.Description,
            request.PeriodKey);
    }
}

public record DeleteTransferCommand(int Id) : IRequest<bool>;

public class DeleteTransferCommandHandler : IRequestHandler<DeleteTransferCommand, bool>
{
    private readonly IAppDbContext _context;

    public DeleteTransferCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteTransferCommand request, CancellationToken cancellationToken)
    {
        var transfer = await _context.Transfers
            .FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken);

        if (transfer == null) return false;

        var fromId = transfer.FromAccountId;
        var toId = transfer.ToAccountId;

        _context.Transfers.Remove(transfer);
        await _context.SaveChangesAsync(cancellationToken);

        // Hesapların Bakiyesini Kesin Matematiksel Olarak Yeniden Hesapla
        await AccountBalanceHelper.RecalculateBalanceAsync(_context, fromId, cancellationToken);
        await AccountBalanceHelper.RecalculateBalanceAsync(_context, toId, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
