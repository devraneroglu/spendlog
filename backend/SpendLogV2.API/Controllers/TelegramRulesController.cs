using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpendLogV2.Application.Features.Telegram;

namespace SpendLogV2.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TelegramRulesController : ControllerBase
{
    private readonly IMediator _mediator;

    public TelegramRulesController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<TelegramRuleDto>>> GetRules()
    {
        var result = await _mediator.Send(new GetTelegramRulesQuery());
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<TelegramRuleDto>> CreateRule([FromBody] CreateTelegramRuleCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateRule(int id, [FromBody] UpdateTelegramRuleCommand command)
    {
        if (id != command.Id) return BadRequest();
        var result = await _mediator.Send(command);
        return result ? NoContent() : NotFound();
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteRule(int id)
    {
        var result = await _mediator.Send(new DeleteTelegramRuleCommand(id));
        return result ? NoContent() : NotFound();
    }
}
