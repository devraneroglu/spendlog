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
    bool IsActive);

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
            r.IsActive)).ToList();
    }
}

public record CreateTelegramRuleCommand(
    string Command,
    string Title,
    string Description,
    string Pattern,
    string ActionType,
    int? DefaultAccountId,
    int? DefaultCategoryId,
    string ResponseTemplate,
    bool IsActive) : IRequest<TelegramRuleDto>;

public class CreateTelegramRuleCommandHandler : IRequestHandler<CreateTelegramRuleCommand, TelegramRuleDto>
{
    private readonly IAppDbContext _context;

    public CreateTelegramRuleCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<TelegramRuleDto> Handle(CreateTelegramRuleCommand request, CancellationToken cancellationToken)
    {
        var rule = new TelegramRule
        {
            Command = request.Command.Trim(),
            Title = request.Title.Trim(),
            Description = request.Description,
            Pattern = request.Pattern.Trim(),
            ActionType = request.ActionType,
            DefaultAccountId = request.DefaultAccountId,
            DefaultCategoryId = request.DefaultCategoryId,
            ResponseTemplate = request.ResponseTemplate,
            IsActive = request.IsActive
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
            rule.IsActive);
    }
}

public record UpdateTelegramRuleCommand(
    int Id,
    string Command,
    string Title,
    string Description,
    string Pattern,
    string ActionType,
    int? DefaultAccountId,
    int? DefaultCategoryId,
    string ResponseTemplate,
    bool IsActive) : IRequest<bool>;

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

        rule.Command = request.Command.Trim();
        rule.Title = request.Title.Trim();
        rule.Description = request.Description;
        rule.Pattern = request.Pattern.Trim();
        rule.ActionType = request.ActionType;
        rule.DefaultAccountId = request.DefaultAccountId;
        rule.DefaultCategoryId = request.DefaultCategoryId;
        rule.ResponseTemplate = request.ResponseTemplate;
        rule.IsActive = request.IsActive;

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
