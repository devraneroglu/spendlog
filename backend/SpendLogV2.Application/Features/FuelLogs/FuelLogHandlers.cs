using MediatR;
using Microsoft.EntityFrameworkCore;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Domain.Entities;

namespace SpendLogV2.Application.Features.FuelLogs;

public record FuelLogDto(
    int Id,
    DateTime Tarih,
    string Ay,
    decimal Tutar,
    decimal LitreFiyat,
    decimal MiktarLitre,
    int AracKm,
    int? GidilenKm,
    decimal? OrtalamaTuketimLt,
    decimal? OrtalamaTuketimTL,
    int? AlisSikligiGun,
    string? Benzinlik,
    string? Konum,
    string? Not,
    string? FisGorselUrl);

public record FuelPeriodKpiDto(
    decimal TotalExpense,
    decimal TotalLiters,
    int TotalKilometers,
    decimal AverageCostPerKm,
    decimal AverageLitersPer100Km,
    decimal AverageLiterPrice,
    int LogsCount,
    string Label);

public record FuelSummaryDto(
    decimal TotalExpense,
    decimal TotalLiters,
    decimal AverageLiterPrice,
    int TotalKilometers,
    decimal AverageCostPerKm,
    decimal AverageLitersPer100Km,
    string? TopStation,
    int TotalLogsCount,
    FuelPeriodKpiDto CurrentYear,
    FuelPeriodKpiDto CurrentMonth,
    List<FuelStationStatDto> StationBreakdown,
    List<FuelMonthlyStatDto> MonthlyTrend);

public record FuelStationStatDto(string Station, decimal TotalAmount, decimal TotalLiters, int Count);
public record FuelMonthlyStatDto(string MonthKey, string MonthLabel, decimal TotalAmount, decimal TotalLiters, decimal AverageCostPerKm);

public record FuelLogsResponseDto(
    List<FuelLogDto> Logs,
    FuelSummaryDto Summary);

public record GetFuelLogsQuery : IRequest<FuelLogsResponseDto>;

public class GetFuelLogsQueryHandler : IRequestHandler<GetFuelLogsQuery, FuelLogsResponseDto>
{
    private readonly IAppDbContext _context;

    public GetFuelLogsQueryHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<FuelLogsResponseDto> Handle(GetFuelLogsQuery request, CancellationToken cancellationToken)
    {
        var logs = await _context.FuelLogs
            .OrderByDescending(f => f.Tarih)
            .ThenByDescending(f => f.AracKm)
            .ToListAsync(cancellationToken);

        var dtoList = logs.Select(f => new FuelLogDto(
            f.Id,
            f.Tarih,
            f.Tarih.ToString("MMMM", new System.Globalization.CultureInfo("tr-TR")),
            f.Tutar,
            f.LitreFiyat,
            f.MiktarLitre,
            f.AracKm,
            f.GidilenKm,
            f.OrtalamaTuketimLt,
            f.OrtalamaTuketimTL,
            f.AlisSikligiGun,
            f.Benzinlik,
            f.Konum,
            f.Not,
            f.FisGorselUrl)).ToList();

        // KPI ve İstatistik Hesaplamaları
        decimal totalExpense = logs.Sum(f => f.Tutar);
        decimal totalLiters = logs.Sum(f => f.MiktarLitre);
        decimal avgLiterPrice = totalLiters > 0 ? Math.Round(totalExpense / totalLiters, 2) : 0;

        int totalKm = logs.Where(f => f.GidilenKm.HasValue).Sum(f => f.GidilenKm!.Value);
        decimal avgCostPerKm = totalKm > 0 ? Math.Round(totalExpense / totalKm, 2) : 0;
        decimal avgLitersPer100Km = totalKm > 0 ? Math.Round((totalLiters / totalKm) * 100, 2) : 0;

        // En çok tercih edilen istasyon
        var stationGroups = logs
            .Where(f => !string.IsNullOrWhiteSpace(f.Benzinlik))
            .GroupBy(f => f.Benzinlik!.Trim())
            .Select(g => new FuelStationStatDto(g.Key, g.Sum(x => x.Tutar), g.Sum(x => x.MiktarLitre), g.Count()))
            .OrderByDescending(s => s.TotalAmount)
            .ToList();

        string? topStation = stationGroups.FirstOrDefault()?.Station;

        // Dönem Bazlı KPI Hesaplama Fonksiyonu
        FuelPeriodKpiDto CalculatePeriodKpi(IEnumerable<FuelLog> periodLogs, string label)
        {
            var pList = periodLogs.ToList();
            decimal pExp = pList.Sum(f => f.Tutar);
            decimal pLit = pList.Sum(f => f.MiktarLitre);
            int pKm = pList.Where(f => f.GidilenKm.HasValue).Sum(f => f.GidilenKm!.Value);
            decimal pAvgPrice = pLit > 0 ? Math.Round(pExp / pLit, 2) : 0;
            decimal pCostKm = pKm > 0 ? Math.Round(pExp / pKm, 2) : 0;
            decimal pLit100Km = pKm > 0 ? Math.Round((pLit / pKm) * 100, 2) : 0;

            return new FuelPeriodKpiDto(pExp, pLit, pKm, pCostKm, pLit100Km, pAvgPrice, pList.Count, label);
        }

        // İçinde bulunulan Yıl ve Ay
        int currentYear = DateTime.Now.Year;
        int currentMonth = DateTime.Now.Month;

        var yearLogs = logs.Where(f => f.Tarih.Year == currentYear);
        var monthLogs = logs.Where(f => f.Tarih.Year == currentYear && f.Tarih.Month == currentMonth);

        var currentYearKpi = CalculatePeriodKpi(yearLogs, $"{currentYear} Yılı Toplamı");
        var currentMonthKpi = CalculatePeriodKpi(monthLogs, new DateTime(currentYear, currentMonth, 1).ToString("MMMM yyyy", new System.Globalization.CultureInfo("tr-TR")));

        // Aylık Trend
        var monthlyTrend = logs
            .GroupBy(f => new { f.Tarih.Year, f.Tarih.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .Select(g =>
            {
                var monthKm = g.Where(x => x.GidilenKm.HasValue).Sum(x => x.GidilenKm!.Value);
                var monthExp = g.Sum(x => x.Tutar);
                var monthLiters = g.Sum(x => x.MiktarLitre);
                var monthCostKm = monthKm > 0 ? Math.Round(monthExp / monthKm, 2) : 0;

                var dt = new DateTime(g.Key.Year, g.Key.Month, 1);
                return new FuelMonthlyStatDto(
                    $"{g.Key.Year}-{g.Key.Month:D2}",
                    dt.ToString("MMM yyyy", new System.Globalization.CultureInfo("tr-TR")),
                    monthExp,
                    monthLiters,
                    monthCostKm);
            })
            .ToList();

        var summary = new FuelSummaryDto(
            totalExpense,
            totalLiters,
            avgLiterPrice,
            totalKm,
            avgCostPerKm,
            avgLitersPer100Km,
            topStation,
            logs.Count,
            currentYearKpi,
            currentMonthKpi,
            stationGroups,
            monthlyTrend);

        return new FuelLogsResponseDto(dtoList, summary);
    }
}

public record CreateFuelLogCommand(
    DateTime Tarih,
    decimal Tutar,
    decimal? LitreFiyat,
    decimal? MiktarLitre,
    int AracKm,
    string? Benzinlik,
    string? Konum,
    string? Not,
    string? FisGorselUrl) : IRequest<FuelLogDto>;

public class CreateFuelLogCommandHandler : IRequestHandler<CreateFuelLogCommand, FuelLogDto>
{
    private readonly IAppDbContext _context;

    public CreateFuelLogCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<FuelLogDto> Handle(CreateFuelLogCommand request, CancellationToken cancellationToken)
    {
        decimal litreFiyat = request.LitreFiyat ?? 0;
        decimal miktarLitre = request.MiktarLitre ?? 0;

        if (litreFiyat == 0 && miktarLitre > 0 && request.Tutar > 0)
        {
            litreFiyat = Math.Round(request.Tutar / miktarLitre, 3);
        }
        else if (miktarLitre == 0 && litreFiyat > 0 && request.Tutar > 0)
        {
            miktarLitre = Math.Round(request.Tutar / litreFiyat, 3);
        }

        // Çift Kayıt (Duplicate Prevention) Kontrolü
        var existingDuplicate = await _context.FuelLogs
            .Where(f => f.Tarih.Date == request.Tarih.Date && 
                        Math.Abs(f.Tutar - request.Tutar) < 0.05m && 
                        (request.AracKm <= 0 || f.AracKm == request.AracKm))
            .FirstOrDefaultAsync(cancellationToken);

        if (existingDuplicate != null)
        {
            throw new InvalidOperationException($"Bu tarih ({request.Tarih:dd.MM.yyyy}) ve tutarda ({request.Tutar:N2} ₺) bir akaryakıt kaydı zaten mevcut.");
        }

        // Önceki kaydı bul (Tarihe ve Km'ye göre bir önceki kayıt)
        var previousLog = await _context.FuelLogs
            .Where(f => f.AracKm < request.AracKm && f.Tarih <= request.Tarih)
            .OrderByDescending(f => f.AracKm)
            .FirstOrDefaultAsync(cancellationToken);

        int? gidilenKm = null;
        int? alisSikligiGun = null;
        decimal? ortalamaTuketimTL = null;
        decimal? ortalamaTuketimLt = null;

        if (previousLog != null)
        {
            gidilenKm = request.AracKm - previousLog.AracKm;
            alisSikligiGun = Math.Max(0, (int)(request.Tarih.Date - previousLog.Tarih.Date).TotalDays);

            if (gidilenKm.Value > 0)
            {
                ortalamaTuketimTL = Math.Round(request.Tutar / gidilenKm.Value, 3);
                if (miktarLitre > 0)
                {
                    ortalamaTuketimLt = Math.Round((miktarLitre / gidilenKm.Value) * 100, 3);
                }
            }
        }

        var fuelLog = new FuelLog
        {
            Tarih = request.Tarih,
            Tutar = request.Tutar,
            LitreFiyat = litreFiyat,
            MiktarLitre = miktarLitre,
            AracKm = request.AracKm,
            GidilenKm = gidilenKm,
            OrtalamaTuketimLt = ortalamaTuketimLt,
            OrtalamaTuketimTL = ortalamaTuketimTL,
            AlisSikligiGun = alisSikligiGun,
            Benzinlik = request.Benzinlik?.Trim(),
            Konum = request.Konum?.Trim(),
            Not = request.Not?.Trim(),
            FisGorselUrl = request.FisGorselUrl
        };

        _context.FuelLogs.Add(fuelLog);
        await _context.SaveChangesAsync(cancellationToken);

        return new FuelLogDto(
            fuelLog.Id,
            fuelLog.Tarih,
            fuelLog.Tarih.ToString("MMMM", new System.Globalization.CultureInfo("tr-TR")),
            fuelLog.Tutar,
            fuelLog.LitreFiyat,
            fuelLog.MiktarLitre,
            fuelLog.AracKm,
            fuelLog.GidilenKm,
            fuelLog.OrtalamaTuketimLt,
            fuelLog.OrtalamaTuketimTL,
            fuelLog.AlisSikligiGun,
            fuelLog.Benzinlik,
            fuelLog.Konum,
            fuelLog.Not,
            fuelLog.FisGorselUrl);
    }
}

public record UpdateFuelLogCommand(
    int Id,
    DateTime Tarih,
    decimal Tutar,
    decimal LitreFiyat,
    decimal MiktarLitre,
    int AracKm,
    string? Benzinlik,
    string? Konum,
    string? Not) : IRequest<FuelLogDto>;

public class UpdateFuelLogCommandHandler : IRequestHandler<UpdateFuelLogCommand, FuelLogDto>
{
    private readonly IAppDbContext _context;

    public UpdateFuelLogCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<FuelLogDto> Handle(UpdateFuelLogCommand request, CancellationToken cancellationToken)
    {
        var log = await _context.FuelLogs.FirstOrDefaultAsync(f => f.Id == request.Id, cancellationToken);
        if (log == null)
            throw new KeyNotFoundException("Yakıt kaydı bulunamadı.");

        log.Tarih = request.Tarih;
        log.Tutar = request.Tutar;
        log.LitreFiyat = request.LitreFiyat;
        log.MiktarLitre = request.MiktarLitre;
        log.AracKm = request.AracKm;
        log.Benzinlik = request.Benzinlik?.Trim();
        log.Konum = request.Konum?.Trim();
        log.Not = request.Not?.Trim();

        // Önceki kaydı bulup tekrar hesapla
        var previousLog = await _context.FuelLogs
            .Where(f => f.Id != log.Id && f.AracKm < log.AracKm && f.Tarih <= log.Tarih)
            .OrderByDescending(f => f.AracKm)
            .FirstOrDefaultAsync(cancellationToken);

        if (previousLog != null)
        {
            log.GidilenKm = log.AracKm - previousLog.AracKm;
            log.AlisSikligiGun = Math.Max(0, (int)(log.Tarih.Date - previousLog.Tarih.Date).TotalDays);

            if (log.GidilenKm.Value > 0)
            {
                log.OrtalamaTuketimTL = Math.Round(log.Tutar / log.GidilenKm.Value, 3);
                if (log.MiktarLitre > 0)
                {
                    log.OrtalamaTuketimLt = Math.Round((log.MiktarLitre / log.GidilenKm.Value) * 100, 3);
                }
            }
        }
        else
        {
            log.GidilenKm = null;
            log.AlisSikligiGun = null;
            log.OrtalamaTuketimTL = null;
            log.OrtalamaTuketimLt = null;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new FuelLogDto(
            log.Id,
            log.Tarih,
            log.Tarih.ToString("MMMM", new System.Globalization.CultureInfo("tr-TR")),
            log.Tutar,
            log.LitreFiyat,
            log.MiktarLitre,
            log.AracKm,
            log.GidilenKm,
            log.OrtalamaTuketimLt,
            log.OrtalamaTuketimTL,
            log.AlisSikligiGun,
            log.Benzinlik,
            log.Konum,
            log.Not,
            log.FisGorselUrl);
    }
}

public record DeleteFuelLogCommand(int Id) : IRequest<bool>;

public class DeleteFuelLogCommandHandler : IRequestHandler<DeleteFuelLogCommand, bool>
{
    private readonly IAppDbContext _context;

    public DeleteFuelLogCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteFuelLogCommand request, CancellationToken cancellationToken)
    {
        var log = await _context.FuelLogs.FirstOrDefaultAsync(f => f.Id == request.Id, cancellationToken);
        if (log == null) return false;

        log.IsDeleted = true;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
