using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpendLogV2.Application.Features.Transfers;

namespace SpendLogV2.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TransfersController : ControllerBase
{
    private readonly IMediator _mediator;

    public TransfersController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<TransferDto>>> GetTransfers()
    {
        var result = await _mediator.Send(new GetTransfersQuery());
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<TransferDto>> CreateTransfer([FromBody] CreateTransferCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<TransferDto>> UpdateTransfer(int id, [FromBody] UpdateTransferCommand command)
    {
        if (id != command.Id) return BadRequest("ID uyuşmazlığı.");
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteTransfer(int id)
    {
        var result = await _mediator.Send(new DeleteTransferCommand(id));
        return result ? NoContent() : NotFound();
    }
}
