using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpendLogV2.Application.Features.Transactions;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TransactionsController : ControllerBase
{
    private readonly IMediator _mediator;

    public TransactionsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<TransactionDto>>> GetTransactions(
        [FromQuery] int? accountId,
        [FromQuery] int? categoryId,
        [FromQuery] TransactionType? type,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? search)
    {
        var result = await _mediator.Send(new GetTransactionsQuery(accountId, categoryId, type, startDate, endDate, search));
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<TransactionDto>> CreateTransaction([FromBody] CreateTransactionCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<TransactionDto>> UpdateTransaction(int id, [FromBody] UpdateTransactionCommand command)
    {
        if (id != command.Id) return BadRequest("ID uyuşmazlığı.");
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteTransaction(int id)
    {
        var result = await _mediator.Send(new DeleteTransactionCommand(id));
        return result ? NoContent() : NotFound();
    }
}
