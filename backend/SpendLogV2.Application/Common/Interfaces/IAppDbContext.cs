using Microsoft.EntityFrameworkCore;
using SpendLogV2.Domain.Entities;

namespace SpendLogV2.Application.Common.Interfaces;

public interface IAppDbContext
{
    DbSet<Account> Accounts { get; }
    DbSet<Category> Categories { get; }
    DbSet<Transaction> Transactions { get; }
    DbSet<Transfer> Transfers { get; }
    DbSet<CreditCardExpense> CreditCardExpenses { get; }
    DbSet<PortfolioItem> PortfolioItems { get; }
    DbSet<PortfolioSnapshot> PortfolioSnapshots { get; }
    DbSet<PaymentPlan> PaymentPlans { get; }
    DbSet<Tracker> Trackers { get; }
    DbSet<TrackerItem> TrackerItems { get; }
    DbSet<FuelLog> FuelLogs { get; }
    DbSet<TelegramRule> TelegramRules { get; }
    DbSet<SchedulerJobSetting> SchedulerJobSettings { get; }
    DbSet<PriceAlert> PriceAlerts { get; }
    DbSet<StrategyBasket> StrategyBaskets { get; }
    DbSet<StrategyBasketItem> StrategyBasketItems { get; }
    DbSet<SecurityAuditLog> SecurityAuditLogs { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
