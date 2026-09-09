using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpendLogV2.Application.Features.CreditCards;

namespace SpendLogV2.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CreditCardExpensesController : ControllerBase
{
    private readonly IMediator _mediator;

    public CreditCardExpensesController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<CreditCardExpenseDto>>> GetExpenses(
        [FromQuery] int? accountId,
        [FromQuery] int? year,
        [FromQuery] int? month,
        [FromQuery] int? categoryId,
        [FromQuery] string? search,
        [FromQuery] bool? isLiveEntry)
    {
        var result = await _mediator.Send(new GetCreditCardExpensesQuery(accountId, year, month, categoryId, search, isLiveEntry));
        return Ok(result);
    }

    [HttpGet("periods")]
    public async Task<ActionResult<List<PeriodSummaryDto>>> GetPeriodSummaries([FromQuery] int? accountId, [FromQuery] bool? isLiveEntry)
    {
        var result = await _mediator.Send(new GetPeriodSummariesQuery(accountId, isLiveEntry));
        return Ok(result);
    }

    [HttpPost("batch")]
    public async Task<ActionResult<int>> BatchSave([FromBody] BatchSaveCreditCardExpensesCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(new { savedCount = result });
    }

    [HttpPut("{id}/category")]
    public async Task<ActionResult> UpdateCategory(int id, [FromBody] UpdateCreditCardExpenseCategoryCommand command)
    {
        if (id != command.Id) return BadRequest();
        var result = await _mediator.Send(command);
        if (!result) return NotFound();
        return Ok(new { success = true });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        var result = await _mediator.Send(new DeleteCreditCardExpenseCommand(id));
        if (!result) return NotFound();
        return NoContent();
    }

    [HttpDelete("period")]
    public async Task<ActionResult> DeletePeriod([FromQuery] int year, [FromQuery] int month, [FromQuery] int? accountId)
    {
        var result = await _mediator.Send(new DeleteCreditCardPeriodCommand(year, month, accountId));
        return Ok(new { deletedCount = result });
    }
}
