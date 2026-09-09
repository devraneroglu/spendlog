namespace SpendLogV2.Application.Common.Interfaces;

/// <summary>
/// Python Scraping mikroservisi ile .NET 10 API arasında L2 Dağıtık Redis önbelleğini
/// doğrudan okumak için kullanılan ortak önbellek servisi arayüzü.
/// </summary>
public interface IPriceCacheService
{
    /// <summary>
    /// Merkezi piyasa özetini (BIST, US, Kripto, Altın, Döviz) JSON formatında döner.
    /// </summary>
    Task<string?> GetMarketSummaryJsonAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// İlgili varlık sembolünün anlık fiyat bilgisini JSON formatında döner.
    /// </summary>
    Task<string?> GetAssetPriceJsonAsync(string symbol, CancellationToken cancellationToken = default);

    /// <summary>
    /// Ham Redis anahtar değerini döner.
    /// </summary>
    Task<string?> GetRawAsync(string key, CancellationToken cancellationToken = default);

    /// <summary>
    /// Redis bağlantısının anlık olarak aktif olup olmadığını bildirir (Safe Fallback).
    /// </summary>
    bool IsConnected { get; }
}
