using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpendLogV2.Application.Features.Accounts;

namespace SpendLogV2.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AccountsController : ControllerBase
{
    private readonly IMediator _mediator;

    public AccountsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<AccountDto>>> GetAccounts()
    {
        var result = await _mediator.Send(new GetAccountsQuery());
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<AccountDto>> CreateAccount([FromBody] CreateAccountCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateAccount(int id, [FromBody] UpdateAccountCommand command)
    {
        if (id != command.Id) return BadRequest();
        var result = await _mediator.Send(command);
        return result ? NoContent() : NotFound();
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteAccount(int id)
    {
        var result = await _mediator.Send(new DeleteAccountCommand(id));
        return result ? NoContent() : NotFound();
    }

    [HttpPost("recalculate-all")]
    public async Task<ActionResult> RecalculateAll()
    {
        await _mediator.Send(new RecalculateAllBalancesCommand());
        return Ok(new { message = "Tüm hesap bakiyeleri hareketlere göre başarıyla eşitlendi." });
    }
}
