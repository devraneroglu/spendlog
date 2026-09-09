using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SpendLogV2.Domain.Entities;
using SpendLogV2.Domain.Enums;
using SpendLogV2.Infrastructure.Data;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;

namespace SpendLogV2.Infrastructure.Services;

public class TelegramMessageProcessor : ITelegramMessageProcessor
{
    private readonly SpendLogDbContext _context;
    private readonly ILogger<TelegramMessageProcessor> _logger;
    private static readonly DateTime _startTime = DateTime.UtcNow;

    public TelegramMessageProcessor(SpendLogDbContext context, ILogger<TelegramMessageProcessor> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task ProcessUpdateAsync(ITelegramBotClient botClient, Update update, AppUser? resolvedUser = null, CancellationToken cancellationToken = default)
    {
        if (update.Message is not { } message)
            return;

        var chatId = message.Chat.Id;
        var text = (message.Text ?? message.Caption ?? "").Trim();

        AppUser? user = resolvedUser;

        // Eğer resolvedUser verilmediyse (örneğin ortak resmi bot long polling döngüsünde), ChatId ile eşleştir
        if (user == null)
        {
            user = await _context.Users.FirstOrDefaultAsync(u => u.TelegramChatId == chatId, cancellationToken);
            if (user == null)
            {
                if (text.StartsWith("/start"))
                {
                    await botClient.SendMessage(
                        chatId: message.Chat.Id,
                        text: $"👋 Merhaba! SpendLog V2 Bot'a hoş geldiniz.\nChat ID'niz: `{chatId}`\n\nBu ID'yi SpendLog web panelinden profilinize tanımlayarak veya kendi botunuzu bağlayarak aktifleştirebilirsiniz.",
                        parseMode: ParseMode.Markdown,
                        cancellationToken: cancellationToken);
                }
                else
                {
                    await botClient.SendMessage(
                        chatId: message.Chat.Id,
                        text: $"⚠️ Hesabınız SpendLog ile eşleşmemiş. Lütfen Chat ID'nizi ({chatId}) SpendLog web panelinden kaydedin.",
                        cancellationToken: cancellationToken);
                }
                return;
            }
        }
        else
        {
            // Kullanıcı webhook üzerinden özel botuyla geldi ve /start attıysa Chat ID ve durumunu otomatik güncelle
            if (text.StartsWith("/start"))
            {
                if (user.TelegramChatId != chatId || !user.IsTelegramActive)
                {
                    user.TelegramChatId = chatId;
                    user.IsTelegramActive = true;
                    await _context.SaveChangesAsync(cancellationToken);
                }

                var welcomeMsg = $"👋 Merhaba Sayın *{user.FullName}*!\n\n" +
                                 $"🤖 *Özel SpendLog Telegram Asistanınız* başarıyla bağlandı ve kullanıma hazır.\n" +
                                 $"• Chat ID'niz: `{chatId}`\n" +
                                 $"• Güvenli Veri İzolasyonu: *Aktif*\n\n" +
                                 $"💡 *Kullanabileceğiniz Komutlar:*\n" +
                                 $"• `/bakiye` — Tüm hesap bakiyeleriniz ve likit toplam\n" +
                                 $"• `/kk [tutar] [not]` — Kredi kartı ön-ekstre harcama girişi\n" +
                                 $"• `/yakit [tutar] [lt] [km] [istasyon]` — Yakıt tüketim kaydı (veya doğrudan fiş fotoğrafı)\n" +
                                 $"• `/durum` — Sistem sağlık ve uptime raporu";

                await botClient.SendMessage(
                    chatId: message.Chat.Id,
                    text: welcomeMsg,
                    parseMode: ParseMode.Markdown,
                    cancellationToken: cancellationToken);
                return;
            }
        }

        // ⏰ Gecikmeli / Bayat Mesaj Denetimi (Stale Message Protection)
        // Eğer mesaj sunucu kapalıyken atılmışsa ve üzerinden > 3 dakika geçmişse finansal işlem yapılmaz
        var messageAge = DateTime.UtcNow - message.Date;
        if (messageAge.TotalMinutes > 3 && !text.StartsWith("/start", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Bayat mesaj algılandı (Gecikme: {Minutes:N1} dk, ChatId: {ChatId}, Metin: {Text})", messageAge.TotalMinutes, chatId, text);
            
            var staleWarning = $"⚠️ *GECİKMELİ MESAJ TESPİT EDİLDİ!*\n\n" +
                               $"Mesajınız sistem çevrimdışıyken (`{message.Date.ToLocalTime():HH:mm:ss}`) gönderilmiş.\n\n" +
                               $"🛡️ *Finansal veri güvenliği ve çift kayıtları önlemek amacıyla bu komut otomatik yürütülmedi.*\n\n" +
                               $"🔄 _İşlemi gerçekleştirmek için lütfen komutunuzu tekrar yazınız._";

            await botClient.SendMessage(chatId: message.Chat.Id, text: staleWarning, parseMode: ParseMode.Markdown, cancellationToken: cancellationToken);
            return;
        }

        // 0. /durum, /ping, /health veya /sistem Komutu
        if (text.Equals("/durum", StringComparison.OrdinalIgnoreCase) || 
            text.Equals("/ping", StringComparison.OrdinalIgnoreCase) || 
            text.Equals("/health", StringComparison.OrdinalIgnoreCase) || 
            text.Equals("/sistem", StringComparison.OrdinalIgnoreCase) ||
            text.Equals("durum", StringComparison.OrdinalIgnoreCase) ||
            text.Equals("ping", StringComparison.OrdinalIgnoreCase))
        {
            var uptime = DateTime.UtcNow - _startTime;
            var uptimeStr = $"{(int)uptime.TotalHours} sa {uptime.Minutes} dk {uptime.Seconds} sn";

            var sw = System.Diagnostics.Stopwatch.StartNew();
            var canConnectDb = await _context.Database.CanConnectAsync(cancellationToken);
            sw.Stop();
            var dbPing = sw.ElapsedMilliseconds;

            var memBytes = System.Diagnostics.Process.GetCurrentProcess().WorkingSet64;
            var memMb = memBytes / (1024 * 1024);

            string scraperStatus = "🟢 Aktif (8000)";
            try
            {
                using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
                var scraperRes = await httpClient.GetAsync("http://localhost:8000/docs", cancellationToken);
                if (!scraperRes.IsSuccessStatusCode)
                {
                    scraperStatus = "🟡 Yanıt Vermiyor";
                }
            }
            catch
            {
                scraperStatus = "🔴 Çevrimdışı";
            }

            var totalAccounts = await _context.Accounts.IgnoreQueryFilters().CountAsync(a => a.UserId == user.Id && a.IsActive && !a.IsDeleted, cancellationToken);
            var totalTransactions = await _context.Transactions.IgnoreQueryFilters().CountAsync(t => t.UserId == user.Id && !t.IsDeleted, cancellationToken);

            var statusMsg = $"🖥️ *SPENDLOG V2 SİSTEM DURUMU*\n\n" +
                            $"• *Backend API:* 🟢 `Online`\n" +
                            $"• *Uptime (Çalışma Süresi):* `{uptimeStr}`\n" +
                            $"• *MSSQL DB Yanıt:* `{dbPing} ms` {(canConnectDb ? "🟢" : "🔴")}\n" +
                            $"• *Scraper Mikroservisi:* {scraperStatus}\n" +
                            $"• *RAM Tüketimi:* `{memMb} MB`\n" +
                            $"• *Kullanıcı Verileri:* `{totalAccounts} Hesap / {totalTransactions} Hareket`\n" +
                            $"• *Bot Modu:* {(string.IsNullOrEmpty(user.CustomTelegramBotToken) ? "Resmi Ortak Bot" : $"Özel Bot (@{user.CustomTelegramBotUsername})")}\n" +
                            $"• *Altyapı:* `.NET 10 (Production Ready)`\n\n" +
                            $"⚡ _Tüm finansal otomasyon ve bot motorları aktif._";

            await botClient.SendMessage(chatId: message.Chat.Id, text: statusMsg, parseMode: ParseMode.Markdown, cancellationToken: cancellationToken);
            return;
        }

        // Kullanıcının aktif Telegram Kurallarını al
        var rules = await _context.TelegramRules
            .IgnoreQueryFilters()
            .Where(r => r.UserId == user.Id && r.IsActive && !r.IsDeleted)
            .ToListAsync(cancellationToken);

        // 1. /bakiye Komutu
        if (text.Equals("/bakiye", StringComparison.OrdinalIgnoreCase) || text.Equals("bakiye", StringComparison.OrdinalIgnoreCase))
        {
            var accounts = await _context.Accounts
                .IgnoreQueryFilters()
                .Where(a => a.UserId == user.Id && a.IsActive && !a.IsDeleted)
                .ToListAsync(cancellationToken);

            var total = accounts.Sum(a => a.CurrentBalance);
            var msg = "💳 *SPENDLOG HESAP BAKİYELERİNİZ*\n\n";

            foreach (var acc in accounts)
            {
                msg += $"• *{acc.Name}*: `{acc.CurrentBalance:N2} ₺`\n";
            }
            msg += $"\n💰 *Toplam Likit Varlık*: `{total:N2} ₺`";

            await botClient.SendMessage(chatId: message.Chat.Id, text: msg, parseMode: ParseMode.Markdown, cancellationToken: cancellationToken);
            return;
        }

        // 1.5. /kk veya /kart Komutu (Canlı Kredi Kartı Ön-Ekstre Harcaması)
        if (text.StartsWith("/kk", StringComparison.OrdinalIgnoreCase) || text.StartsWith("/kart", StringComparison.OrdinalIgnoreCase))
        {
            var rawParams = text.Substring(text.StartsWith("/kart", StringComparison.OrdinalIgnoreCase) ? 5 : 3).Trim();

            var amountMatch = Regex.Match(rawParams, @"(?<amount>\d+([.,]\d{1,2})?)");
            if (amountMatch.Success && decimal.TryParse(amountMatch.Groups["amount"].Value.Replace(',', '.'), System.Globalization.CultureInfo.InvariantCulture, out var parsedAmount))
            {
                var absAmount = Math.Abs(parsedAmount);

                var note = rawParams.Remove(amountMatch.Index, amountMatch.Length).Trim();
                note = Regex.Replace(note, @"\b(TL|tl|TL\.|₺)\b", "", RegexOptions.IgnoreCase).Trim();
                note = Regex.Replace(note, @"\s+", " ").Trim();

                if (string.IsNullOrWhiteSpace(note))
                {
                    note = "Kredi Kartı Harcaması";
                }

                var cardAccount = await _context.Accounts
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(a => a.UserId == user.Id && a.IsActive && !a.IsDeleted && a.AccountType == AccountType.CreditCard, cancellationToken)
                    ?? await _context.Accounts
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(a => a.UserId == user.Id && a.IsActive && !a.IsDeleted && a.Name.ToLower().Contains("kredi"), cancellationToken);

                var now = DateTime.Now;
                int periodYear = now.Year;
                int periodMonth = now.Month;

                var lastOfficialStatement = await _context.CreditCardExpenses
                    .IgnoreQueryFilters()
                    .Where(c => c.UserId == user.Id && !c.IsLiveEntry && !c.IsDeleted)
                    .OrderByDescending(c => c.Year)
                    .ThenByDescending(c => c.Month)
                    .FirstOrDefaultAsync(cancellationToken);

                if (lastOfficialStatement != null)
                {
                    periodMonth = lastOfficialStatement.Month + 1;
                    periodYear = lastOfficialStatement.Year;
                    if (periodMonth > 12)
                    {
                        periodMonth = 1;
                        periodYear += 1;
                    }
                }

                // Çift Kayıt Kontrolü (Son 10 dk içinde aynı tutar ve notta ön-kayıt var mı?)
                var tenMinAgo = DateTime.Now.AddMinutes(-10);
                var dupLiveExpense = await _context.CreditCardExpenses
                    .IgnoreQueryFilters()
                    .Where(c => c.UserId == user.Id && 
                                !c.IsDeleted &&
                                c.Tutar == -absAmount && 
                                c.IsLiveEntry && 
                                c.Tarih >= tenMinAgo &&
                                (string.IsNullOrEmpty(note) || c.OriginalNote == note))
                    .FirstOrDefaultAsync(cancellationToken);

                if (dupLiveExpense != null)
                {
                    var dupMsg = $"⚠️ *MÜKERRER KREDİ KARTI HARCAMASI!*\n\n" +
                                 $"Bu harcama az önce `{dupLiveExpense.Tarih:HH:mm}` saatinde ön-ekstreye işlenmişti:\n" +
                                 $"• Tutar: `-{absAmount:N2} ₺`\n" +
                                 $"• Not: `{dupLiveExpense.OriginalNote ?? "Belirtilmedi"}`\n\n" +
                                 $"🛡️ _Mükerrer kayıt açılmadı._";

                    await botClient.SendMessage(chatId: message.Chat.Id, text: dupMsg, parseMode: ParseMode.Markdown, cancellationToken: cancellationToken);
                    return;
                }

                var ccExpense = new CreditCardExpense
                {
                    UserId = user.Id,
                    AccountId = cardAccount?.Id,
                    Tarih = DateTime.Now,
                    Tutar = -absAmount,
                    Description = note,
                    OriginalNote = note,
                    DescriptionInfo = "Telegram Ön-Kayıt",
                    Year = periodYear,
                    Month = periodMonth,
                    Day = DateTime.Now.Day,
                    IsExpense = true,
                    IsPayment = false,
                    IsLiveEntry = true,
                    CardNumberMasked = cardAccount?.CardNumberMasked
                };

                _context.CreditCardExpenses.Add(ccExpense);
                await _context.SaveChangesAsync(cancellationToken);

                var periodExpenses = await _context.CreditCardExpenses
                    .IgnoreQueryFilters()
                    .Where(c => c.UserId == user.Id && !c.IsDeleted && c.Year == periodYear && c.Month == periodMonth && c.IsExpense)
                    .ToListAsync(cancellationToken);

                var totalPeriodDebt = Math.Abs(periodExpenses.Sum(c => c.Tutar));
                var count = periodExpenses.Count;

                var resp = $"💳 *KREDİ KARTI HARCAMASI İŞLENDİ!*\n\n" +
                           $"• *Dönem:* `{periodMonth:D2}/{periodYear}`\n" +
                           $"• *Tutar:* `-{absAmount:N2} ₺`\n" +
                           $"• *Açıklama / Not:* `{note}`\n" +
                           $"• *Kart:* *{cardAccount?.Name ?? "Kredi Kartı"}*\n" +
                           $"• *Dönem Toplamı:* `{totalPeriodDebt:N2} ₺` ({count} Harcama)\n\n" +
                           $"⚡ _Ön-ekstreye kaydedildi. Ay sonu resmi PDF ekstre yüklendiğinde otomatik eşleştirilecektir._";

                await botClient.SendMessage(chatId: message.Chat.Id, text: resp, parseMode: ParseMode.Markdown, cancellationToken: cancellationToken);
                return;
            }
            else
            {
                await botClient.SendMessage(
                    chatId: message.Chat.Id,
                    text: "⚠️ *Kredi kartı harcaması için geçerli bir tutar bulunamadı.*\n\nÖrnekler:\n• `/kk 546 çocuklar ile kahve`\n• `/kk test harcaması 546 TL`\n• `/kart 120 yemek`",
                    parseMode: ParseMode.Markdown,
                    cancellationToken: cancellationToken);
                return;
            }
        }

        // 2. Dinamik Regex Kuralları Eşleştirme (Örn: /harca 150 market)
        foreach (var rule in rules)
        {
            var match = Regex.Match(text, rule.Pattern, RegexOptions.IgnoreCase);
            if (match.Success)
            {
                var amountGroup = match.Groups["amount"].Success ? match.Groups["amount"].Value : match.Groups[1].Value;
                if (decimal.TryParse(amountGroup.Replace(',', '.'), System.Globalization.CultureInfo.InvariantCulture, out var parsedAmount))
                {
                    var account = rule.DefaultAccountId.HasValue 
                        ? await _context.Accounts.IgnoreQueryFilters().FirstOrDefaultAsync(a => a.Id == rule.DefaultAccountId.Value && a.UserId == user.Id && !a.IsDeleted, cancellationToken)
                        : await _context.Accounts.IgnoreQueryFilters().FirstOrDefaultAsync(a => a.UserId == user.Id && a.IsActive && !a.IsDeleted, cancellationToken);

                    if (account != null)
                    {
                        var absAmount = Math.Abs(parsedAmount);
                        var tenMinutesAgo = DateTime.Now.AddMinutes(-10);

                        // Çift Kayıt (Duplicate) Kontrolü
                        var existingDuplicateTx = await _context.Transactions
                            .IgnoreQueryFilters()
                            .Where(t => t.UserId == user.Id && 
                                        !t.IsDeleted &&
                                        t.AccountId == account.Id && 
                                        t.Amount == absAmount && 
                                        t.TransactionDate >= tenMinutesAgo &&
                                        t.Description == $"Telegram Bot: {text}")
                            .FirstOrDefaultAsync(cancellationToken);

                        if (existingDuplicateTx != null)
                        {
                            var dupResp = $"⚠️ *MÜKERRER İŞLEM TESPİT EDİLDİ!*\n\n" +
                                          $"Bu harcama az önce `{existingDuplicateTx.TransactionDate:HH:mm}` saatinde zaten kaydedilmişti:\n" +
                                          $"• Tutar: `{existingDuplicateTx.Amount:N2} ₺`\n" +
                                          $"• Hesap: *{account.Name}*\n\n" +
                                          $"🛡️ _Çift bakiye düşümünü engellemek için mükerrer kayıt oluşturulmadı._";

                            await botClient.SendMessage(chatId: message.Chat.Id, text: dupResp, parseMode: ParseMode.Markdown, cancellationToken: cancellationToken);
                            return;
                        }

                        var transaction = new Transaction
                        {
                            UserId = user.Id,
                            AccountId = account.Id,
                            CategoryId = rule.DefaultCategoryId,
                            Amount = absAmount,
                            Type = rule.ActionType.Contains("Income", StringComparison.OrdinalIgnoreCase) ? TransactionType.Income : TransactionType.Expense,
                            TransactionDate = DateTime.Now,
                            Description = $"Telegram Bot: {text}",
                            Tags = "telegram"
                        };

                        if (transaction.Type == TransactionType.Income)
                            account.CurrentBalance += transaction.Amount;
                        else
                            account.CurrentBalance -= transaction.Amount;

                        _context.Transactions.Add(transaction);
                        await _context.SaveChangesAsync(cancellationToken);

                        var resp = $"✅ *İşlem Kaydedildi!*\n\n" +
                                   $"• Tutar: `{(transaction.Type == TransactionType.Income ? "+" : "-")}{transaction.Amount:N2} ₺`\n" +
                                   $"• Hesap: *{account.Name}*\n" +
                                   $"• Güncel Bakiye: `{account.CurrentBalance:N2} ₺`";

                        await botClient.SendMessage(chatId: message.Chat.Id, text: resp, parseMode: ParseMode.Markdown, cancellationToken: cancellationToken);
                        return;
                    }
                }
            }
        }

        // 3. FOTOĞRAF GELDİĞİNDE (AKARYAKIT FİŞİ / POMPA EKRANI VISION AI)
        if (message.Photo != null && message.Photo.Length > 0)
        {
            await botClient.SendMessage(chatId: message.Chat.Id, text: "🔍 *Fiş görseli analiz ediliyor, lütfen bekleyin...*", parseMode: ParseMode.Markdown, cancellationToken: cancellationToken);

            try
            {
                var photo = message.Photo.Last();
                var file = await botClient.GetFile(photo.FileId, cancellationToken);
                
                using var memoryStream = new MemoryStream();
                await botClient.DownloadFile(file.FilePath!, memoryStream, cancellationToken);
                var imageBytes = memoryStream.ToArray();

                // Python Scraper Service Vision API Çağrısı
                using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
                using var content = new MultipartFormDataContent();
                content.Add(new ByteArrayContent(imageBytes), "file", "receipt.jpg");

                var response = await httpClient.PostAsync("http://localhost:8000/api/receipts/parse-fuel-receipt", content, cancellationToken);
                if (response.IsSuccessStatusCode)
                {
                    var jsonString = await response.Content.ReadAsStringAsync(cancellationToken);
                    using var doc = System.Text.Json.JsonDocument.Parse(jsonString);
                    var root = doc.RootElement;

                    if (root.TryGetProperty("data", out var data))
                    {
                        decimal tutar = data.TryGetProperty("total_amount", out var ta) ? ta.GetDecimal() : 0;
                        decimal litreFiyat = data.TryGetProperty("unit_price", out var up) ? up.GetDecimal() : 0;
                        decimal miktarLitre = data.TryGetProperty("quantity_liters", out var ql) ? ql.GetDecimal() : 0;
                        string station = data.TryGetProperty("station_name", out var sn) ? sn.GetString() ?? "Akaryakıt" : "Akaryakıt";
                        string location = data.TryGetProperty("location", out var loc) ? loc.GetString() ?? "" : "";
                        DateTime receiptDate = data.TryGetProperty("date", out var dt) && DateTime.TryParse(dt.GetString(), out var pDate) ? pDate : DateTime.Now;

                        int km = 0;
                        if (data.TryGetProperty("vehicle_km", out var vkm) && vkm.ValueKind == System.Text.Json.JsonValueKind.Number)
                        {
                            km = vkm.GetInt32();
                        }

                        if (km == 0 && !string.IsNullOrWhiteSpace(message.Caption))
                        {
                            var kmMatch = Regex.Match(message.Caption, @"\b(?<km>\d{4,7})\b");
                            if (kmMatch.Success && int.TryParse(kmMatch.Groups["km"].Value, out var parsedKm))
                            {
                                km = parsedKm;
                            }
                        }

                        var lastFuel = await _context.FuelLogs.IgnoreQueryFilters().Where(f => f.UserId == user.Id && !f.IsDeleted).OrderByDescending(f => f.AracKm).FirstOrDefaultAsync(cancellationToken);
                        
                        var existingDuplicateFuel = await _context.FuelLogs
                            .IgnoreQueryFilters()
                            .Where(f => f.UserId == user.Id && !f.IsDeleted)
                            .Where(f => Math.Abs(f.Tutar - tutar) < 0.05m && 
                                        (f.Tarih.Date == receiptDate.Date || 
                                         (km > 0 && f.AracKm == km) || 
                                         (f.Benzinlik == station && Math.Abs((f.Tarih - receiptDate).TotalDays) <= 1)))
                            .FirstOrDefaultAsync(cancellationToken);

                        if (existingDuplicateFuel != null)
                        {
                            var dupMsg = $"⚠️ *MÜKERRER AKARYAKIT FİŞİ TESPİT EDİLDİ!*\n\n" +
                                         $"Bu fiş daha önce sisteme işlenmiş görünüyor:\n" +
                                         $"• *Tarih:* `{existingDuplicateFuel.Tarih:dd.MM.yyyy}`\n" +
                                         $"• *Tutar:* `{existingDuplicateFuel.Tutar:N2} ₺`\n" +
                                         $"• *İstasyon:* `{existingDuplicateFuel.Benzinlik}`\n" +
                                         $"• *Araç Km:* `{existingDuplicateFuel.AracKm}`\n\n" +
                                         $"🛡️ _Veri bütünlüğünü korumak için mükerrer kayıt oluşturulmadı._";

                            await botClient.SendMessage(chatId: message.Chat.Id, text: dupMsg, parseMode: ParseMode.Markdown, cancellationToken: cancellationToken);
                            return;
                        }

                        int? gidilenKm = null;
                        decimal? ortTL = null;
                        decimal? ortLt = null;

                        if (lastFuel != null && km > lastFuel.AracKm)
                        {
                            gidilenKm = km - lastFuel.AracKm;
                            if (gidilenKm > 0)
                            {
                                ortTL = Math.Round(tutar / gidilenKm.Value, 2);
                                if (miktarLitre > 0)
                                    ortLt = Math.Round((miktarLitre / gidilenKm.Value) * 100, 2);
                            }
                        }

                        var fuelLog = new FuelLog
                        {
                            UserId = user.Id,
                            Tarih = receiptDate,
                            Tutar = tutar,
                            LitreFiyat = litreFiyat,
                            MiktarLitre = miktarLitre,
                            AracKm = km,
                            GidilenKm = gidilenKm,
                            OrtalamaTuketimTL = ortTL,
                            OrtalamaTuketimLt = ortLt,
                            Benzinlik = station,
                            Konum = location,
                            Not = message.Caption
                        };

                        _context.FuelLogs.Add(fuelLog);
                        await _context.SaveChangesAsync(cancellationToken);

                        var successMsg = $"⛽ *YENİ AKARYAKIT KAYDI İŞLENDİ*\n\n" +
                                         $"🏢 *İstasyon:* `{station}` ({location})\n" +
                                         $"💰 *Tutar:* `{tutar:N2} ₺`\n" +
                                         $"⛽ *Miktar:* `{miktarLitre:N2} LT` @ `{litreFiyat:N2} ₺/LT`\n" +
                                         $"🚗 *Araç Km:* `{km}` {(gidilenKm.HasValue ? $"(_+{gidilenKm.Value} km_)" : "")}\n" +
                                         (ortTL.HasValue ? $"📊 *Ort. Tüketim:* `{ortTL:N2} ₺/km` (`{ortLt:N2} LT/100km`)\n" : "") +
                                         $"📅 *Tarih:* `{receiptDate:dd.MM.yyyy HH:mm}`\n\n" +
                                         $"✅ *Yakıt Takibi tablonuza başarıyla kaydedildi.*";

                        await botClient.SendMessage(chatId: message.Chat.Id, text: successMsg, parseMode: ParseMode.Markdown, cancellationToken: cancellationToken);
                        return;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Fiş fotoğrafı işlenirken hata oluştu.");
                await botClient.SendMessage(chatId: message.Chat.Id, text: "⚠️ Fiş görseli ayrıştırılırken bir hata oluştu. Lütfen görselin net olduğundan emin olun.", cancellationToken: cancellationToken);
                return;
            }
        }

        // 4. /yakit Komutu (Örn: /yakit 500 26.3 30099 Opet)
        if (text.StartsWith("/yakit", StringComparison.OrdinalIgnoreCase))
        {
            var parts = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length >= 4 &&
                decimal.TryParse(parts[1].Replace(',', '.'), System.Globalization.CultureInfo.InvariantCulture, out var tutar) &&
                decimal.TryParse(parts[2].Replace(',', '.'), System.Globalization.CultureInfo.InvariantCulture, out var litre) &&
                int.TryParse(parts[3], out var km))
            {
                string station = parts.Length > 4 ? string.Join(' ', parts.Skip(4)) : "Akaryakıt";
                decimal litreFiyat = litre > 0 ? Math.Round(tutar / litre, 2) : 0;

                var existingDuplicateFuel = await _context.FuelLogs
                    .IgnoreQueryFilters()
                    .Where(f => f.UserId == user.Id && !f.IsDeleted)
                    .Where(f => Math.Abs(f.Tutar - tutar) < 0.05m && 
                                (f.Tarih.Date == DateTime.Today || (km > 0 && f.AracKm == km)))
                    .FirstOrDefaultAsync(cancellationToken);

                if (existingDuplicateFuel != null)
                {
                    var dupMsg = $"⚠️ *MÜKERRER YAKIT GİRİŞİ!*\n\n" +
                                 $"Bugün `{tutar:N2} ₺` tutarında veya `{km}` km için bir kayıt zaten mevcut.\n" +
                                 $"🛡️ _Mükerrer kayıt açılmadı._";

                    await botClient.SendMessage(chatId: message.Chat.Id, text: dupMsg, parseMode: ParseMode.Markdown, cancellationToken: cancellationToken);
                    return;
                }

                var lastFuel = await _context.FuelLogs.IgnoreQueryFilters().Where(f => f.UserId == user.Id && !f.IsDeleted).OrderByDescending(f => f.AracKm).FirstOrDefaultAsync(cancellationToken);
                int? gidilenKm = (lastFuel != null && km > lastFuel.AracKm) ? km - lastFuel.AracKm : null;
                decimal? ortTL = gidilenKm.HasValue && gidilenKm > 0 ? Math.Round(tutar / gidilenKm.Value, 2) : null;
                decimal? ortLt = gidilenKm.HasValue && gidilenKm > 0 && litre > 0 ? Math.Round((litre / gidilenKm.Value) * 100, 2) : null;

                var fuelLog = new FuelLog
                {
                    UserId = user.Id,
                    Tarih = DateTime.Now,
                    Tutar = tutar,
                    LitreFiyat = litreFiyat,
                    MiktarLitre = litre,
                    AracKm = km,
                    GidilenKm = gidilenKm,
                    OrtalamaTuketimTL = ortTL,
                    OrtalamaTuketimLt = ortLt,
                    Benzinlik = station,
                };

                _context.FuelLogs.Add(fuelLog);
                await _context.SaveChangesAsync(cancellationToken);

                var successMsg = $"⛽ *AKARYAKIT KAYDI EKLENDİ*\n\n" +
                                 $"🏢 *İstasyon:* `{station}`\n" +
                                 $"💰 *Tutar:* `{tutar:N2} ₺` ({litre:N2} LT @ {litreFiyat:N2} ₺)\n" +
                                 $"🚗 *Km:* `{km}` {(gidilenKm.HasValue ? $"(_+{gidilenKm.Value} km_)" : "")}\n" +
                                 (ortTL.HasValue ? $"📊 *Ortalama:* `{ortTL:N2} ₺/km`\n" : "") +
                                 $"✅ *Tabloya işlendi.*";

                await botClient.SendMessage(chatId: message.Chat.Id, text: successMsg, parseMode: ParseMode.Markdown, cancellationToken: cancellationToken);
                return;
            }
        }

        // Tanımlanamayan komut
        await botClient.SendMessage(
            chatId: message.Chat.Id,
            text: "❓ Komut anlaşılamadı.\n\n• Bakiye sorgulamak için `/bakiye`\n• Kredi kartı harcaması için `/kk 500 yemek`\n• Yakıt eklemek için fiş fotoğrafı atabilir veya `/yakit 500 26.3 30099 Opet` yazabilirsiniz.",
            cancellationToken: cancellationToken);
    }
}
