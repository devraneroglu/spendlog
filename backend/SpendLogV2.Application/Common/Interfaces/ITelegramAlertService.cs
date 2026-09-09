namespace SpendLogV2.Application.Common.Interfaces;

public interface ITelegramAlertService
{
    Task SendCriticalAlertAsync(string source, string errorMessage, string? traceId = null, Exception? exception = null);
    Task SendWarningAlertAsync(string source, string message, string? traceId = null);
}
