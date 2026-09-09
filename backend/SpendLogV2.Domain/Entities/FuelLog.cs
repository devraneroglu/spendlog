using SpendLogV2.Domain.Common;

namespace SpendLogV2.Domain.Entities;

public class FuelLog : BaseEntity
{
    public DateTime Tarih { get; set; } = DateTime.UtcNow;
    public decimal Tutar { get; set; }
    public decimal LitreFiyat { get; set; }
    public decimal MiktarLitre { get; set; }
    public int AracKm { get; set; }
    public int? GidilenKm { get; set; }
    public decimal? OrtalamaTuketimLt { get; set; } // Lt / 100 Km
    public decimal? OrtalamaTuketimTL { get; set; } // ₺ / Km
    public int? AlisSikligiGun { get; set; }
    public string? Benzinlik { get; set; }
    public string? Konum { get; set; }
    public string? Not { get; set; }
    public string? FisGorselUrl { get; set; }
}
