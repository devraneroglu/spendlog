using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpendLogV2.Application.Features.Trackers;

namespace SpendLogV2.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TrackersController : ControllerBase
{
    private readonly IMediator _mediator;

    public TrackersController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<TrackerDto>>> GetTrackers()
    {
        var result = await _mediator.Send(new GetTrackersQuery());
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<TrackerDto>> CreateTracker([FromBody] CreateTrackerCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpPost("{id}/items")]
    public async Task<ActionResult<TrackerItemDto>> AddItem(int id, [FromBody] AddTrackerItemCommand command)
    {
        if (id != command.TrackerId) return BadRequest();
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteTracker(int id)
    {
        var result = await _mediator.Send(new DeleteTrackerCommand(id));
        return result ? NoContent() : NotFound();
    }
}
