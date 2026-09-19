using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SpendLogV2.API.Data;
using SpendLogV2.Application;
using SpendLogV2.Domain.Entities;
using SpendLogV2.Infrastructure;
using SpendLogV2.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

// 1. Add Application & Infrastructure Services
builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);

// 2. Configure JWT Authentication
var jwtSecretKey = builder.Configuration["Jwt:SecretKey"]
    ?? throw new InvalidOperationException("Kritik Güvenlik Hatası: 'Jwt:SecretKey' konfigürasyonu eksik!");
var key = Encoding.UTF8.GetBytes(jwtSecretKey);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "SpendLogV2API",
        ValidateAudience = true,
        ValidAudience = builder.Configuration["Jwt:Audience"] ?? "SpendLogV2Client",
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

// 3. Configure CORS for Next.js Frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "https://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// 4. Configure Rate Limiting (Kaba Kuvvet & Bot Koruması)
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("AuthRateLimit", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown_client",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

// 4. Auto Migration & Database Seeding
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var dbContext = services.GetRequiredService<SpendLogDbContext>();
        await dbContext.Database.MigrateAsync();

        var userManager = services.GetRequiredService<UserManager<AppUser>>();
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        var config = services.GetRequiredService<IConfiguration>();
        await DbSeeder.SeedAsync(dbContext, userManager, roleManager, config);
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Veritabanı migration veya seed işlemi sırasında hata oluştu.");
        try
        {
            var alertService = services.GetService<SpendLogV2.Application.Common.Interfaces.ITelegramAlertService>();
            alertService?.SendCriticalAlertAsync("API Startup / Database Migration", ex.Message, exception: ex).GetAwaiter().GetResult();
        }
        catch { }
    }
}

// Global Unhandled Process Exception Alert
AppDomain.CurrentDomain.UnhandledException += (sender, eventArgs) =>
{
    if (eventArgs.ExceptionObject is Exception unhandledEx)
    {
        try
        {
            using var scope = app.Services.CreateScope();
            var alertService = scope.ServiceProvider.GetService<SpendLogV2.Application.Common.Interfaces.ITelegramAlertService>();
            alertService?.SendCriticalAlertAsync("API Unhandled Process Crash", unhandledEx.Message, exception: unhandledEx).GetAwaiter().GetResult();
        }
        catch { }
    }
};

// 5. Middleware Pipeline
app.UseMiddleware<SpendLogV2.API.Middlewares.GlobalExceptionMiddleware>();

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
else
{
    app.MapOpenApi();
}

app.UseCors("AllowFrontend");

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
