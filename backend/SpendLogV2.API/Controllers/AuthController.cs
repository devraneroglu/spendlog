using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Application.Common.Models;
using SpendLogV2.Application.Features.Auth.Commands.Login;
using SpendLogV2.Application.Features.Auth.Commands.RefreshToken;
using SpendLogV2.Application.Features.Auth.Commands.Register;

namespace SpendLogV2.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ICurrentUserService _currentUserService;

    public AuthController(IMediator mediator, ICurrentUserService currentUserService)
    {
        _mediator = mediator;
        _currentUserService = currentUserService;
    }

    [HttpPost("login")]
    [EnableRateLimiting("AuthRateLimit")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginDto dto)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();

        var result = await _mediator.Send(new LoginCommand(dto.Email, dto.Password, ip, userAgent));
        if (!result.Success)
            return Unauthorized(result);

        if (!string.IsNullOrEmpty(result.RefreshToken))
        {
            AppendRefreshTokenCookie(result.RefreshToken);
        }

        return Ok(result);
    }

    [HttpPost("register")]
    [EnableRateLimiting("AuthRateLimit")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterDto dto)
    {
        var result = await _mediator.Send(new RegisterCommand(dto.Email, dto.Password, dto.FullName));
        if (!result.Success)
            return BadRequest(result);

        if (!string.IsNullOrEmpty(result.RefreshToken))
        {
            AppendRefreshTokenCookie(result.RefreshToken);
        }

        return Ok(result);
    }

    [HttpPost("refresh-token")]
    public async Task<ActionResult<AuthResponse>> RefreshToken([FromBody] RefreshTokenDto dto)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();

        // Refresh token'ı önce gövdeden (body), yoksa HttpOnly Cookie'den oku
        var refreshToken = !string.IsNullOrWhiteSpace(dto.RefreshToken)
            ? dto.RefreshToken
            : Request.Cookies["refreshToken"] ?? "";

        var result = await _mediator.Send(new RefreshTokenCommand(dto.AccessToken ?? "", refreshToken, ip, userAgent));
        if (!result.Success)
        {
            DeleteRefreshTokenCookie();
            return Unauthorized(result);
        }

        if (!string.IsNullOrEmpty(result.RefreshToken))
        {
            AppendRefreshTokenCookie(result.RefreshToken);
        }

        return Ok(result);
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        DeleteRefreshTokenCookie();
        return Ok(new { success = true, message = "Güvenli çıkış yapıldı." });
    }

    [HttpGet("me")]
    [Authorize]
    public ActionResult<object> GetCurrentUser()
    {
        return Ok(new
        {
            UserId = _currentUserService.UserId,
            Email = _currentUserService.UserEmail,
            IsAuthenticated = _currentUserService.IsAuthenticated
        });
    }

    private void AppendRefreshTokenCookie(string refreshToken)
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Expires = DateTime.UtcNow.AddDays(7),
            Path = "/api/auth"
        };
        Response.Cookies.Append("refreshToken", refreshToken, cookieOptions);
    }

    private void DeleteRefreshTokenCookie()
    {
        Response.Cookies.Delete("refreshToken", new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Path = "/api/auth"
        });
    }
}
