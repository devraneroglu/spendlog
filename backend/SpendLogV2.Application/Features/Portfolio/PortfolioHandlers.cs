using MediatR;
using Microsoft.EntityFrameworkCore;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Domain.Entities;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Application.Features.Portfolio;

public record PortfolioItemDto(
    int Id,
    string Symbol,
    string Name,
    AssetType AssetType,
    Currency Currency,
    decimal Quantity,
    decimal PurchasePrice,
    decimal CurrentPrice,
    DateTime PurchaseDate,
    string? Platform,
    string? Notes,
    bool IsActive,
    decimal? TargetPrice,
    decimal? SalePrice,
    DateTime? SaleDate,
    decimal Cost,
    decimal CurrentValue,
    decimal ProfitLoss,
    decimal ProfitLossPercent);

public record PortfolioSummaryDto(
    decimal TotalCostTRY,
    decimal TotalCurrentValueTRY,
    decimal TotalProfitLossTRY,
    decimal TotalProfitLossPercent,
    decimal TotalCostUSD,
    decimal TotalCurrentValueUSD,
    decimal TotalProfitLossUSD,
    decimal TotalRealizedProfitLossTRY,
    int ActiveItemsCount,
    int SoldItemsCount);

public record DistributionItemDto(
    string Name,
    decimal Value,
    decimal Percentage,
    string Color);

public record PortfolioDistributionDto(
    List<DistributionItemDto> ByAssetType,
    List<DistributionItemDto> ByPlatform,
    decimal TotalValueTRY);

public record PortfolioSnapshotDto(
    int Id,
    DateTime SnapshotDate,
    decimal TotalValueTRY,
    decimal TotalValueUSD,
    decimal StockValueTRY,
    decimal CryptoValueTRY,
    decimal CommodityValueTRY,
    decimal ETFValueTRY,
    decimal BondValueTRY,
    decimal ExchangeRate);

public record GetPortfolioItemsQuery(bool? IsActive = null, AssetType? AssetType = null, string? Platform = null) : IRequest<List<PortfolioItemDto>>;

public class GetPortfolioItemsQueryHandler : IRequestHandler<GetPortfolioItemsQuery, List<PortfolioItemDto>>
{
    private readonly IAppDbContext _context;

    public GetPortfolioItemsQueryHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<List<PortfolioItemDto>> Handle(GetPortfolioItemsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.PortfolioItems.AsQueryable();

        if (request.IsActive.HasValue)
            query = query.Where(p => p.IsActive == request.IsActive.Value);

        if (request.AssetType.HasValue)
            query = query.Where(p => p.AssetType == request.AssetType.Value);

        if (!string.IsNullOrWhiteSpace(request.Platform))
            query = query.Where(p => p.Platform == request.Platform);

        var items = await query
            .OrderByDescending(p => p.IsActive)
            .ThenByDescending(p => p.Id)
            .ToListAsync(cancellationToken);

        return items.Select(p => new PortfolioItemDto(
            p.Id,
            p.Symbol,
            p.Name,
            p.AssetType,
            p.Currency,
            p.Quantity,
            p.PurchasePrice,
            p.CurrentPrice,
            p.PurchaseDate,
            p.Platform,
            p.Notes,
            p.IsActive,
            p.TargetPrice,
            p.SalePrice,
            p.SaleDate,
            p.Cost,
            p.CurrentValue,
            p.ProfitLoss,
            p.ProfitLossPercent)).ToList();
    }
}

public record GetPortfolioSummaryQuery(decimal UsdToTryRate = 45.00m) : IRequest<PortfolioSummaryDto>;

public class GetPortfolioSummaryQueryHandler : IRequestHandler<GetPortfolioSummaryQuery, PortfolioSummaryDto>
{
    private readonly IAppDbContext _context;

    public GetPortfolioSummaryQueryHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<PortfolioSummaryDto> Handle(GetPortfolioSummaryQuery request, CancellationToken cancellationToken)
    {
        var items = await _context.PortfolioItems.ToListAsync(cancellationToken);
        var activeItems = items.Where(p => p.IsActive).ToList();
        var soldItems = items.Where(p => !p.IsActive).ToList();

        decimal rate = request.UsdToTryRate > 0 ? request.UsdToTryRate : 45.00m;

        decimal totalCostTRY = 0;
        decimal totalCurrentValueTRY = 0;
        decimal totalRealizedTRY = 0;

        foreach (var item in activeItems)
        {
            decimal itemCost = item.Cost;
            decimal itemVal = item.CurrentValue;

            if (item.Currency == Currency.USD)
            {
                itemCost *= rate;
                itemVal *= rate;
            }
            else if (item.Currency == Currency.EUR)
            {
                itemCost *= (rate * 1.08m);
                itemVal *= (rate * 1.08m);
            }

            totalCostTRY += itemCost;
            totalCurrentValueTRY += itemVal;
        }

        foreach (var s in soldItems)
        {
            decimal pLoss = s.ProfitLoss;
            if (s.Currency == Currency.USD) pLoss *= rate;
            else if (s.Currency == Currency.EUR) pLoss *= (rate * 1.08m);
            totalRealizedTRY += pLoss;
        }

        decimal totalProfitLossTRY = totalCurrentValueTRY - totalCostTRY;
        decimal totalProfitLossPercent = totalCostTRY > 0 ? (totalProfitLossTRY / totalCostTRY) * 100 : 0;

        decimal totalCostUSD = totalCostTRY / rate;
        decimal totalCurrentValueUSD = totalCurrentValueTRY / rate;
        decimal totalProfitLossUSD = totalProfitLossTRY / rate;

        return new PortfolioSummaryDto(
            totalCostTRY,
            totalCurrentValueTRY,
            totalProfitLossTRY,
            totalProfitLossPercent,
            totalCostUSD,
            totalCurrentValueUSD,
            totalProfitLossUSD,
            totalRealizedTRY,
            activeItems.Count,
            soldItems.Count);
    }
}

public record GetPortfolioDistributionQuery(decimal UsdToTryRate = 45.00m) : IRequest<PortfolioDistributionDto>;

public class GetPortfolioDistributionQueryHandler : IRequestHandler<GetPortfolioDistributionQuery, PortfolioDistributionDto>
{
    private readonly IAppDbContext _context;

    public GetPortfolioDistributionQueryHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<PortfolioDistributionDto> Handle(GetPortfolioDistributionQuery request, CancellationToken cancellationToken)
    {
        var activeItems = await _context.PortfolioItems.Where(p => p.IsActive).ToListAsync(cancellationToken);

        decimal ToTRY(PortfolioItem item)
        {
            return item.Currency switch
            {
                Currency.USD => item.CurrentValue * request.UsdToTryRate,
                Currency.EUR => item.CurrentValue * (request.UsdToTryRate * 1.08m),
                _ => item.CurrentValue
            };
        }

        var totalTRY = activeItems.Sum(p => ToTRY(p));

        var assetTypeColors = new Dictionary<AssetType, string>
        {
            { AssetType.Stock, "#6366f1" },
            { AssetType.Crypto, "#f59e0b" },
            { AssetType.Commodity, "#10b981" },
            { AssetType.ETF, "#8b5cf6" },
            { AssetType.Bond, "#ef4444" }
        };

        string GetAssetTypeLabel(AssetType type) => type switch
        {
            AssetType.Stock => "Hisse Senedi",
            AssetType.Crypto => "Kripto Para",
            AssetType.Commodity => "Altın & Emtia",
            AssetType.ETF => "Yatırım Fonu (ETF)",
            AssetType.Bond => "Tahvil & Bono",
            _ => "Diğer"
        };

        var byAssetType = activeItems
            .GroupBy(p => p.AssetType)
            .Select(g =>
            {
                var val = g.Sum(p => ToTRY(p));
                return new DistributionItemDto(
                    GetAssetTypeLabel(g.Key),
                    val,
                    totalTRY > 0 ? (val / totalTRY) * 100 : 0,
                    assetTypeColors.GetValueOrDefault(g.Key, "#94a3b8"));
            })
            .OrderByDescending(x => x.Value)
            .ToList();

        var platformColors = new[] { "#3b82f6", "#22c55e", "#eab308", "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#a855f7" };

        var byPlatform = activeItems
            .GroupBy(p => string.IsNullOrWhiteSpace(p.Platform) ? "Fiziki / Diğer" : p.Platform.Trim())
            .Select((g, idx) =>
            {
                var val = g.Sum(p => ToTRY(p));
                return new DistributionItemDto(
                    g.Key,
                    val,
                    totalTRY > 0 ? (val / totalTRY) * 100 : 0,
                    platformColors[idx % platformColors.Length]);
            })
            .OrderByDescending(x => x.Value)
            .ToList();

        return new PortfolioDistributionDto(byAssetType, byPlatform, totalTRY);
    }
}

public record GetPortfolioSnapshotsQuery(DateTime? FromDate = null, DateTime? ToDate = null) : IRequest<List<PortfolioSnapshotDto>>;

public class GetPortfolioSnapshotsQueryHandler : IRequestHandler<GetPortfolioSnapshotsQuery, List<PortfolioSnapshotDto>>
{
    private readonly IAppDbContext _context;

    public GetPortfolioSnapshotsQueryHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<List<PortfolioSnapshotDto>> Handle(GetPortfolioSnapshotsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.PortfolioSnapshots.AsQueryable();

        if (request.FromDate.HasValue)
            query = query.Where(s => s.SnapshotDate >= request.FromDate.Value);

        if (request.ToDate.HasValue)
            query = query.Where(s => s.SnapshotDate <= request.ToDate.Value);

        var items = await query.OrderBy(s => s.SnapshotDate).ToListAsync(cancellationToken);

        return items.Select(s => new PortfolioSnapshotDto(
            s.Id,
            s.SnapshotDate,
            s.TotalValueTRY,
            s.TotalValueUSD,
            s.StockValueTRY,
            s.CryptoValueTRY,
            s.CommodityValueTRY,
            s.ETFValueTRY,
            s.BondValueTRY,
            s.ExchangeRate)).ToList();
    }
}

public record CreatePortfolioItemCommand(
    string Symbol,
    string Name,
    AssetType AssetType,
    Currency Currency,
    decimal Quantity,
    decimal PurchasePrice,
    decimal CurrentPrice,
    DateTime PurchaseDate,
    string? Platform,
    string? Notes,
    decimal? TargetPrice) : IRequest<PortfolioItemDto>;

public class CreatePortfolioItemCommandHandler : IRequestHandler<CreatePortfolioItemCommand, PortfolioItemDto>
{
    private readonly IAppDbContext _context;

    public CreatePortfolioItemCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<PortfolioItemDto> Handle(CreatePortfolioItemCommand request, CancellationToken cancellationToken)
    {
        var item = new PortfolioItem
        {
            Symbol = request.Symbol.ToUpper(),
            Name = string.IsNullOrWhiteSpace(request.Name) ? request.Symbol.ToUpper() : request.Name,
            AssetType = request.AssetType,
            Currency = request.Currency,
            Quantity = request.Quantity,
            PurchasePrice = request.PurchasePrice,
            CurrentPrice = request.CurrentPrice > 0 ? request.CurrentPrice : request.PurchasePrice,
            PurchaseDate = request.PurchaseDate,
            Platform = request.Platform,
            Notes = request.Notes,
            TargetPrice = request.TargetPrice,
            IsActive = true
        };

        _context.PortfolioItems.Add(item);
        await _context.SaveChangesAsync(cancellationToken);

        return new PortfolioItemDto(
            item.Id,
            item.Symbol,
            item.Name,
            item.AssetType,
            item.Currency,
            item.Quantity,
            item.PurchasePrice,
            item.CurrentPrice,
            item.PurchaseDate,
            item.Platform,
            item.Notes,
            item.IsActive,
            item.TargetPrice,
            item.SalePrice,
            item.SaleDate,
            item.Cost,
            item.CurrentValue,
            item.ProfitLoss,
            item.ProfitLossPercent);
    }
}

public record UpdatePortfolioItemCommand(
    int Id,
    string Symbol,
    string Name,
    AssetType AssetType,
    Currency Currency,
    decimal Quantity,
    decimal PurchasePrice,
    decimal CurrentPrice,
    DateTime PurchaseDate,
    string? Platform,
    string? Notes,
    decimal? TargetPrice) : IRequest<bool>;

public class UpdatePortfolioItemCommandHandler : IRequestHandler<UpdatePortfolioItemCommand, bool>
{
    private readonly IAppDbContext _context;

    public UpdatePortfolioItemCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(UpdatePortfolioItemCommand request, CancellationToken cancellationToken)
    {
        var item = await _context.PortfolioItems.FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);
        if (item == null) return false;

        item.Symbol = request.Symbol.ToUpper();
        item.Name = string.IsNullOrWhiteSpace(request.Name) ? request.Symbol.ToUpper() : request.Name;
        item.AssetType = request.AssetType;
        item.Currency = request.Currency;
        item.Quantity = request.Quantity;
        item.PurchasePrice = request.PurchasePrice;
        if (request.CurrentPrice > 0) item.CurrentPrice = request.CurrentPrice;
        item.PurchaseDate = request.PurchaseDate;
        item.Platform = request.Platform;
        item.Notes = request.Notes;
        item.TargetPrice = request.TargetPrice;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public record SymbolPriceUpdateDto(string Symbol, decimal Price);

public record BatchUpdatePortfolioPricesCommand(List<SymbolPriceUpdateDto> Prices, decimal UsdToTryRate = 34.50m) : IRequest<int>;

public class BatchUpdatePortfolioPricesCommandHandler : IRequestHandler<BatchUpdatePortfolioPricesCommand, int>
{
    private readonly IAppDbContext _context;
    private readonly PriceAlerts.PriceAlertEvaluator _priceAlertEvaluator;
    private readonly ITelegramNotificationService _telegramNotificationService;

    public BatchUpdatePortfolioPricesCommandHandler(
        IAppDbContext context,
        PriceAlerts.PriceAlertEvaluator priceAlertEvaluator,
        ITelegramNotificationService telegramNotificationService)
    {
        _context = context;
        _priceAlertEvaluator = priceAlertEvaluator;
        _telegramNotificationService = telegramNotificationService;
    }

    public async Task<int> Handle(BatchUpdatePortfolioPricesCommand request, CancellationToken cancellationToken)
    {
        var priceMap = request.Prices != null && request.Prices.Any()
            ? request.Prices
                .Where(p => p.Price > 0)
                .GroupBy(p => p.Symbol.ToUpper().Trim())
                .ToDictionary(g => g.Key, g => g.First().Price)
            : new Dictionary<string, decimal>();

        var activeItems = await _context.PortfolioItems.Where(p => p.IsActive).ToListAsync(cancellationToken);
        int updatedCount = 0;
        decimal rate = request.UsdToTryRate > 0 ? request.UsdToTryRate : 45.00m;

        // 1. Sembol Bazlı Konsolidasyon (Tüm aktif varlıkları tek bir satır halinde birleştir)
        var symbolSummaries = activeItems
            .GroupBy(i => i.Symbol.ToUpper().Trim())
            .Select(g =>
            {
                var sym = g.Key;
                var first = g.First();
                decimal totalQty = g.Sum(x => x.Quantity);
                decimal oldPrice = first.CurrentPrice;
                decimal newPrice = priceMap.TryGetValue(sym, out var np) && np > 0 ? np : oldPrice;
                decimal changePct = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100m : 0m;

                decimal itemMultiplier = first.Currency == Currency.USD ? rate : (first.Currency == Currency.EUR ? rate * 1.08m : 1.0m);
                decimal oldValTRY = g.Sum(x => x.Quantity * oldPrice * itemMultiplier);
                decimal newValTRY = g.Sum(x => x.Quantity * newPrice * itemMultiplier);
                decimal tlImpact = newValTRY - oldValTRY;

                return new
                {
                    Symbol = sym,
                    Name = first.Name,
                    Currency = first.Currency,
                    TotalQuantity = totalQty,
                    OldPrice = oldPrice,
                    NewPrice = newPrice,
                    ChangePercent = changePct,
                    TlImpact = tlImpact,
                    CurrentValueTRY = newValTRY,
                    PreviousValueTRY = oldValTRY
                };
            })
            .OrderByDescending(x => x.CurrentValueTRY) // Portföy büyüklüğüne göre sırala
            .ToList();

        // 2. Fiyatları Güncelle
        foreach (var item in activeItems)
        {
            var cleanSymbol = item.Symbol.ToUpper().Trim();
            if (priceMap.TryGetValue(cleanSymbol, out var newPrice) && newPrice > 0)
            {
                item.CurrentPrice = newPrice;
                updatedCount++;
            }
        }

        if (activeItems.Any())
        {
            decimal totalTRY = symbolSummaries.Sum(s => s.CurrentValueTRY);
            decimal previousTotalTRY = symbolSummaries.Sum(s => s.PreviousValueTRY);
            decimal netDiffTRY = totalTRY - previousTotalTRY;
            decimal netDiffPercent = previousTotalTRY > 0 ? (netDiffTRY / previousTotalTRY) * 100m : 0m;
            decimal totalUSD = rate > 0 ? totalTRY / rate : 0;

            decimal stockTRY = activeItems.Where(i => i.AssetType == AssetType.Stock).Sum(i => i.CurrentValue * (i.Currency == Currency.USD ? rate : (i.Currency == Currency.EUR ? rate * 1.08m : 1.0m)));
            decimal cryptoTRY = activeItems.Where(i => i.AssetType == AssetType.Crypto).Sum(i => i.CurrentValue * (i.Currency == Currency.USD ? rate : (i.Currency == Currency.EUR ? rate * 1.08m : 1.0m)));
            decimal commodityTRY = activeItems.Where(i => i.AssetType == AssetType.Commodity).Sum(i => i.CurrentValue * (i.Currency == Currency.USD ? rate : (i.Currency == Currency.EUR ? rate * 1.08m : 1.0m)));
            decimal etfTRY = activeItems.Where(i => i.AssetType == AssetType.ETF).Sum(i => i.CurrentValue * (i.Currency == Currency.USD ? rate : (i.Currency == Currency.EUR ? rate * 1.08m : 1.0m)));
            decimal bondTRY = activeItems.Where(i => i.AssetType == AssetType.Bond).Sum(i => i.CurrentValue * (i.Currency == Currency.USD ? rate : (i.Currency == Currency.EUR ? rate * 1.08m : 1.0m)));

            var snapshot = new PortfolioSnapshot
            {
                SnapshotDate = DateTime.UtcNow,
                TotalValueTRY = totalTRY,
                TotalValueUSD = totalUSD,
                StockValueTRY = stockTRY,
                CryptoValueTRY = cryptoTRY,
                CommodityValueTRY = commodityTRY,
                ETFValueTRY = etfTRY,
                BondValueTRY = bondTRY,
                ExchangeRate = rate,
                ActiveItemsCount = activeItems.Count
            };

            _context.PortfolioSnapshots.Add(snapshot);
            await _context.SaveChangesAsync(cancellationToken);

            // 📱 TELEGRAM BİLDİRİMİ (SEMBOL BAZLI KONSOLİDE ASCII TABLOSU)
            if (_context is DbContext dbCtx)
            {
                try
                {
                    var activeUser = await dbCtx.Set<AppUser>()
                        .AsNoTracking()
                        .FirstOrDefaultAsync(u => u.TelegramChatId != null && u.IsTelegramActive, cancellationToken);

                    if (activeUser != null && activeUser.TelegramChatId.HasValue)
                    {
                        var reportMsg = BuildAsciiPortfolioReport(
                            rate,
                            previousTotalTRY,
                            totalTRY,
                            netDiffTRY,
                            netDiffPercent,
                            symbolSummaries);

                        await _telegramNotificationService.SendMessageAsync(activeUser.TelegramChatId.Value, reportMsg, cancellationToken);
                    }
                }
                catch
                {
                    // Telegram bildirim hatası ana fiyat güncelleme akışını engellememeli
                }
            }
        }

        // Fiyat Alarmlarını Değerlendir ve Koşulu Sağlananlar İçin Telegram Bildirimi Gönder
        if (priceMap.Any())
        {
            await _priceAlertEvaluator.EvaluateAlertsAsync(priceMap, cancellationToken);
        }

        return updatedCount;
    }

    private static string BuildAsciiPortfolioReport(
        decimal rate,
        decimal previousTotalTRY,
        decimal currentTotalTRY,
        decimal netDiffTRY,
        decimal netDiffPercent,
        IEnumerable<dynamic> symbolSummaries)
    {
        decimal previousTotalUSD = rate > 0 ? previousTotalTRY / rate : 0;
        decimal currentTotalUSD = rate > 0 ? currentTotalTRY / rate : 0;

        var sb = new System.Text.StringBuilder();
        sb.AppendLine("📊 *PORTFÖY GÜNCELLEME RAPORU*");
        sb.AppendLine($"📅 `{DateTime.Now:dd.MM.yyyy HH:mm}` | 💵 *USD/TL:* `{rate:N2} ₺`");
        sb.AppendLine($"💰 *Toplam Değer:* `{currentTotalTRY:N0} ₺` (`${currentTotalUSD:N2}`)\n");

        sb.AppendLine("```text");
        sb.AppendLine(string.Format("{0,-7} {1,7} {2,7} {3,7} {4,10}", "SEMBOL", "ESKİ", "YENİ", "FARK", "ETKİ(TL)"));
        sb.AppendLine(new string('─', 42));

        foreach (var it in symbolSummaries)
        {
            string sym = ((string)it.Symbol).Length > 7 ? ((string)it.Symbol).Substring(0, 7) : (string)it.Symbol;
            string oldP = FormatCompactPrice((decimal)it.OldPrice, (Currency)it.Currency);
            string newP = FormatCompactPrice((decimal)it.NewPrice, (Currency)it.Currency);
            decimal chg = (decimal)it.ChangePercent;
            string diffPct = (chg > 0 ? "+" : "") + chg.ToString("0.0") + "%";
            decimal imp = (decimal)it.TlImpact;
            string impact = (imp > 0 ? "+" : "") + imp.ToString("N0") + " ₺";

            sb.AppendLine(string.Format("{0,-7} {1,7} {2,7} {3,7} {4,10}", sym, oldP, newP, diffPct, impact));
        }

        sb.AppendLine(new string('─', 42));
        string diffSign = netDiffTRY >= 0 ? "+" : "";
        sb.AppendLine($"Önceki : {previousTotalTRY:N0} ₺ (${previousTotalUSD:N0})");
        sb.AppendLine($"Güncel : {currentTotalTRY:N0} ₺ (${currentTotalUSD:N0})");
        sb.AppendLine($"Değişim: {diffSign}{netDiffTRY:N0} ₺ ({diffSign}{netDiffPercent:0.00}%)");
        sb.AppendLine("```");

        return sb.ToString();
    }

    private static string FormatCompactPrice(decimal price, Currency currency)
    {
        string sym = currency == Currency.USD ? "$" : currency == Currency.EUR ? "€" : "";
        if (price >= 10000)
        {
            return $"{(price / 1000m):0.0}k{sym}";
        }
        if (price >= 1000)
        {
            return $"{price:0}{sym}";
        }
        return $"{price:0.0}{sym}";
    }
}

public record SellPortfolioItemCommand(
    int Id,
    decimal SalePrice,
    DateTime SaleDate,
    string? Notes) : IRequest<bool>;

public class SellPortfolioItemCommandHandler : IRequestHandler<SellPortfolioItemCommand, bool>
{
    private readonly IAppDbContext _context;

    public SellPortfolioItemCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(SellPortfolioItemCommand request, CancellationToken cancellationToken)
    {
        var item = await _context.PortfolioItems.FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);
        if (item == null) return false;

        item.SalePrice = request.SalePrice;
        item.SaleDate = request.SaleDate;
        item.CurrentPrice = request.SalePrice;
        item.IsActive = false;
        if (!string.IsNullOrWhiteSpace(request.Notes))
        {
            item.Notes = string.IsNullOrWhiteSpace(item.Notes) ? request.Notes : $"{item.Notes} | {request.Notes}";
        }

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public record DeletePortfolioItemCommand(int Id) : IRequest<bool>;

public class DeletePortfolioItemCommandHandler : IRequestHandler<DeletePortfolioItemCommand, bool>
{
    private readonly IAppDbContext _context;

    public DeletePortfolioItemCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeletePortfolioItemCommand request, CancellationToken cancellationToken)
    {
        var item = await _context.PortfolioItems.FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);
        if (item == null) return false;

        item.IsDeleted = true;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public record DeletePortfolioSnapshotCommand(int Id) : IRequest<bool>;

public class DeletePortfolioSnapshotCommandHandler : IRequestHandler<DeletePortfolioSnapshotCommand, bool>
{
    private readonly IAppDbContext _context;

    public DeletePortfolioSnapshotCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeletePortfolioSnapshotCommand request, CancellationToken cancellationToken)
    {
        var snapshot = await _context.PortfolioSnapshots.FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);
        if (snapshot == null) return false;

        snapshot.IsDeleted = true;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public record ClearAllPortfolioSnapshotsCommand : IRequest<int>;

public class ClearAllPortfolioSnapshotsCommandHandler : IRequestHandler<ClearAllPortfolioSnapshotsCommand, int>
{
    private readonly IAppDbContext _context;

    public ClearAllPortfolioSnapshotsCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<int> Handle(ClearAllPortfolioSnapshotsCommand request, CancellationToken cancellationToken)
    {
        var snapshots = await _context.PortfolioSnapshots.ToListAsync(cancellationToken);
        if (!snapshots.Any()) return 0;

        foreach (var s in snapshots)
        {
            s.IsDeleted = true;
        }

        await _context.SaveChangesAsync(cancellationToken);
        return snapshots.Count;
    }
}

public record BulkImportPortfolioItemDto(
    string Symbol,
    string Name,
    AssetType AssetType,
    Currency Currency,
    decimal Quantity,
    decimal PurchasePrice,
    decimal? CurrentPrice,
    DateTime PurchaseDate,
    string? Platform,
    string? Notes,
    bool IsActive = true,
    decimal? SalePrice = null,
    DateTime? SaleDate = null);

public record BulkImportPortfolioCommand(List<BulkImportPortfolioItemDto> Items) : IRequest<int>;

public class BulkImportPortfolioCommandHandler : IRequestHandler<BulkImportPortfolioCommand, int>
{
    private readonly IAppDbContext _context;

    public BulkImportPortfolioCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<int> Handle(BulkImportPortfolioCommand request, CancellationToken cancellationToken)
    {
        if (request.Items == null || request.Items.Count == 0) return 0;

        var entities = request.Items.Select(r => new PortfolioItem
        {
            Symbol = r.Symbol.ToUpper().Trim(),
            Name = string.IsNullOrWhiteSpace(r.Name) ? r.Symbol.ToUpper().Trim() : r.Name.Trim(),
            AssetType = r.AssetType,
            Currency = r.Currency,
            Quantity = r.Quantity,
            PurchasePrice = r.PurchasePrice,
            CurrentPrice = r.CurrentPrice.HasValue && r.CurrentPrice.Value > 0 ? r.CurrentPrice.Value : r.PurchasePrice,
            PurchaseDate = r.PurchaseDate,
            Platform = r.Platform?.Trim(),
            Notes = r.Notes?.Trim(),
            IsActive = r.IsActive,
            SalePrice = r.IsActive ? null : r.SalePrice,
            SaleDate = r.IsActive ? null : r.SaleDate
        }).ToList();

        _context.PortfolioItems.AddRange(entities);
        await _context.SaveChangesAsync(cancellationToken);

        return entities.Count;
    }
}
