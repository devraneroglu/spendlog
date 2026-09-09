namespace SpendLogV2.Application.Common.Models;

public class AuthResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? Expiration { get; set; }
    public UserDto? User { get; set; }
}

public class UserDto
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public long? TelegramChatId { get; set; }
    public bool IsTelegramActive { get; set; }
    public List<string> Roles { get; set; } = new();
    public bool IsAdmin { get; set; }
    public bool HasCustomTelegramBot { get; set; }
    public string? CustomTelegramBotUsername { get; set; }
}

public record LoginDto(string Email, string Password);

public record RegisterDto(string Email, string Password, string FullName);

public record RefreshTokenDto(string? AccessToken, string? RefreshToken);
