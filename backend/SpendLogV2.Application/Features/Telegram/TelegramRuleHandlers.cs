using MediatR;
using Microsoft.EntityFrameworkCore;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Domain.Entities;

namespace SpendLogV2.Application.Features.Telegram;

public record TelegramRuleDto(
    int Id,
    string Command,
    string Title,
    string Description,
    string Pattern,
    string ActionType,
    int? DefaultAccountId,
    int? DefaultCategoryId,
    string ResponseTemplate,
    bool IsActive,
    string SendType,
    string ScheduleType,
    string Frequency,
    string? ExecutionTime,
    int? IntervalMinutes,
    string? DaysOfWeek,
    DateTime? LastRunAt,
    DateTime? NextRunAt);

public record GetTelegramRulesQuery : IRequest<List<TelegramRuleDto>>;

public class GetTelegramRulesQueryHandler : IRequestHandler<GetTelegramRulesQuery, List<TelegramRuleDto>>
{
    private readonly IAppDbContext _context;

    public GetTelegramRulesQueryHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<List<TelegramRuleDto>> Handle(GetTelegramRulesQuery request, CancellationToken cancellationToken)
    {
        var rules = await _context.TelegramRules
            .OrderBy(r => r.Command)
            .ToListAsync(cancellationToken);

        return rules.Select(r => new TelegramRuleDto(
            r.Id,
            r.Command,
            r.Title,
            r.Description,
            r.Pattern,
            r.ActionType,
            r.DefaultAccountId,
            r.DefaultCategoryId,
            r.ResponseTemplate,
            r.IsActive,
            r.SendType ?? "Text",
            r.ScheduleType ?? "Manual",
            r.Frequency ?? "Daily",
            r.ExecutionTime ?? "09:00",
            r.IntervalMinutes,
            r.DaysOfWeek,
            r.LastRunAt,
            r.NextRunAt)).ToList();
    }
}

public record CreateTelegramRuleCommand(
    string Command,
    string Title,
    string Description,
    string? Pattern,
    string? ActionType,
    int? DefaultAccountId,
    int? DefaultCategoryId,
    string? ResponseTemplate,
    bool IsActive,
    string? SendType,
    string? ScheduleType,
    string? Frequency,
    string? ExecutionTime,
    int? IntervalMinutes,
    string? DaysOfWeek) : IRequest<TelegramRuleDto>;

public class CreateTelegramRuleCommandHandler : IRequestHandler<CreateTelegramRuleCommand, TelegramRuleDto>
{
    private readonly IAppDbContext _context;

    public CreateTelegramRuleCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<TelegramRuleDto> Handle(CreateTelegramRuleCommand request, CancellationToken cancellationToken)
    {
        var cmd = (request.Command ?? "").Trim();
        var pat = string.IsNullOrWhiteSpace(request.Pattern) ? $"^/{cmd.TrimStart('/')}$" : request.Pattern.Trim();

        var rule = new TelegramRule
        {
            Command = cmd,
            Title = string.IsNullOrWhiteSpace(request.Title) ? cmd : request.Title.Trim(),
            Description = request.Description ?? "",
            Pattern = pat,
            ActionType = string.IsNullOrWhiteSpace(request.ActionType) ? "Custom" : request.ActionType,
            DefaultAccountId = request.DefaultAccountId,
            DefaultCategoryId = request.DefaultCategoryId,
            ResponseTemplate = request.ResponseTemplate ?? "",
            IsActive = request.IsActive,
            SendType = request.SendType ?? "Text",
            ScheduleType = request.ScheduleType ?? "Manual",
            Frequency = request.Frequency ?? "Daily",
            ExecutionTime = request.ExecutionTime ?? "09:00",
            IntervalMinutes = request.IntervalMinutes,
            DaysOfWeek = request.DaysOfWeek
        };

        _context.TelegramRules.Add(rule);
        await _context.SaveChangesAsync(cancellationToken);

        return new TelegramRuleDto(
            rule.Id,
            rule.Command,
            rule.Title,
            rule.Description,
            rule.Pattern,
            rule.ActionType,
            rule.DefaultAccountId,
            rule.DefaultCategoryId,
            rule.ResponseTemplate,
            rule.IsActive,
            rule.SendType,
            rule.ScheduleType,
            rule.Frequency,
            rule.ExecutionTime,
            rule.IntervalMinutes,
            rule.DaysOfWeek,
            rule.LastRunAt,
            rule.NextRunAt);
    }
}

public record UpdateTelegramRuleCommand(
    int Id,
    string Command,
    string Title,
    string Description,
    string? Pattern,
    string? ActionType,
    int? DefaultAccountId,
    int? DefaultCategoryId,
    string? ResponseTemplate,
    bool IsActive,
    string? SendType,
    string? ScheduleType,
    string? Frequency,
    string? ExecutionTime,
    int? IntervalMinutes,
    string? DaysOfWeek) : IRequest<bool>;

public class UpdateTelegramRuleCommandHandler : IRequestHandler<UpdateTelegramRuleCommand, bool>
{
    private readonly IAppDbContext _context;

    public UpdateTelegramRuleCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(UpdateTelegramRuleCommand request, CancellationToken cancellationToken)
    {
        var rule = await _context.TelegramRules.FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);
        if (rule == null) return false;

        var cmd = (request.Command ?? "").Trim();
        var pat = string.IsNullOrWhiteSpace(request.Pattern) ? $"^/{cmd.TrimStart('/')}$" : request.Pattern.Trim();

        rule.Command = cmd;
        rule.Title = string.IsNullOrWhiteSpace(request.Title) ? cmd : request.Title.Trim();
        rule.Description = request.Description ?? "";
        rule.Pattern = pat;
        if (!string.IsNullOrWhiteSpace(request.ActionType))
            rule.ActionType = request.ActionType;
        rule.DefaultAccountId = request.DefaultAccountId;
        rule.DefaultCategoryId = request.DefaultCategoryId;
        rule.ResponseTemplate = request.ResponseTemplate ?? rule.ResponseTemplate;
        rule.IsActive = request.IsActive;
        rule.SendType = request.SendType ?? rule.SendType ?? "Text";
        rule.ScheduleType = request.ScheduleType ?? rule.ScheduleType ?? "Manual";
        rule.Frequency = request.Frequency ?? rule.Frequency ?? "Daily";
        rule.ExecutionTime = request.ExecutionTime ?? rule.ExecutionTime;
        rule.IntervalMinutes = request.IntervalMinutes ?? rule.IntervalMinutes;
        rule.DaysOfWeek = request.DaysOfWeek ?? rule.DaysOfWeek;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public record DeleteTelegramRuleCommand(int Id) : IRequest<bool>;

public class DeleteTelegramRuleCommandHandler : IRequestHandler<DeleteTelegramRuleCommand, bool>
{
    private readonly IAppDbContext _context;

    public DeleteTelegramRuleCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteTelegramRuleCommand request, CancellationToken cancellationToken)
    {
        var rule = await _context.TelegramRules.FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);
        if (rule == null) return false;

        rule.IsDeleted = true;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
