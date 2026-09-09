using MediatR;
using Microsoft.EntityFrameworkCore;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Domain.Entities;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Application.Features.Trackers;

public record TrackerItemDto(int Id, int TrackerId, int OrderIndex, string JsonData, DateTime CreatedAt);

public record TrackerDto(
    int Id,
    TrackerType Type,
    string Title,
    string? Description,
    string? Icon,
    string? Color,
    decimal? TargetAmount,
    decimal? CurrentAmount,
    DateTime? DueDate,
    bool IsCompleted,
    string? SchemaDefinition,
    List<TrackerItemDto> Items);

public record GetTrackersQuery : IRequest<List<TrackerDto>>;

public class GetTrackersQueryHandler : IRequestHandler<GetTrackersQuery, List<TrackerDto>>
{
    private readonly IAppDbContext _context;

    public GetTrackersQueryHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<List<TrackerDto>> Handle(GetTrackersQuery request, CancellationToken cancellationToken)
    {
        var trackers = await _context.Trackers
            .Include(t => t.Items)
            .OrderBy(t => t.Title)
            .ToListAsync(cancellationToken);

        return trackers.Select(t => new TrackerDto(
            t.Id,
            t.Type,
            t.Title,
            t.Description,
            t.Icon,
            t.Color,
            t.TargetAmount,
            t.CurrentAmount,
            t.DueDate,
            t.IsCompleted,
            t.SchemaDefinition,
            t.Items.OrderBy(i => i.OrderIndex).Select(i => new TrackerItemDto(i.Id, i.TrackerId, i.OrderIndex, i.JsonData, i.CreatedAt)).ToList())).ToList();
    }
}

public record CreateTrackerCommand(
    TrackerType Type,
    string Title,
    string? Description,
    string? Icon,
    string? Color,
    decimal? TargetAmount,
    DateTime? DueDate,
    string? SchemaDefinition) : IRequest<TrackerDto>;

public class CreateTrackerCommandHandler : IRequestHandler<CreateTrackerCommand, TrackerDto>
{
    private readonly IAppDbContext _context;

    public CreateTrackerCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<TrackerDto> Handle(CreateTrackerCommand request, CancellationToken cancellationToken)
    {
        var tracker = new Tracker
        {
            Type = request.Type,
            Title = request.Title,
            Description = request.Description,
            Icon = request.Icon ?? "table",
            Color = request.Color ?? "#6366f1",
            TargetAmount = request.TargetAmount,
            CurrentAmount = 0,
            DueDate = request.DueDate,
            SchemaDefinition = request.SchemaDefinition,
            IsCompleted = false
        };

        _context.Trackers.Add(tracker);
        await _context.SaveChangesAsync(cancellationToken);

        return new TrackerDto(
            tracker.Id,
            tracker.Type,
            tracker.Title,
            tracker.Description,
            tracker.Icon,
            tracker.Color,
            tracker.TargetAmount,
            tracker.CurrentAmount,
            tracker.DueDate,
            tracker.IsCompleted,
            tracker.SchemaDefinition,
            new List<TrackerItemDto>());
    }
}

public record AddTrackerItemCommand(int TrackerId, int OrderIndex, string JsonData) : IRequest<TrackerItemDto>;

public class AddTrackerItemCommandHandler : IRequestHandler<AddTrackerItemCommand, TrackerItemDto>
{
    private readonly IAppDbContext _context;

    public AddTrackerItemCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<TrackerItemDto> Handle(AddTrackerItemCommand request, CancellationToken cancellationToken)
    {
        var item = new TrackerItem
        {
            TrackerId = request.TrackerId,
            OrderIndex = request.OrderIndex,
            JsonData = request.JsonData,
            CreatedAt = DateTime.Now
        };

        _context.TrackerItems.Add(item);
        await _context.SaveChangesAsync(cancellationToken);

        return new TrackerItemDto(item.Id, item.TrackerId, item.OrderIndex, item.JsonData, item.CreatedAt);
    }
}

public record DeleteTrackerCommand(int Id) : IRequest<bool>;

public class DeleteTrackerCommandHandler : IRequestHandler<DeleteTrackerCommand, bool>
{
    private readonly IAppDbContext _context;

    public DeleteTrackerCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteTrackerCommand request, CancellationToken cancellationToken)
    {
        var tracker = await _context.Trackers.FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken);
        if (tracker == null) return false;

        tracker.IsDeleted = true;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
