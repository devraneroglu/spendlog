using Microsoft.EntityFrameworkCore;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Application.Common.Helpers;

public static class AccountBalanceHelper
{
    public static async Task RecalculateBalanceAsync(IAppDbContext context, int accountId, CancellationToken cancellationToken = default)
    {
        if (accountId <= 0) return;

        var account = await context.Accounts.FirstOrDefaultAsync(a => a.Id == accountId, cancellationToken);
        if (account == null) return;

        var totalIncome = await context.Transactions
            .Where(t => t.AccountId == accountId && t.Type == TransactionType.Income && !t.IsDeleted)
            .SumAsync(t => (decimal?)t.Amount, cancellationToken) ?? 0m;

        var totalExpense = await context.Transactions
            .Where(t => t.AccountId == accountId && t.Type == TransactionType.Expense && !t.IsDeleted)
            .SumAsync(t => (decimal?)t.Amount, cancellationToken) ?? 0m;

        var totalInTransfer = await context.Transfers
            .Where(t => t.ToAccountId == accountId && !t.IsDeleted)
            .SumAsync(t => (decimal?)t.Amount, cancellationToken) ?? 0m;

        var totalOutTransfer = await context.Transfers
            .Where(t => t.FromAccountId == accountId && !t.IsDeleted)
            .SumAsync(t => (decimal?)(t.Amount + (t.Fee ?? 0m)), cancellationToken) ?? 0m;

        account.CurrentBalance = account.InitialBalance + totalIncome - totalExpense + totalInTransfer - totalOutTransfer;
        account.UpdatedAt = DateTime.UtcNow;
    }

    public static async Task RecalculateAllBalancesAsync(IAppDbContext context, CancellationToken cancellationToken = default)
    {
        var accounts = await context.Accounts.Where(a => !a.IsDeleted).ToListAsync(cancellationToken);
        foreach (var acc in accounts)
        {
            await RecalculateBalanceAsync(context, acc.Id, cancellationToken);
        }
    }
}
