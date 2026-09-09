using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Domain.Exceptions;

namespace SpendLogV2.API.Middlewares;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, ITelegramAlertService alertService)
    {
        var traceId = $"SL-{Guid.NewGuid().ToString()[..8].ToUpper()}";
        context.Response.Headers["X-Trace-Id"] = traceId;

        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex, traceId, alertService);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception, string traceId, ITelegramAlertService alertService)
    {
        context.Response.ContentType = "application/problem+json";

        var response = new ProblemDetails
        {
            Instance = context.Request.Path,
            Extensions = { ["traceId"] = traceId }
        };

        switch (exception)
        {
            case ValidationException valEx:
                context.Response.StatusCode = (int)HttpStatusCode.UnprocessableEntity;
                response.Status = (int)HttpStatusCode.UnprocessableEntity;
                response.Title = valEx.Title;
                response.Detail = valEx.Message;
                response.Extensions["errors"] = valEx.Errors;
                _logger.LogWarning("Validation Hatası [{TraceId}]: {Path} -> {Errors}", traceId, context.Request.Path, JsonSerializer.Serialize(valEx.Errors));
                break;

            case DomainException domEx:
                context.Response.StatusCode = domEx.StatusCode;
                response.Status = domEx.StatusCode;
                response.Title = domEx.Title;
                response.Detail = domEx.Message;
                _logger.LogWarning("İş Mantığı Hatası [{TraceId}]: {Path} -> {Message}", traceId, context.Request.Path, domEx.Message);
                break;

            case NotFoundException notFoundEx:
                context.Response.StatusCode = (int)HttpStatusCode.NotFound;
                response.Status = (int)HttpStatusCode.NotFound;
                response.Title = notFoundEx.Title;
                response.Detail = notFoundEx.Message;
                _logger.LogWarning("Kayıt Bulunamadı [{TraceId}]: {Path} -> {Message}", traceId, context.Request.Path, notFoundEx.Message);
                break;

            case UnauthorizedAccessException:
                context.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
                response.Status = (int)HttpStatusCode.Unauthorized;
                response.Title = "Yetkilendirme Hatası";
                response.Detail = "Bu işlem için geçerli bir oturum açmanız gerekmektedir.";
                _logger.LogWarning("Yetkisiz Erişim [{TraceId}]: {Path}", traceId, context.Request.Path);
                break;

            default:
                context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                response.Status = (int)HttpStatusCode.InternalServerError;
                response.Title = "Sunucu Hatası";
                response.Detail = "İşleminiz gerçekleştirilirken beklenmeyen bir sunucu hatası oluştu. Lütfen destek kodu ile iletişime geçiniz.";
                
                _logger.LogError(exception, "Kritik Sunucu Hatası [{TraceId}]: {Path} -> {Message}", traceId, context.Request.Path, exception.Message);

                // Kritik 500 hatalarında anında Telegram Alarmı at
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await alertService.SendCriticalAlertAsync(
                            source: $"API: {context.Request.Method} {context.Request.Path}",
                            errorMessage: exception.Message,
                            traceId: traceId,
                            exception: exception);
                    }
                    catch { /* Alarm hatası ana akışı etkilemesin */ }
                });
                break;
        }

        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        });

        await context.Response.WriteAsync(json);
    }
}
