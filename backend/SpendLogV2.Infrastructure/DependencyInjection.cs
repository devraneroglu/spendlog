using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Domain.Entities;
using SpendLogV2.Infrastructure.Data;
using SpendLogV2.Infrastructure.Services;
using StackExchange.Redis;

namespace SpendLogV2.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Server=localhost;Database=SpendLogV2Db;Trusted_Connection=True;TrustServerCertificate=True;";

        services.AddDbContext<SpendLogDbContext>(options =>
        {
            options.UseSqlServer(connectionString);
            options.ConfigureWarnings(warnings =>
                warnings.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
        });

        services.AddScoped<IAppDbContext>(provider => provider.GetRequiredService<SpendLogDbContext>());

        services.AddIdentity<AppUser, IdentityRole>(options =>
        {
            // Güçlü Kurumsal Şifre Politikası
            options.Password.RequireDigit = true;
            options.Password.RequireLowercase = true;
            options.Password.RequireUppercase = true;
            options.Password.RequireNonAlphanumeric = true;
            options.Password.RequiredLength = 8;

            // Kaba Kuvvet Koruması & Hesap Kilitleme (3 Hatalı Deneme, 15 Dakika Kilitleme)
            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            options.Lockout.MaxFailedAccessAttempts = 3;
            options.Lockout.AllowedForNewUsers = true;

            options.User.RequireUniqueEmail = true;
        })
        .AddEntityFrameworkStores<SpendLogDbContext>()
        .AddDefaultTokenProviders();

        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddScoped<ITelegramNotificationService, TelegramNotificationService>();
        services.AddSingleton<ITelegramAlertService, TelegramAlertService>();
        services.AddScoped<ITelegramMessageProcessor, TelegramMessageProcessor>();
        services.AddHttpClient();

        // Redis Dağıtık Önbellek (L2 Cache - Safe Fallback ile)
        var redisConnStr = configuration["Redis:ConnectionString"]
            ?? configuration.GetConnectionString("Redis")
            ?? "localhost:6379,abortConnect=false,connectTimeout=2000";

        try
        {
            var multiplexer = ConnectionMultiplexer.Connect(redisConnStr);
            services.AddSingleton<IConnectionMultiplexer>(multiplexer);
        }
        catch
        {
            // Redis ayağa kalkamazsa DI konteyneri çökmesin
        }

        services.AddSingleton<IPriceCacheService, RedisPriceCacheService>();

        services.AddHostedService<TelegramBotService>();

        return services;
    }
}
