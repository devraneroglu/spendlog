using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpendLogV2.Application.Features.PriceAlerts;

namespace SpendLogV2.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Route("api/price-alerts")]
[Authorize]
public class PriceAlertsController : ControllerBase
{
    private readonly IMediator _mediator;

    public PriceAlertsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<PriceAlertDto>>> GetPriceAlerts([FromQuery] bool? isActive)
    {
        var result = await _mediator.Send(new GetPriceAlertsQuery(isActive));
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<PriceAlertDto>> CreatePriceAlert([FromBody] CreatePriceAlertCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<PriceAlertDto>> UpdatePriceAlert(int id, [FromBody] UpdatePriceAlertCommand command)
    {
        if (id != command.Id) return BadRequest("ID uyuşmazlığı.");
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeletePriceAlert(int id)
    {
        var result = await _mediator.Send(new DeletePriceAlertCommand(id));
        return result ? NoContent() : NotFound();
    }

    [HttpPatch("{id}/toggle")]
    public async Task<ActionResult<bool>> TogglePriceAlert(int id)
    {
        var result = await _mediator.Send(new TogglePriceAlertCommand(id));
        return Ok(result);
    }
}
