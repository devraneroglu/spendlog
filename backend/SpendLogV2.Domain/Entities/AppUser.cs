using Microsoft.AspNetCore.Identity;

namespace SpendLogV2.Domain.Entities;

public class AppUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;
    public long? TelegramChatId { get; set; }
    public bool IsTelegramActive { get; set; } = false;
    public string? RefreshToken { get; set; }
    public string? PreviousRefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Özel Telegram Bot Entegrasyonu (Multi-Tenant Webhook)
    public string? CustomTelegramBotToken { get; set; }
    public string? TelegramWebhookSecret { get; set; }
    public string? CustomTelegramBotUsername { get; set; }
}
