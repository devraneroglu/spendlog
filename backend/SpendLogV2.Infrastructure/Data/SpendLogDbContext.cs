using System.Reflection;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Domain.Common;
using SpendLogV2.Domain.Entities;

namespace SpendLogV2.Infrastructure.Data;

public class SpendLogDbContext : IdentityDbContext<AppUser>, IAppDbContext
{
    private readonly ICurrentUserService _currentUserService;

    public SpendLogDbContext(
        DbContextOptions<SpendLogDbContext> options,
        ICurrentUserService currentUserService) : base(options)
    {
        _currentUserService = currentUserService;
    }

    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Transfer> Transfers => Set<Transfer>();
    public DbSet<CreditCardExpense> CreditCardExpenses => Set<CreditCardExpense>();
    public DbSet<PortfolioItem> PortfolioItems => Set<PortfolioItem>();
    public DbSet<PortfolioSnapshot> PortfolioSnapshots => Set<PortfolioSnapshot>();
    public DbSet<PaymentPlan> PaymentPlans => Set<PaymentPlan>();
    public DbSet<Tracker> Trackers => Set<Tracker>();
    public DbSet<TrackerItem> TrackerItems => Set<TrackerItem>();
    public DbSet<FuelLog> FuelLogs => Set<FuelLog>();
    public DbSet<TelegramRule> TelegramRules => Set<TelegramRule>();
    public DbSet<SchedulerJobSetting> SchedulerJobSettings => Set<SchedulerJobSetting>();
    public DbSet<PriceAlert> PriceAlerts => Set<PriceAlert>();
    public DbSet<StrategyBasket> StrategyBaskets => Set<StrategyBasket>();
    public DbSet<StrategyBasketItem> StrategyBasketItems => Set<StrategyBasketItem>();
    public DbSet<SecurityAuditLog> SecurityAuditLogs => Set<SecurityAuditLog>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Global Query Filters (Strict Multi-Tenant User Isolation & Soft Delete)
        builder.Entity<Account>().HasQueryFilter(e => !e.IsDeleted && (!string.IsNullOrEmpty(_currentUserService.UserId) && e.UserId == _currentUserService.UserId));
        builder.Entity<Category>().HasQueryFilter(e => !e.IsDeleted && (!string.IsNullOrEmpty(_currentUserService.UserId) && e.UserId == _currentUserService.UserId));
        builder.Entity<Transaction>().HasQueryFilter(e => !e.IsDeleted && (!string.IsNullOrEmpty(_currentUserService.UserId) && e.UserId == _currentUserService.UserId));
        builder.Entity<Transfer>().HasQueryFilter(e => !e.IsDeleted && (!string.IsNullOrEmpty(_currentUserService.UserId) && e.UserId == _currentUserService.UserId));
        builder.Entity<CreditCardExpense>().HasQueryFilter(e => !e.IsDeleted && (!string.IsNullOrEmpty(_currentUserService.UserId) && e.UserId == _currentUserService.UserId));
        builder.Entity<PortfolioItem>().HasQueryFilter(e => !e.IsDeleted && (!string.IsNullOrEmpty(_currentUserService.UserId) && e.UserId == _currentUserService.UserId));
        builder.Entity<PortfolioSnapshot>().HasQueryFilter(e => !e.IsDeleted && (!string.IsNullOrEmpty(_currentUserService.UserId) && e.UserId == _currentUserService.UserId));
        builder.Entity<PaymentPlan>().HasQueryFilter(e => !e.IsDeleted && (!string.IsNullOrEmpty(_currentUserService.UserId) && e.UserId == _currentUserService.UserId));
        builder.Entity<Tracker>().HasQueryFilter(e => !e.IsDeleted && (!string.IsNullOrEmpty(_currentUserService.UserId) && e.UserId == _currentUserService.UserId));
        builder.Entity<TrackerItem>().HasQueryFilter(e => !e.IsDeleted && (!string.IsNullOrEmpty(_currentUserService.UserId) && e.UserId == _currentUserService.UserId));
        builder.Entity<FuelLog>().HasQueryFilter(e => !e.IsDeleted && (!string.IsNullOrEmpty(_currentUserService.UserId) && e.UserId == _currentUserService.UserId));
        builder.Entity<TelegramRule>().HasQueryFilter(e => !e.IsDeleted && (!string.IsNullOrEmpty(_currentUserService.UserId) && e.UserId == _currentUserService.UserId));
        builder.Entity<SchedulerJobSetting>().HasQueryFilter(e => !e.IsDeleted && (!string.IsNullOrEmpty(_currentUserService.UserId) && e.UserId == _currentUserService.UserId));
        builder.Entity<PriceAlert>().HasQueryFilter(e => !e.IsDeleted && (!string.IsNullOrEmpty(_currentUserService.UserId) && e.UserId == _currentUserService.UserId));
        builder.Entity<StrategyBasket>().HasQueryFilter(e => !e.IsDeleted && (!string.IsNullOrEmpty(_currentUserService.UserId) && e.UserId == _currentUserService.UserId));
        builder.Entity<StrategyBasketItem>().HasQueryFilter(e => !e.IsDeleted && (!string.IsNullOrEmpty(_currentUserService.UserId) && e.UserId == _currentUserService.UserId));

        // Precision Konfigürasyonları
        builder.Entity<PriceAlert>().Property(p => p.TargetPrice).HasColumnType("decimal(18,4)");
        builder.Entity<PriceAlert>().Property(p => p.TriggeredPrice).HasColumnType("decimal(18,4)");
        builder.Entity<StrategyBasketItem>().Property(p => p.Quantity).HasColumnType("decimal(18,8)");
        builder.Entity<StrategyBasketItem>().Property(p => p.CurrentPrice).HasColumnType("decimal(18,4)");
        builder.Entity<StrategyBasketItem>().Property(p => p.TargetPrice).HasColumnType("decimal(18,4)");
        builder.Entity<StrategyBasketItem>().Property(p => p.TargetProfitPercent).HasColumnType("decimal(18,4)");

        // Precision Konfigürasyonları
        // Account
        builder.Entity<Account>().Property(a => a.InitialBalance).HasColumnType("decimal(18,2)");
        builder.Entity<Account>().Property(a => a.CurrentBalance).HasColumnType("decimal(18,2)");

        // FuelLog
        builder.Entity<FuelLog>().Property(f => f.Tutar).HasColumnType("decimal(18,2)");
        builder.Entity<FuelLog>().Property(f => f.LitreFiyat).HasColumnType("decimal(18,3)");
        builder.Entity<FuelLog>().Property(f => f.MiktarLitre).HasColumnType("decimal(18,3)");
        builder.Entity<FuelLog>().Property(f => f.OrtalamaTuketimLt).HasColumnType("decimal(18,3)");
        builder.Entity<FuelLog>().Property(f => f.OrtalamaTuketimTL).HasColumnType("decimal(18,3)");

        // Transaction & Transfer
        builder.Entity<Transaction>().Property(t => t.Amount).HasColumnType("decimal(18,2)");
        builder.Entity<Transfer>().Property(t => t.Amount).HasColumnType("decimal(18,2)");
        builder.Entity<Transfer>().Property(t => t.Fee).HasColumnType("decimal(18,2)");

        // Transfer İlişkileri (Çift Account foreign key restrict)
        builder.Entity<Transfer>()
            .HasOne(t => t.FromAccount)
            .WithMany(a => a.FromTransfers)
            .HasForeignKey(t => t.FromAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<Transfer>()
            .HasOne(t => t.ToAccount)
            .WithMany(a => a.ToTransfers)
            .HasForeignKey(t => t.ToAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        // Transaction Category Relations
        builder.Entity<Transaction>()
            .HasOne(t => t.Category)
            .WithMany(cat => cat.Transactions)
            .HasForeignKey(t => t.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<Transaction>()
            .HasOne(t => t.SubCategory)
            .WithMany()
            .HasForeignKey(t => t.SubCategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        // CreditCardExpense Category Relations
        builder.Entity<CreditCardExpense>()
            .HasOne(c => c.CategoryRef)
            .WithMany(cat => cat.CreditCardExpenses)
            .HasForeignKey(c => c.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<CreditCardExpense>()
            .HasOne(c => c.SubCategoryRef)
            .WithMany()
            .HasForeignKey(c => c.SubCategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        // Category Self-Referencing (Parent - SubCategory)
        builder.Entity<Category>()
            .HasOne(c => c.ParentCategory)
            .WithMany(c => c.SubCategories)
            .HasForeignKey(c => c.ParentCategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        // PortfolioItem (Hassas finansal miktar ve birim fiyat)
        builder.Entity<PortfolioItem>().Property(p => p.Quantity).HasColumnType("decimal(18,8)");
        builder.Entity<PortfolioItem>().Property(p => p.PurchasePrice).HasColumnType("decimal(18,8)");
        builder.Entity<PortfolioItem>().Property(p => p.CurrentPrice).HasColumnType("decimal(18,8)");
        builder.Entity<PortfolioItem>().Property(p => p.TargetPrice).HasColumnType("decimal(18,8)");
        builder.Entity<PortfolioItem>().Property(p => p.SalePrice).HasColumnType("decimal(18,8)");
        builder.Entity<PortfolioItem>().Property(p => p.PurchaseCommission).HasColumnType("decimal(18,2)");
        builder.Entity<PortfolioItem>().Property(p => p.SaleCommission).HasColumnType("decimal(18,2)");

        // PortfolioSnapshot
        builder.Entity<PortfolioSnapshot>().Property(s => s.TotalValueTRY).HasColumnType("decimal(18,2)");
        builder.Entity<PortfolioSnapshot>().Property(s => s.TotalValueUSD).HasColumnType("decimal(18,2)");
        builder.Entity<PortfolioSnapshot>().Property(s => s.StockValueTRY).HasColumnType("decimal(18,2)");
        builder.Entity<PortfolioSnapshot>().Property(s => s.CryptoValueTRY).HasColumnType("decimal(18,2)");
        builder.Entity<PortfolioSnapshot>().Property(s => s.CommodityValueTRY).HasColumnType("decimal(18,2)");
        builder.Entity<PortfolioSnapshot>().Property(s => s.ETFValueTRY).HasColumnType("decimal(18,2)");
        builder.Entity<PortfolioSnapshot>().Property(s => s.BondValueTRY).HasColumnType("decimal(18,2)");
        builder.Entity<PortfolioSnapshot>().Property(s => s.ExchangeRate).HasColumnType("decimal(18,4)");

        // CreditCardExpense
        builder.Entity<CreditCardExpense>().Property(c => c.Tutar).HasColumnType("decimal(18,2)");
        builder.Entity<CreditCardExpense>().Property(c => c.PeriodDebt).HasColumnType("decimal(18,2)");
        builder.Entity<CreditCardExpense>().Property(c => c.MinimumPayment).HasColumnType("decimal(18,2)");
        builder.Entity<CreditCardExpense>().Property(c => c.CardLimit).HasColumnType("decimal(18,2)");
        builder.Entity<CreditCardExpense>().Property(c => c.AvailableLimit).HasColumnType("decimal(18,2)");

        // PaymentPlan & Tracker
        builder.Entity<PaymentPlan>().Property(p => p.Amount).HasColumnType("decimal(18,2)");
        builder.Entity<Tracker>().Property(t => t.TargetAmount).HasColumnType("decimal(18,2)");
        builder.Entity<Tracker>().Property(t => t.CurrentAmount).HasColumnType("decimal(18,2)");

        // Security & Performance Indices
        builder.Entity<AppUser>().HasIndex(u => u.RefreshToken);
        builder.Entity<AppUser>().HasIndex(u => u.PreviousRefreshToken);
        builder.Entity<SecurityAuditLog>().HasIndex(l => l.Email);
        builder.Entity<SecurityAuditLog>().HasIndex(l => l.Timestamp);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    if (string.IsNullOrEmpty(entry.Entity.UserId) && !string.IsNullOrEmpty(_currentUserService.UserId))
                    {
                        entry.Entity.UserId = _currentUserService.UserId;
                    }
                    entry.Entity.CreatedAt = DateTime.UtcNow;
                    break;

                case EntityState.Modified:
                    entry.Entity.UpdatedAt = DateTime.UtcNow;
                    break;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}
