using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpendLogV2.Application.Features.StrategyBaskets;

namespace SpendLogV2.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class StrategyBasketsController : ControllerBase
{
    private readonly IMediator _mediator;

    public StrategyBasketsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<StrategyBasketDto>>> GetBaskets([FromQuery] decimal usdRate = 48.00m)
    {
        var result = await _mediator.Send(new GetStrategyBasketsQuery(usdRate));
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<StrategyBasketDto>> CreateBasket([FromBody] CreateStrategyBasketCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateBasket(int id, [FromBody] UpdateStrategyBasketCommand command)
    {
        if (id != command.Id) return BadRequest();
        var result = await _mediator.Send(command);
        return result ? NoContent() : NotFound();
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteBasket(int id)
    {
        var result = await _mediator.Send(new DeleteStrategyBasketCommand(id));
        return result ? NoContent() : NotFound();
    }

    [HttpPost("{id}/items")]
    public async Task<ActionResult<StrategyBasketItemDto>> AddOrUpdateItem(int id, [FromBody] AddOrUpdateBasketItemCommand command)
    {
        if (id != command.StrategyBasketId) return BadRequest();
        var result = await _mediator.Send(command);
        return result != null ? Ok(result) : NotFound();
    }

    [HttpDelete("items/{itemId}")]
    public async Task<ActionResult> DeleteItem(int itemId)
    {
        var result = await _mediator.Send(new DeleteBasketItemCommand(itemId));
        return result ? NoContent() : NotFound();
    }

    [HttpPost("{id}/apply-to-portfolio")]
    public async Task<ActionResult> ApplyToPortfolio(int id)
    {
        var count = await _mediator.Send(new ApplyStrategyBasketToPortfolioCommand(id));
        return Ok(new { success = true, addedCount = count });
    }
}
