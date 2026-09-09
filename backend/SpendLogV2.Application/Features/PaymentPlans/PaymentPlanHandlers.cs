using MediatR;
using Microsoft.EntityFrameworkCore;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Domain.Entities;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Application.Features.PaymentPlans;

public record PaymentPlanDto(
    int Id,
    string Name,
    decimal Amount,
    DateTime FirstInstallmentDate,
    int InstallmentCount,
    bool IsOneTime,
    PaymentPlanType Type,
    bool IsIncome,
    string? Description);

public record GetPaymentPlansQuery : IRequest<List<PaymentPlanDto>>;

public class GetPaymentPlansQueryHandler : IRequestHandler<GetPaymentPlansQuery, List<PaymentPlanDto>>
{
    private readonly IAppDbContext _context;

    public GetPaymentPlansQueryHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<List<PaymentPlanDto>> Handle(GetPaymentPlansQuery request, CancellationToken cancellationToken)
    {
        var plans = await _context.PaymentPlans
            .OrderBy(p => p.FirstInstallmentDate)
            .ToListAsync(cancellationToken);

        return plans.Select(p => new PaymentPlanDto(
            p.Id,
            p.Name,
            p.Amount,
            p.FirstInstallmentDate,
            p.InstallmentCount,
            p.IsOneTime,
            p.Type,
            p.IsIncome,
            p.Description)).ToList();
    }
}

public record CreatePaymentPlanCommand(
    string Name,
    decimal Amount,
    DateTime FirstInstallmentDate,
    int InstallmentCount,
    bool IsOneTime,
    PaymentPlanType Type,
    bool IsIncome,
    string? Description) : IRequest<PaymentPlanDto>;

public class CreatePaymentPlanCommandHandler : IRequestHandler<CreatePaymentPlanCommand, PaymentPlanDto>
{
    private readonly IAppDbContext _context;

    public CreatePaymentPlanCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<PaymentPlanDto> Handle(CreatePaymentPlanCommand request, CancellationToken cancellationToken)
    {
        var plan = new PaymentPlan
        {
            Name = request.Name,
            Amount = request.Amount,
            FirstInstallmentDate = request.FirstInstallmentDate,
            InstallmentCount = request.InstallmentCount > 0 ? request.InstallmentCount : 1,
            IsOneTime = request.IsOneTime,
            Type = request.Type,
            IsIncome = request.IsIncome,
            Description = request.Description
        };

        _context.PaymentPlans.Add(plan);
        await _context.SaveChangesAsync(cancellationToken);

        return new PaymentPlanDto(
            plan.Id,
            plan.Name,
            plan.Amount,
            plan.FirstInstallmentDate,
            plan.InstallmentCount,
            plan.IsOneTime,
            plan.Type,
            plan.IsIncome,
            plan.Description);
    }
}

public record UpdatePaymentPlanCommand(
    int Id,
    string Name,
    decimal Amount,
    DateTime FirstInstallmentDate,
    int InstallmentCount,
    bool IsOneTime,
    PaymentPlanType Type,
    bool IsIncome,
    string? Description) : IRequest<PaymentPlanDto?>;

public class UpdatePaymentPlanCommandHandler : IRequestHandler<UpdatePaymentPlanCommand, PaymentPlanDto?>
{
    private readonly IAppDbContext _context;

    public UpdatePaymentPlanCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<PaymentPlanDto?> Handle(UpdatePaymentPlanCommand request, CancellationToken cancellationToken)
    {
        var plan = await _context.PaymentPlans.FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);
        if (plan == null) return null;

        plan.Name = request.Name;
        plan.Amount = request.Amount;
        plan.FirstInstallmentDate = request.FirstInstallmentDate;
        plan.InstallmentCount = request.InstallmentCount > 0 ? request.InstallmentCount : 1;
        plan.IsOneTime = request.IsOneTime;
        plan.Type = request.Type;
        plan.IsIncome = request.IsIncome;
        plan.Description = request.Description;

        await _context.SaveChangesAsync(cancellationToken);

        return new PaymentPlanDto(
            plan.Id,
            plan.Name,
            plan.Amount,
            plan.FirstInstallmentDate,
            plan.InstallmentCount,
            plan.IsOneTime,
            plan.Type,
            plan.IsIncome,
            plan.Description);
    }
}

public record DeletePaymentPlanCommand(int Id) : IRequest<bool>;

public class DeletePaymentPlanCommandHandler : IRequestHandler<DeletePaymentPlanCommand, bool>
{
    private readonly IAppDbContext _context;

    public DeletePaymentPlanCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeletePaymentPlanCommand request, CancellationToken cancellationToken)
    {
        var plan = await _context.PaymentPlans.FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);
        if (plan == null) return false;

        plan.IsDeleted = true;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

