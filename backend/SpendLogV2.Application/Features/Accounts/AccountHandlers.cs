using MediatR;
using Microsoft.EntityFrameworkCore;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Domain.Entities;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Application.Features.Accounts;

public record AccountDto(
    int Id,
    string Name,
    AccountType AccountType,
    Currency Currency,
    decimal InitialBalance,
    decimal CurrentBalance,
    string? Color,
    string? Icon,
    string? Iban,
    string? CardNumberMasked,
    bool IsActive,
    string? Description);

public record GetAccountsQuery : IRequest<List<AccountDto>>;

public class GetAccountsQueryHandler : IRequestHandler<GetAccountsQuery, List<AccountDto>>
{
    private readonly IAppDbContext _context;

    public GetAccountsQueryHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<List<AccountDto>> Handle(GetAccountsQuery request, CancellationToken cancellationToken)
    {
        var accounts = await _context.Accounts
            .OrderByDescending(a => a.IsActive)
            .ThenBy(a => a.AccountType)
            .ThenBy(a => a.Name)
            .ToListAsync(cancellationToken);

        return accounts.Select(a => new AccountDto(
            a.Id,
            a.Name,
            a.AccountType,
            a.Currency,
            a.InitialBalance,
            a.CurrentBalance,
            a.Color,
            a.Icon,
            a.Iban,
            a.CardNumberMasked,
            a.IsActive,
            a.Description)).ToList();
    }
}

public record CreateAccountCommand(
    string Name,
    AccountType AccountType,
    Currency Currency,
    decimal InitialBalance,
    string? Color,
    string? Icon,
    string? Iban,
    string? CardNumberMasked,
    string? Description) : IRequest<AccountDto>;

public class CreateAccountCommandHandler : IRequestHandler<CreateAccountCommand, AccountDto>
{
    private readonly IAppDbContext _context;

    public CreateAccountCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<AccountDto> Handle(CreateAccountCommand request, CancellationToken cancellationToken)
    {
        var account = new Account
        {
            Name = request.Name,
            AccountType = request.AccountType,
            Currency = request.Currency,
            InitialBalance = request.InitialBalance,
            CurrentBalance = request.InitialBalance,
            Color = request.Color ?? "#3b82f6",
            Icon = request.Icon ?? "wallet",
            Iban = request.Iban,
            CardNumberMasked = request.CardNumberMasked,
            Description = request.Description,
            IsActive = true
        };

        _context.Accounts.Add(account);
        await _context.SaveChangesAsync(cancellationToken);

        return new AccountDto(
            account.Id,
            account.Name,
            account.AccountType,
            account.Currency,
            account.InitialBalance,
            account.CurrentBalance,
            account.Color,
            account.Icon,
            account.Iban,
            account.CardNumberMasked,
            account.IsActive,
            account.Description);
    }
}

public record UpdateAccountCommand(
    int Id,
    string Name,
    AccountType AccountType,
    Currency Currency,
    string? Color,
    string? Icon,
    string? Iban,
    string? CardNumberMasked,
    bool IsActive,
    string? Description) : IRequest<bool>;

public class UpdateAccountCommandHandler : IRequestHandler<UpdateAccountCommand, bool>
{
    private readonly IAppDbContext _context;

    public UpdateAccountCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(UpdateAccountCommand request, CancellationToken cancellationToken)
    {
        var account = await _context.Accounts.FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken);
        if (account == null) return false;

        account.Name = request.Name;
        account.AccountType = request.AccountType;
        account.Currency = request.Currency;
        account.Color = request.Color;
        account.Icon = request.Icon;
        account.Iban = request.Iban;
        account.CardNumberMasked = request.CardNumberMasked;
        account.IsActive = request.IsActive;
        account.Description = request.Description;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public record DeleteAccountCommand(int Id) : IRequest<bool>;

public class DeleteAccountCommandHandler : IRequestHandler<DeleteAccountCommand, bool>
{
    private readonly IAppDbContext _context;

    public DeleteAccountCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteAccountCommand request, CancellationToken cancellationToken)
    {
        var account = await _context.Accounts.FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken);
        if (account == null) return false;

        account.IsDeleted = true;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public record RecalculateAllBalancesCommand : IRequest<bool>;

public class RecalculateAllBalancesCommandHandler : IRequestHandler<RecalculateAllBalancesCommand, bool>
{
    private readonly IAppDbContext _context;

    public RecalculateAllBalancesCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(RecalculateAllBalancesCommand request, CancellationToken cancellationToken)
    {
        await SpendLogV2.Application.Common.Helpers.AccountBalanceHelper.RecalculateAllBalancesAsync(_context, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
