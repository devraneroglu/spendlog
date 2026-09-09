using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpendLogV2.Application.Features.FuelLogs;

namespace SpendLogV2.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class FuelLogsController : ControllerBase
{
    private readonly IMediator _mediator;

    public FuelLogsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<FuelLogsResponseDto>> GetLogs()
    {
        var result = await _mediator.Send(new GetFuelLogsQuery());
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<FuelLogDto>> CreateLog([FromBody] CreateFuelLogCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<FuelLogDto>> UpdateLog(int id, [FromBody] UpdateFuelLogCommand command)
    {
        if (id != command.Id)
            return BadRequest("ID uyuşmazlığı.");

        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteLog(int id)
    {
        var success = await _mediator.Send(new DeleteFuelLogCommand(id));
        if (!success) return NotFound();
        return NoContent();
    }
}
