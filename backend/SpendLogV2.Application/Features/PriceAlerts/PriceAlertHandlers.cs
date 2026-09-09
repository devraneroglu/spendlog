using MediatR;
using Microsoft.EntityFrameworkCore;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Domain.Entities;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Application.Features.PriceAlerts;

public record PriceAlertDto(
    int Id,
    string Symbol,
    string Name,
    AssetType AssetType,
    Currency Currency,
    decimal TargetPrice,
    PriceAlertCondition Condition,
    string? Note,
    bool IsActive,
    bool IsTriggered,
    DateTime? TriggeredAt,
    decimal? TriggeredPrice,
    bool IsRecurring,
    DateTime CreatedAt);

public record GetPriceAlertsQuery(bool? IsActive = null) : IRequest<List<PriceAlertDto>>;

public class GetPriceAlertsQueryHandler : IRequestHandler<GetPriceAlertsQuery, List<PriceAlertDto>>
{
    private readonly IAppDbContext _context;

    public GetPriceAlertsQueryHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<List<PriceAlertDto>> Handle(GetPriceAlertsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.PriceAlerts.AsQueryable();

        if (request.IsActive.HasValue)
        {
            query = query.Where(a => a.IsActive == request.IsActive.Value);
        }

        var alerts = await query
            .OrderByDescending(a => a.IsActive)
            .ThenByDescending(a => a.CreatedAt)
            .ToListAsync(cancellationToken);

        return alerts.Select(a => new PriceAlertDto(
            a.Id,
            a.Symbol,
            a.Name,
            a.AssetType,
            a.Currency,
            a.TargetPrice,
            a.Condition,
            a.Note,
            a.IsActive,
            a.IsTriggered,
            a.TriggeredAt,
            a.TriggeredPrice,
            a.IsRecurring,
            a.CreatedAt)).ToList();
    }
}

public record CreatePriceAlertCommand(
    string Symbol,
    string Name,
    AssetType AssetType,
    Currency Currency,
    decimal TargetPrice,
    PriceAlertCondition Condition,
    string? Note,
    bool IsRecurring = false) : IRequest<PriceAlertDto>;

public class CreatePriceAlertCommandHandler : IRequestHandler<CreatePriceAlertCommand, PriceAlertDto>
{
    private readonly IAppDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public CreatePriceAlertCommandHandler(IAppDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<PriceAlertDto> Handle(CreatePriceAlertCommand request, CancellationToken cancellationToken)
    {
        var alert = new PriceAlert
        {
            Symbol = request.Symbol.ToUpper().Trim(),
            Name = request.Name,
            AssetType = request.AssetType,
            Currency = request.Currency,
            TargetPrice = request.TargetPrice,
            Condition = request.Condition,
            Note = request.Note,
            IsRecurring = request.IsRecurring,
            IsActive = true,
            IsTriggered = false
        };

        _context.PriceAlerts.Add(alert);
        await _context.SaveChangesAsync(cancellationToken);

        return new PriceAlertDto(
            alert.Id,
            alert.Symbol,
            alert.Name,
            alert.AssetType,
            alert.Currency,
            alert.TargetPrice,
            alert.Condition,
            alert.Note,
            alert.IsActive,
            alert.IsTriggered,
            alert.TriggeredAt,
            alert.TriggeredPrice,
            alert.IsRecurring,
            alert.CreatedAt);
    }
}

public record UpdatePriceAlertCommand(
    int Id,
    decimal TargetPrice,
    PriceAlertCondition Condition,
    string? Note,
    bool IsRecurring,
    bool IsActive) : IRequest<PriceAlertDto>;

public class UpdatePriceAlertCommandHandler : IRequestHandler<UpdatePriceAlertCommand, PriceAlertDto>
{
    private readonly IAppDbContext _context;

    public UpdatePriceAlertCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<PriceAlertDto> Handle(UpdatePriceAlertCommand request, CancellationToken cancellationToken)
    {
        var alert = await _context.PriceAlerts.FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken);
        if (alert == null) throw new InvalidOperationException("Fiyat alarmı bulunamadı.");

        alert.TargetPrice = request.TargetPrice;
        alert.Condition = request.Condition;
        alert.Note = request.Note;
        alert.IsRecurring = request.IsRecurring;
        alert.IsActive = request.IsActive;

        await _context.SaveChangesAsync(cancellationToken);

        return new PriceAlertDto(
            alert.Id,
            alert.Symbol,
            alert.Name,
            alert.AssetType,
            alert.Currency,
            alert.TargetPrice,
            alert.Condition,
            alert.Note,
            alert.IsActive,
            alert.IsTriggered,
            alert.TriggeredAt,
            alert.TriggeredPrice,
            alert.IsRecurring,
            alert.CreatedAt);
    }
}

public record DeletePriceAlertCommand(int Id) : IRequest<bool>;

public class DeletePriceAlertCommandHandler : IRequestHandler<DeletePriceAlertCommand, bool>
{
    private readonly IAppDbContext _context;

    public DeletePriceAlertCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeletePriceAlertCommand request, CancellationToken cancellationToken)
    {
        var alert = await _context.PriceAlerts.FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken);
        if (alert == null) return false;

        _context.PriceAlerts.Remove(alert);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public record TogglePriceAlertCommand(int Id) : IRequest<bool>;

public class TogglePriceAlertCommandHandler : IRequestHandler<TogglePriceAlertCommand, bool>
{
    private readonly IAppDbContext _context;

    public TogglePriceAlertCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(TogglePriceAlertCommand request, CancellationToken cancellationToken)
    {
        var alert = await _context.PriceAlerts.FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken);
        if (alert == null) return false;

        alert.IsActive = !alert.IsActive;
        if (alert.IsActive)
        {
            alert.IsTriggered = false; // Yeniden aktif edildiğinde tetiklenme sıfırlansın
        }

        await _context.SaveChangesAsync(cancellationToken);
        return alert.IsActive;
    }
}
