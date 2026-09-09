namespace SpendLogV2.Domain.Entities;

public class SecurityAuditLog
{
    public int Id { get; set; }
    public string? UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public bool Success { get; set; }
    public string? FailureReason { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
