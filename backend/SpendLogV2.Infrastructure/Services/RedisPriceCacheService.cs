using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SpendLogV2.Application.Common.Interfaces;
using StackExchange.Redis;

namespace SpendLogV2.Infrastructure.Services;

/// <summary>
/// Python Scraping servisi ile paylaşılan L2 Dağıtık Redis önbelleğini okuyan servis.
/// Redis kapalıysa veya erişilemiyorsa Safe Fallback ile null döner, sistemi çökertmez.
/// </summary>
public class RedisPriceCacheService : IPriceCacheService
{
    private readonly IConnectionMultiplexer? _redis;
    private readonly ILogger<RedisPriceCacheService> _logger;
    private const string KeyPrefix = "spendlog:";

    public RedisPriceCacheService(
        IConfiguration configuration,
        ILogger<RedisPriceCacheService> _logger,
        IConnectionMultiplexer? redis = null)
    {
        this._logger = _logger;
        _redis = redis;
    }

    public bool IsConnected => _redis != null && _redis.IsConnected;

    public async Task<string?> GetMarketSummaryJsonAsync(CancellationToken cancellationToken = default)
    {
        return await GetRawAsync("market:summary", cancellationToken);
    }

    public async Task<string?> GetAssetPriceJsonAsync(string symbol, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(symbol)) return null;
        var clean = symbol.Trim().ToUpperInvariant();
        return await GetRawAsync($"asset:{clean}", cancellationToken);
    }

    public async Task<string?> GetRawAsync(string key, CancellationToken cancellationToken = default)
    {
        if (!IsConnected || _redis == null)
        {
            return null;
        }

        try
        {
            var db = _redis.GetDatabase();
            var fullKey = key.StartsWith(KeyPrefix) ? key : $"{KeyPrefix}{key}";
            RedisValue value = await db.StringGetAsync(fullKey);
            return value.HasValue ? value.ToString() : null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis önbelleğinden anahtar okunurken hata oluştu: {Key}", key);
            return null;
        }
    }
}
