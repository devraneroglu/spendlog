using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpendLogV2.Application.Features.Portfolio;

namespace SpendLogV2.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PortfolioController : ControllerBase
{
    private readonly IMediator _mediator;

    public PortfolioController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<PortfolioItemDto>>> GetItems([FromQuery] bool? isActive)
    {
        var result = await _mediator.Send(new GetPortfolioItemsQuery(isActive));
        return Ok(result);
    }

    [HttpGet("summary")]
    public async Task<ActionResult<PortfolioSummaryDto>> GetSummary([FromQuery] decimal usdRate = 45.00m)
    {
        var result = await _mediator.Send(new GetPortfolioSummaryQuery(usdRate));
        return Ok(result);
    }

    [HttpGet("distribution")]
    public async Task<ActionResult<PortfolioDistributionDto>> GetDistribution([FromQuery] decimal usdRate = 45.00m)
    {
        var result = await _mediator.Send(new GetPortfolioDistributionQuery(usdRate));
        return Ok(result);
    }

    [HttpGet("snapshots")]
    public async Task<ActionResult<List<PortfolioSnapshotDto>>> GetSnapshots(
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate)
    {
        var result = await _mediator.Send(new GetPortfolioSnapshotsQuery(fromDate, toDate));
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<PortfolioItemDto>> CreateItem([FromBody] CreatePortfolioItemCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpPost("batch-update-prices")]
    public async Task<ActionResult> BatchUpdatePrices([FromBody] BatchUpdatePortfolioPricesCommand command)
    {
        var updatedCount = await _mediator.Send(command);
        return Ok(new { success = true, updatedCount });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateItem(int id, [FromBody] UpdatePortfolioItemCommand command)
    {
        if (id != command.Id) return BadRequest();
        var result = await _mediator.Send(command);
        return result ? NoContent() : NotFound();
    }

    [HttpPost("{id}/sell")]
    public async Task<ActionResult> SellItem(int id, [FromBody] SellPortfolioItemCommand command)
    {
        if (id != command.Id) return BadRequest();
        var result = await _mediator.Send(command);
        return result ? Ok(new { success = true }) : NotFound();
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteItem(int id)
    {
        var result = await _mediator.Send(new DeletePortfolioItemCommand(id));
        return result ? NoContent() : NotFound();
    }

    [HttpDelete("snapshots/{id}")]
    public async Task<ActionResult> DeleteSnapshot(int id)
    {
        var result = await _mediator.Send(new DeletePortfolioSnapshotCommand(id));
        return result ? NoContent() : NotFound();
    }

    [HttpDelete("snapshots/clear-all")]
    public async Task<ActionResult> ClearAllSnapshots()
    {
        var deletedCount = await _mediator.Send(new ClearAllPortfolioSnapshotsCommand());
        return Ok(new { success = true, deletedCount });
    }

    [HttpPost("bulk-import")]
    public async Task<ActionResult> BulkImport([FromBody] BulkImportPortfolioCommand command)
    {
        var importedCount = await _mediator.Send(command);
        return Ok(new { success = true, importedCount });
    }
}
