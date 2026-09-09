using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SpendLogV2.Infrastructure.Data;

namespace SpendLogV2.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly SpendLogDbContext _context;

    public UsersController(SpendLogDbContext context)
    {
        _context = context;
    }

    [HttpGet("active-chat-ids")]
    public async Task<ActionResult<List<long>>> GetActiveTelegramChatIds()
    {
        var chatIds = await _context.Users
            .Where(u => u.TelegramChatId != null && u.IsTelegramActive)
            .Select(u => u.TelegramChatId!.Value)
            .ToListAsync();

        return Ok(chatIds);
    }
}
