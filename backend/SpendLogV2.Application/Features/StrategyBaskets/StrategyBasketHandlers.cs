using MediatR;
using Microsoft.EntityFrameworkCore;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Domain.Entities;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Application.Features.StrategyBaskets;

public record StrategyBasketItemDto(
    int Id,
    int StrategyBasketId,
    string Symbol,
    string Name,
    AssetType AssetType,
    Currency Currency,
    decimal Quantity,
    decimal CurrentPrice,
    decimal TargetPrice,
    decimal TargetProfitPercent,
    string? Platform,
    string? Notes,
    decimal RequiredCapital,
    decimal TargetValue,
    decimal TargetProfitLoss,
    decimal CalculatedProfitPercent);

public record StrategyBasketDto(
    int Id,
    string Name,
    string? Description,
    DateTime? TargetDate,
    bool IsArchived,
    DateTime CreatedAt,
    List<StrategyBasketItemDto> Items,
    decimal TotalRequiredCapitalTRY,
    decimal TotalTargetValueTRY,
    decimal TotalTargetProfitLossTRY,
    decimal TotalTargetProfitPercentTRY,
    decimal TotalRequiredCapitalUSD,
    decimal TotalTargetValueUSD,
    decimal TotalTargetProfitLossUSD);

// --- QUERIES ---

public record GetStrategyBasketsQuery(decimal UsdToTryRate = 48.00m) : IRequest<List<StrategyBasketDto>>;

public class GetStrategyBasketsQueryHandler : IRequestHandler<GetStrategyBasketsQuery, List<StrategyBasketDto>>
{
    private readonly IAppDbContext _context;

    public GetStrategyBasketsQueryHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<List<StrategyBasketDto>> Handle(GetStrategyBasketsQuery request, CancellationToken cancellationToken)
    {
        var baskets = await _context.StrategyBaskets
            .Include(b => b.Items)
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync(cancellationToken);

        decimal rate = request.UsdToTryRate > 0 ? request.UsdToTryRate : 48.00m;

        return baskets.Select(b =>
        {
            var itemDtos = b.Items.Select(i => new StrategyBasketItemDto(
                i.Id,
                i.StrategyBasketId,
                i.Symbol,
                i.Name,
                i.AssetType,
                i.Currency,
                i.Quantity,
                i.CurrentPrice,
                i.TargetPrice,
                i.TargetProfitPercent,
                i.Platform,
                i.Notes,
                i.RequiredCapital,
                i.TargetValue,
                i.TargetProfitLoss,
                i.CalculatedProfitPercent
            )).ToList();

            decimal totalCapitalTRY = 0;
            decimal totalTargetTRY = 0;

            foreach (var item in b.Items)
            {
                decimal capital = item.RequiredCapital;
                decimal target = item.TargetValue;

                if (item.Currency == Currency.USD)
                {
                    capital *= rate;
                    target *= rate;
                }
                else if (item.Currency == Currency.EUR)
                {
                    capital *= (rate * 1.08m);
                    target *= (rate * 1.08m);
                }

                totalCapitalTRY += capital;
                totalTargetTRY += target;
            }

            decimal totalProfitTRY = totalTargetTRY - totalCapitalTRY;
            decimal totalProfitPercentTRY = totalCapitalTRY > 0 ? (totalProfitTRY / totalCapitalTRY) * 100 : 0;

            decimal totalCapitalUSD = rate > 0 ? totalCapitalTRY / rate : 0;
            decimal totalTargetUSD = rate > 0 ? totalTargetTRY / rate : 0;
            decimal totalProfitUSD = totalTargetUSD - totalCapitalUSD;

            return new StrategyBasketDto(
                b.Id,
                b.Name,
                b.Description,
                b.TargetDate,
                b.IsArchived,
                b.CreatedAt,
                itemDtos,
                totalCapitalTRY,
                totalTargetTRY,
                totalProfitTRY,
                totalProfitPercentTRY,
                totalCapitalUSD,
                totalTargetUSD,
                totalProfitUSD
            );
        }).ToList();
    }
}

// --- COMMANDS ---

public record CreateStrategyBasketCommand(
    string Name,
    string? Description,
    DateTime? TargetDate) : IRequest<StrategyBasketDto>;

public class CreateStrategyBasketCommandHandler : IRequestHandler<CreateStrategyBasketCommand, StrategyBasketDto>
{
    private readonly IAppDbContext _context;

    public CreateStrategyBasketCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<StrategyBasketDto> Handle(CreateStrategyBasketCommand request, CancellationToken cancellationToken)
    {
        var basket = new StrategyBasket
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            TargetDate = request.TargetDate,
            IsArchived = false,
        };

        _context.StrategyBaskets.Add(basket);
        await _context.SaveChangesAsync(cancellationToken);

        return new StrategyBasketDto(
            basket.Id,
            basket.Name,
            basket.Description,
            basket.TargetDate,
            basket.IsArchived,
            basket.CreatedAt,
            new List<StrategyBasketItemDto>(),
            0, 0, 0, 0, 0, 0, 0
        );
    }
}

public record UpdateStrategyBasketCommand(
    int Id,
    string Name,
    string? Description,
    DateTime? TargetDate,
    bool IsArchived) : IRequest<bool>;

public class UpdateStrategyBasketCommandHandler : IRequestHandler<UpdateStrategyBasketCommand, bool>
{
    private readonly IAppDbContext _context;

    public UpdateStrategyBasketCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(UpdateStrategyBasketCommand request, CancellationToken cancellationToken)
    {
        var basket = await _context.StrategyBaskets.FirstOrDefaultAsync(b => b.Id == request.Id, cancellationToken);
        if (basket == null) return false;

        basket.Name = request.Name.Trim();
        basket.Description = request.Description?.Trim();
        basket.TargetDate = request.TargetDate;
        basket.IsArchived = request.IsArchived;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public record DeleteStrategyBasketCommand(int Id) : IRequest<bool>;

public class DeleteStrategyBasketCommandHandler : IRequestHandler<DeleteStrategyBasketCommand, bool>
{
    private readonly IAppDbContext _context;

    public DeleteStrategyBasketCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteStrategyBasketCommand request, CancellationToken cancellationToken)
    {
        var basket = await _context.StrategyBaskets
            .Include(b => b.Items)
            .FirstOrDefaultAsync(b => b.Id == request.Id, cancellationToken);

        if (basket == null) return false;

        basket.IsDeleted = true;
        foreach (var item in basket.Items)
        {
            item.IsDeleted = true;
        }

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public record AddOrUpdateBasketItemCommand(
    int? Id,
    int StrategyBasketId,
    string Symbol,
    string Name,
    AssetType AssetType,
    Currency Currency,
    decimal Quantity,
    decimal CurrentPrice,
    decimal TargetPrice,
    decimal TargetProfitPercent,
    string? Platform,
    string? Notes) : IRequest<StrategyBasketItemDto?>;

public class AddOrUpdateBasketItemCommandHandler : IRequestHandler<AddOrUpdateBasketItemCommand, StrategyBasketItemDto?>
{
    private readonly IAppDbContext _context;

    public AddOrUpdateBasketItemCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<StrategyBasketItemDto?> Handle(AddOrUpdateBasketItemCommand request, CancellationToken cancellationToken)
    {
        var basket = await _context.StrategyBaskets.FirstOrDefaultAsync(b => b.Id == request.StrategyBasketId, cancellationToken);
        if (basket == null) return null;

        StrategyBasketItem item;

        if (request.Id.HasValue && request.Id.Value > 0)
        {
            item = await _context.StrategyBasketItems.FirstOrDefaultAsync(i => i.Id == request.Id.Value, cancellationToken);
            if (item == null) return null;
        }
        else
        {
            item = new StrategyBasketItem
            {
                StrategyBasketId = request.StrategyBasketId,
            };
            _context.StrategyBasketItems.Add(item);
        }

        item.Symbol = request.Symbol.ToUpper().Trim();
        item.Name = string.IsNullOrWhiteSpace(request.Name) ? request.Symbol.ToUpper().Trim() : request.Name.Trim();
        item.AssetType = request.AssetType;
        item.Currency = request.Currency;
        item.Quantity = request.Quantity;
        item.CurrentPrice = request.CurrentPrice;
        item.TargetPrice = request.TargetPrice;
        item.TargetProfitPercent = request.TargetProfitPercent;
        item.Platform = request.Platform;
        item.Notes = request.Notes;

        await _context.SaveChangesAsync(cancellationToken);

        return new StrategyBasketItemDto(
            item.Id,
            item.StrategyBasketId,
            item.Symbol,
            item.Name,
            item.AssetType,
            item.Currency,
            item.Quantity,
            item.CurrentPrice,
            item.TargetPrice,
            item.TargetProfitPercent,
            item.Platform,
            item.Notes,
            item.RequiredCapital,
            item.TargetValue,
            item.TargetProfitLoss,
            item.CalculatedProfitPercent
        );
    }
}

public record DeleteBasketItemCommand(int Id) : IRequest<bool>;

public class DeleteBasketItemCommandHandler : IRequestHandler<DeleteBasketItemCommand, bool>
{
    private readonly IAppDbContext _context;

    public DeleteBasketItemCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteBasketItemCommand request, CancellationToken cancellationToken)
    {
        var item = await _context.StrategyBasketItems.FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);
        if (item == null) return false;

        item.IsDeleted = true;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public record ApplyStrategyBasketToPortfolioCommand(int StrategyBasketId) : IRequest<int>;

public class ApplyStrategyBasketToPortfolioCommandHandler : IRequestHandler<ApplyStrategyBasketToPortfolioCommand, int>
{
    private readonly IAppDbContext _context;

    public ApplyStrategyBasketToPortfolioCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<int> Handle(ApplyStrategyBasketToPortfolioCommand request, CancellationToken cancellationToken)
    {
        var basket = await _context.StrategyBaskets
            .Include(b => b.Items)
            .FirstOrDefaultAsync(b => b.Id == request.StrategyBasketId, cancellationToken);

        if (basket == null || !basket.Items.Any()) return 0;

        int addedCount = 0;
        foreach (var item in basket.Items)
        {
            var portfolioItem = new PortfolioItem
            {
                Symbol = item.Symbol,
                Name = item.Name,
                AssetType = item.AssetType,
                Currency = item.Currency,
                Quantity = item.Quantity,
                PurchasePrice = item.CurrentPrice,
                CurrentPrice = item.CurrentPrice,
                PurchaseDate = DateTime.UtcNow,
                Platform = item.Platform,
                Notes = $"[{basket.Name}] sepetinden aktarıldı. Hedef: {item.TargetPrice}",
                IsActive = true,
                TargetPrice = item.TargetPrice,
            };

            _context.PortfolioItems.Add(portfolioItem);
            addedCount++;
        }

        await _context.SaveChangesAsync(cancellationToken);
        return addedCount;
    }
}
