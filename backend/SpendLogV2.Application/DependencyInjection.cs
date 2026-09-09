using System.Reflection;
using Microsoft.Extensions.DependencyInjection;

namespace SpendLogV2.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly()));
        services.AddScoped<Features.PriceAlerts.PriceAlertEvaluator>();
        return services;
    }
}
