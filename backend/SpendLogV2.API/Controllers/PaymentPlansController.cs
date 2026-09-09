using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpendLogV2.Application.Features.PaymentPlans;

namespace SpendLogV2.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PaymentPlansController : ControllerBase
{
    private readonly IMediator _mediator;

    public PaymentPlansController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<PaymentPlanDto>>> GetPlans()
    {
        var result = await _mediator.Send(new GetPaymentPlansQuery());
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<PaymentPlanDto>> CreatePlan([FromBody] CreatePaymentPlanCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<PaymentPlanDto>> UpdatePlan(int id, [FromBody] UpdatePaymentPlanCommand command)
    {
        if (id != command.Id) return BadRequest("ID uyuşmazlığı.");
        var result = await _mediator.Send(command);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeletePlan(int id)
    {
        var result = await _mediator.Send(new DeletePaymentPlanCommand(id));
        return result ? NoContent() : NotFound();
    }
}
