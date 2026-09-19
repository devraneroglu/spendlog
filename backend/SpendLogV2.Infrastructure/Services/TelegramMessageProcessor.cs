using System.Net.Http.Json;
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
    private const string StandardHelpMessage = "💡 Bakiye için `/bakiye`, yakıt için `/yakit`, kredi kartı için `/kk`, sistem kontrolü için `/durum` yazabilirsiniz.";

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

        // 0.0. /help, help, /yardim, yardim Komutları
        if (text.Equals("/help", StringComparison.OrdinalIgnoreCase) ||
            text.Equals("help", StringComparison.OrdinalIgnoreCase) ||
            text.Equals("/yardim", StringComparison.OrdinalIgnoreCase) ||
            text.Equals("/yardım", StringComparison.OrdinalIgnoreCase) ||
            text.Equals("yardim", StringComparison.OrdinalIgnoreCase) ||
            text.Equals("yardım", StringComparison.OrdinalIgnoreCase) ||
            text.Equals("komutlar", StringComparison.OrdinalIgnoreCase) ||
            text.Equals("/komutlar", StringComparison.OrdinalIgnoreCase) ||
            text.Equals("bilgi", StringComparison.OrdinalIgnoreCase))
        {
            await botClient.SendMessage(
                chatId: message.Chat.Id,
                text: StandardHelpMessage,
                parseMode: ParseMode.Markdown,
                cancellationToken: cancellationToken);
            return;
        }

        // 0.0.1. /temizle, /clear, clear-all Komutları (Son 80 mesajı temizleme)
        if (text.Equals("/temizle", StringComparison.OrdinalIgnoreCase) ||
            text.Equals("temizle", StringComparison.OrdinalIgnoreCase) ||
            text.Equals("/clear", StringComparison.OrdinalIgnoreCase) ||
            text.Equals("clear", StringComparison.OrdinalIgnoreCase) ||
            text.Equals("/clearall", StringComparison.OrdinalIgnoreCase) ||
            text.Equals("clear-all", StringComparison.OrdinalIgnoreCase) ||
            text.Equals("clearall", StringComparison.OrdinalIgnoreCase))
        {
            var currentMsgId = message.MessageId;
            var targetCount = 80;

            for (int msgId = currentMsgId; msgId >= Math.Max(1, currentMsgId - targetCount); msgId--)
            {
                try
                {
                    await botClient.DeleteMessage(chatId: message.Chat.Id, messageId: msgId, cancellationToken: cancellationToken);
                }
                catch
                {
                    // 48 saati aşmış veya zaten silinmiş mesajları sessizce atla
                }
            }

            var feedbackMsg = await botClient.SendMessage(
                chatId: message.Chat.Id,
                text: "🧹 _Sohbet geçmişi temizlendi._",
                parseMode: ParseMode.Markdown,
                cancellationToken: cancellationToken);

            // 3 saniye sonra bildirim mesajını da kaldırarak sohbeti tertemiz bırak
            _ = Task.Run(async () =>
            {
                await Task.Delay(3000);
                try
                {
                    await botClient.DeleteMessage(chatId: message.Chat.Id, messageId: feedbackMsg.MessageId);
                }
                catch { }
            });

            return;
        }

        // Kullanıcının tüm Telegram Kurallarını al (Aktif ve Pasif dahil)
        var allRules = await _context.TelegramRules
            .IgnoreQueryFilters()
            .Where(r => r.UserId == user.Id && !r.IsDeleted)
            .ToListAsync(cancellationToken);

        bool IsRuleDisabled(params string[] aliases)
        {
            return allRules.Any(r => !r.IsActive && aliases.Any(a => 
                r.Command.Equals(a, StringComparison.OrdinalIgnoreCase) ||
                r.Command.Equals("/" + a, StringComparison.OrdinalIgnoreCase) ||
                r.ActionType.Equals(a, StringComparison.OrdinalIgnoreCase) ||
                r.Title.Contains(a, StringComparison.OrdinalIgnoreCase)));
        }

        // 0. /durum, /ping, /health veya /sistem Komutu
        if (text.Equals("/durum", StringComparison.OrdinalIgnoreCase) || 
            text.Equals("/ping", StringComparison.OrdinalIgnoreCase) || 
            text.Equals("/health", StringComparison.OrdinalIgnoreCase) || 
            text.Equals("/sistem", StringComparison.OrdinalIgnoreCase) ||
            text.Equals("durum", StringComparison.OrdinalIgnoreCase) ||
            text.Equals("ping", StringComparison.OrdinalIgnoreCase))
        {
            if (IsRuleDisabled("durum", "GetSystemStatus", "sistem", "health", "ping"))
            {
                await SendSafeMessageAsync(botClient, message.Chat.Id, "⚠️ *Sistem Durumu* kuralı (`/durum`) şu anda devre dışıdır. SpendLog web panelinden aktifleştirebilirsiniz.", ParseMode.Markdown, cancellationToken);
                return;
            }

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

            var cleanBotName = (user.CustomTelegramBotUsername ?? "").Replace("_", @"\_");
            var botMode = string.IsNullOrEmpty(user.CustomTelegramBotToken) ? "Resmi Ortak Bot" : $"Özel Bot (@{cleanBotName})";

            var statusMsg = $"🖥️ *SPENDLOG V2 SİSTEM DURUMU*\n\n" +
                            $"• *Backend API:* 🟢 `Online`\n" +
                            $"• *Uptime (Çalışma Süresi):* `{uptimeStr}`\n" +
                            $"• *MSSQL DB Yanıt:* `{dbPing} ms` {(canConnectDb ? "🟢" : "🔴")}\n" +
                            $"• *Scraper Mikroservisi:* {scraperStatus}\n" +
                            $"• *RAM Tüketimi:* `{memMb} MB`\n" +
                            $"• *Kullanıcı Verileri:* `{totalAccounts} Hesap / {totalTransactions} Hareket`\n" +
                            $"• *Bot Modu:* {botMode}\n" +
                            $"• *Altyapı:* `.NET 10 (Production Ready)`\n\n" +
                            $"⚡ _Tüm finansal otomasyon ve bot motorları aktif._";

            await SendSafeMessageAsync(botClient, message.Chat.Id, statusMsg, ParseMode.Markdown, cancellationToken);
            return;
        }

        // 1. /bakiye Komutu (SADECE Vadesiz Banka Hesapları - AccountType.Bank)
        if (text.Equals("/bakiye", StringComparison.OrdinalIgnoreCase) || text.Equals("bakiye", StringComparison.OrdinalIgnoreCase))
        {
            if (IsRuleDisabled("bakiye", "GetBalance"))
            {
                await SendSafeMessageAsync(botClient, message.Chat.Id, "⚠️ *Bakiye Sorgulama* kuralı (`/bakiye`) şu anda devre dışıdır. SpendLog web panelinden aktifleştirebilirsiniz.", ParseMode.Markdown, cancellationToken);
                return;
            }

            var bankAccounts = await _context.Accounts
                .IgnoreQueryFilters()
                .Where(a => a.UserId == user.Id && a.IsActive && !a.IsDeleted && a.AccountType == AccountType.Bank)
                .ToListAsync(cancellationToken);

            var total = bankAccounts.Sum(a => a.CurrentBalance);
            var msg = "💳 *SPENDLOG VADESİZ BANKA HESAP BAKİYELERİNİZ*\n\n";

            if (bankAccounts.Count == 0)
            {
                msg += "• Tanımlı vadesiz banka hesabı bulunamadı.\n";
            }
            else
            {
                foreach (var acc in bankAccounts)
                {
                    msg += $"• *{acc.Name}*: `{acc.CurrentBalance:N2} ₺`\n";
                }
            }
            msg += $"\n💰 *Toplam Vadesiz Banka Bakiyesi*: `{total:N2} ₺`";

            await SendSafeMessageAsync(botClient, message.Chat.Id, msg, ParseMode.Markdown, cancellationToken);
            return;
        }

        // 1.5. /kk veya /kart Komutu (Canlı Kredi Kartı Ön-Ekstre Harcaması)
        if (text.StartsWith("/kk", StringComparison.OrdinalIgnoreCase) || text.StartsWith("/kart", StringComparison.OrdinalIgnoreCase))
        {
            if (IsRuleDisabled("kk", "kart", "CreateCreditCardExpense"))
            {
                await SendSafeMessageAsync(botClient, message.Chat.Id, "⚠️ *Kredi Kartı Harcaması* kuralı (`/kk`) şu anda devre dışıdır. SpendLog web panelinden aktifleştirebilirsiniz.", ParseMode.Markdown, cancellationToken);
                return;
            }

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

        // 1.8. Aylık Harcama Raporu (Örn: 2026-8 veya 2026-08 veya /rapor 2026-8)
        var monthlyReportMatch = Regex.Match(text, @"^(?:/rapor\s+)?(?<year>\d{4})-(?<month>1[0-2]|0[1-9]|[1-9])$", RegexOptions.IgnoreCase);
        if (monthlyReportMatch.Success)
        {
            if (IsRuleDisabled("rapor", "MonthlyReport"))
            {
                await SendSafeMessageAsync(botClient, message.Chat.Id, "⚠️ *Aylık Harcama Raporu* kuralı şu anda devre dışıdır. SpendLog web panelinden aktifleştirebilirsiniz.", ParseMode.Markdown, cancellationToken);
                return;
            }

            var rYear = int.Parse(monthlyReportMatch.Groups["year"].Value);
            var rMonth = int.Parse(monthlyReportMatch.Groups["month"].Value);

            await HandleMonthlyReportAsync(botClient, message.Chat.Id, user, rYear, rMonth, cancellationToken);
            return;
        }

        // Devre dışı regex kuralları kontrolü (kullanıcı devre dışı bıraktığı bir kalıbı yazarsa uyar)
        foreach (var disabledRule in allRules.Where(r => !r.IsActive && !string.IsNullOrWhiteSpace(r.Pattern)))
        {
            try
            {
                if (Regex.IsMatch(text, disabledRule.Pattern, RegexOptions.IgnoreCase))
                {
                    await SendSafeMessageAsync(botClient, message.Chat.Id, $"⚠️ *{disabledRule.Title}* kuralı şu anda devre dışıdır. SpendLog web panelinden aktifleştirebilirsiniz.", ParseMode.Markdown, cancellationToken);
                    return;
                }
            }
            catch { }
        }

        var activeRules = allRules.Where(r => r.IsActive).ToList();

        // 2. Dinamik Regex Kuralları Eşleştirme (Örn: /harca 150 market)
        foreach (var rule in activeRules)
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
            if (IsRuleDisabled("yakit", "yakıt", "FuelLog"))
            {
                await SendSafeMessageAsync(botClient, message.Chat.Id, "⚠️ *Yakıt Kaydı* kuralı (`/yakit`) şu anda devre dışıdır. SpendLog web panelinden aktifleştirebilirsiniz.", ParseMode.Markdown, cancellationToken);
                return;
            }

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

                    await SendSafeMessageAsync(botClient, message.Chat.Id, dupMsg, ParseMode.Markdown, cancellationToken);
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

                await SendSafeMessageAsync(botClient, message.Chat.Id, successMsg, ParseMode.Markdown, cancellationToken);
                return;
            }
        }

        // Tanımlanamayan komut / genel yardım rehberi
        await SendSafeMessageAsync(
            botClient,
            message.Chat.Id,
            StandardHelpMessage,
            ParseMode.Markdown,
            cancellationToken);
    }

    private async Task SendSafeMessageAsync(
        ITelegramBotClient botClient, 
        ChatId chatId, 
        string text, 
        ParseMode parseMode = ParseMode.Markdown, 
        CancellationToken cancellationToken = default)
    {
        try
        {
            await botClient.SendMessage(chatId, text, parseMode: parseMode, cancellationToken: cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Markdown gönderim hatası oluştu, düz metin fallback ile iletiliyor.");
            var plainText = text.Replace("*", "").Replace("`", "").Replace("_", "");
            try
            {
                await botClient.SendMessage(chatId, plainText, parseMode: ParseMode.None, cancellationToken: cancellationToken);
            }
            catch (Exception fallbackEx)
            {
                _logger.LogError(fallbackEx, "Telegram düz metin mesajı da iletilemedi.");
            }
        }
    }

    private async Task HandleMonthlyReportAsync(
        ITelegramBotClient botClient, 
        long chatId, 
        AppUser user, 
        int year, 
        int month, 
        CancellationToken cancellationToken)
    {
        var periodStr = $"{year}-{month:D2}";
        await SendSafeMessageAsync(
            botClient, 
            chatId, 
            $"⏳ *{periodStr}* dönemi harcama verileri taranıyor, grafik ve detaylı PDF dökümü hazırlanıyor...", 
            cancellationToken: cancellationToken);

        try
        {
            var txExpenses = await _context.Transactions
                .Include(t => t.Category)
                .Include(t => t.Account)
                .IgnoreQueryFilters()
                .Where(t => t.UserId == user.Id && !t.IsDeleted && t.Type == TransactionType.Expense &&
                            t.TransactionDate.Year == year && t.TransactionDate.Month == month)
                .OrderByDescending(t => t.TransactionDate)
                .ToListAsync(cancellationToken);

            var ccExpenses = await _context.CreditCardExpenses
                .Include(c => c.Account)
                .IgnoreQueryFilters()
                .Where(c => c.UserId == user.Id && !c.IsDeleted && c.IsExpense &&
                            c.Year == year && c.Month == month)
                .OrderByDescending(c => c.Tarih)
                .ToListAsync(cancellationToken);

            var categoryGroups = new Dictionary<string, (decimal Amount, int Count)>(StringComparer.OrdinalIgnoreCase);

            foreach (var tx in txExpenses)
            {
                var catName = !string.IsNullOrWhiteSpace(tx.Category?.Name) ? tx.Category.Name : "Diğer Harcamalar";
                if (!categoryGroups.ContainsKey(catName)) categoryGroups[catName] = (0, 0);
                categoryGroups[catName] = (categoryGroups[catName].Amount + tx.Amount, categoryGroups[catName].Count + 1);
            }

            foreach (var cc in ccExpenses)
            {
                var catName = "Kredi Kartı";
                var amt = Math.Abs(cc.Tutar);
                if (!categoryGroups.ContainsKey(catName)) categoryGroups[catName] = (0, 0);
                categoryGroups[catName] = (categoryGroups[catName].Amount + amt, categoryGroups[catName].Count + 1);
            }

            var totalExpense = categoryGroups.Values.Sum(v => v.Amount);
            var totalTxCount = txExpenses.Count + ccExpenses.Count;

            var categoriesPayload = categoryGroups.Select(kv => new
            {
                name = kv.Key,
                amount = (double)kv.Value.Amount,
                count = kv.Value.Count
            }).ToList();

            var expensesPayload = new List<object>();
            foreach (var tx in txExpenses)
            {
                expensesPayload.Add(new
                {
                    date = tx.TransactionDate.ToString("dd.MM.yyyy"),
                    description = tx.Description,
                    category = tx.Category?.Name ?? "Genel",
                    amount = (double)tx.Amount,
                    account = tx.Account?.Name ?? "Banka/Nakit"
                });
            }
            foreach (var cc in ccExpenses)
            {
                expensesPayload.Add(new
                {
                    date = cc.Tarih.ToString("dd.MM.yyyy"),
                    description = !string.IsNullOrWhiteSpace(cc.Description) ? cc.Description : (!string.IsNullOrWhiteSpace(cc.OriginalNote) ? cc.OriginalNote : "Kredi Kartı Harcaması"),
                    category = "Kredi Kartı",
                    amount = (double)Math.Abs(cc.Tutar),
                    account = cc.Account?.Name ?? "Kredi Kartı"
                });
            }

            var payload = new
            {
                period = periodStr,
                total_amount = (double)totalExpense,
                transaction_count = totalTxCount,
                categories = categoriesPayload,
                expenses = expensesPayload
            };

            using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
            
            // 1. Matplotlib Donut Grafiği Al
            byte[]? chartBytes = null;
            try
            {
                var chartResponse = await httpClient.PostAsJsonAsync("http://localhost:8000/api/reports/monthly-chart", payload, cancellationToken);
                if (chartResponse.IsSuccessStatusCode)
                {
                    chartBytes = await chartResponse.Content.ReadAsByteArrayAsync(cancellationToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Grafik üretimi çağrısı başarısız.");
            }

            // 2. ReportLab PDF Raporu Al
            byte[]? pdfBytes = null;
            try
            {
                var pdfResponse = await httpClient.PostAsJsonAsync("http://localhost:8000/api/reports/monthly-pdf", payload, cancellationToken);
                if (pdfResponse.IsSuccessStatusCode)
                {
                    pdfBytes = await pdfResponse.Content.ReadAsByteArrayAsync(cancellationToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "PDF rapor üretimi çağrısı başarısız.");
            }

            // Telegram'a İlet
            if (chartBytes != null && chartBytes.Length > 0)
            {
                using var chartStream = new MemoryStream(chartBytes);
                var photoFile = InputFile.FromStream(chartStream, $"SpendLog_{year}_{month:D2}_Grafik.png");
                await botClient.SendPhoto(
                    chatId: chatId,
                    photo: photoFile,
                    caption: $"📊 *{year} / {month:D2} Dönemi Harcama Dağılımı*\n\n💰 *Toplam Harcama:* `{totalExpense:N2} ₺`\n📝 *İşlem Sayısı:* `{totalTxCount}`\n⚡ _Detaylı harcama PDF dökümü hazırlanmıştır._",
                    parseMode: ParseMode.Markdown,
                    cancellationToken: cancellationToken);
            }

            if (pdfBytes != null && pdfBytes.Length > 0)
            {
                using var pdfStream = new MemoryStream(pdfBytes);
                var docFile = InputFile.FromStream(pdfStream, $"SpendLog_{year}_{month:D2}_Harcama_Raporu.pdf");
                await botClient.SendDocument(
                    chatId: chatId,
                    document: docFile,
                    caption: $"📄 *SpendLog — {year} / {month:D2} Harcama ve Ekstre Döküm Raporu*",
                    parseMode: ParseMode.Markdown,
                    cancellationToken: cancellationToken);
            }

            if (chartBytes == null && pdfBytes == null)
            {
                await SendSafeMessageAsync(
                    botClient, 
                    chatId, 
                    $"⚠️ Rapor mikroservisi yanıt vermedi. {periodStr} dönemi toplam harcamanız: `{totalExpense:N2} ₺` ({totalTxCount} İşlem).", 
                    cancellationToken: cancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Aylık rapor üretilirken hata oluştu.");
            await SendSafeMessageAsync(botClient, chatId, "⚠️ Rapor oluşturulurken bir hata meydana geldi.", cancellationToken: cancellationToken);
        }
    }
}
