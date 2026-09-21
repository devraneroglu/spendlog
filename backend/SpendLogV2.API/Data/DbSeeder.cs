using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SpendLogV2.Domain.Entities;
using SpendLogV2.Domain.Enums;
using SpendLogV2.Infrastructure.Data;

namespace SpendLogV2.API.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(SpendLogDbContext context, UserManager<AppUser> userManager, RoleManager<IdentityRole> roleManager, IConfiguration configuration)
    {
        // 0. Rolleri Oluştur (Admin ve User)
        if (!await roleManager.RoleExistsAsync("Admin"))
        {
            await roleManager.CreateAsync(new IdentityRole("Admin"));
        }
        if (!await roleManager.RoleExistsAsync("User"))
        {
            await roleManager.CreateAsync(new IdentityRole("User"));
        }

        // 1. Admin Kullanıcısı
        var adminEmail = "admin@spendlog.com";
        var adminUser = await userManager.FindByEmailAsync(adminEmail);
        if (adminUser == null)
        {
            adminUser = new AppUser
            {
                UserName = adminEmail,
                Email = adminEmail,
                FullName = "SpendLog Admin",
                EmailConfirmed = true,
                CreatedAt = DateTime.UtcNow
            };
            await userManager.CreateAsync(adminUser, "Admin123*");
        }

        if (!await userManager.IsInRoleAsync(adminUser, "Admin"))
        {
            await userManager.AddToRoleAsync(adminUser, "Admin");
        }

        // Admin kullanıcısının özel Telegram Botunu otomatik bağla (Eğer konfigürasyonda geçerli token tanımlıysa)
        var defaultBotToken = configuration["Telegram:BotToken"];
        if (string.IsNullOrEmpty(adminUser.CustomTelegramBotToken) &&
            !string.IsNullOrEmpty(defaultBotToken) &&
            !defaultBotToken.Contains("YOUR_TELEGRAM_BOT_TOKEN"))
        {
            adminUser.CustomTelegramBotToken = defaultBotToken;
            adminUser.CustomTelegramBotUsername = "SpendLogV2_Bot";
            adminUser.TelegramWebhookSecret ??= Guid.NewGuid().ToString("N");
            adminUser.IsTelegramActive = true;
            await userManager.UpdateAsync(adminUser);
        }

        // 2. Varsayılan Kategoriler (Eğer admin için kategori yoksa)
        if (!context.Categories.IgnoreQueryFilters().Any(c => c.UserId == adminUser.Id))
        {
            var defaultCategories = new List<Category>
            {
                new() { Name = "Market & Gıda", Type = CategoryType.Expense, Icon = "shopping-cart", Color = "#10b981", DisplayOrder = 1, UserId = adminUser.Id },
                new() { Name = "Fatura & Abonelik", Type = CategoryType.Expense, Icon = "file-text", Color = "#f59e0b", DisplayOrder = 2, UserId = adminUser.Id },
                new() { Name = "Ulaşım & Yakıt", Type = CategoryType.Expense, Icon = "car", Color = "#3b82f6", DisplayOrder = 3, UserId = adminUser.Id },
                new() { Name = "Kira & Konut", Type = CategoryType.Expense, Icon = "home", Color = "#8b5cf6", DisplayOrder = 4, UserId = adminUser.Id },
                new() { Name = "Sağlık & Bakım", Type = CategoryType.Expense, Icon = "heart", Color = "#ef4444", DisplayOrder = 5, UserId = adminUser.Id },
                new() { Name = "Maaş & Gelir", Type = CategoryType.Income, Icon = "wallet", Color = "#10b981", DisplayOrder = 6, UserId = adminUser.Id },
                new() { Name = "Yatırım Getirisi", Type = CategoryType.Income, Icon = "trending-up", Color = "#06b6d4", DisplayOrder = 7, UserId = adminUser.Id }
            };

            context.Categories.AddRange(defaultCategories);
            await context.SaveChangesAsync();
        }

        // 3. Varsayılan Hesaplar
        if (!context.Accounts.IgnoreQueryFilters().Any(a => a.UserId == adminUser.Id))
        {
            var defaultAccounts = new List<Account>
            {
                new() { Name = "Nakit Cüzdan", AccountType = AccountType.Cash, Currency = Currency.TRY, InitialBalance = 1000, CurrentBalance = 1000, Color = "#10b981", Icon = "banknote", UserId = adminUser.Id },
                new() { Name = "Ziraat Bankası", AccountType = AccountType.Bank, Currency = Currency.TRY, InitialBalance = 25000, CurrentBalance = 25000, Color = "#ef4444", Icon = "landmark", UserId = adminUser.Id },
                new() { Name = "Ziraat Kredi Kartı", AccountType = AccountType.CreditCard, Currency = Currency.TRY, InitialBalance = 0, CurrentBalance = 0, Color = "#f59e0b", Icon = "credit-card", UserId = adminUser.Id },
                new() { Name = "Midas Yatırım", AccountType = AccountType.Investment, Currency = Currency.TRY, InitialBalance = 50000, CurrentBalance = 50000, Color = "#3b82f6", Icon = "trending-up", UserId = adminUser.Id }
            };

            context.Accounts.AddRange(defaultAccounts);
            await context.SaveChangesAsync();
        }

        // 4. Varsayılan Telegram Kuralları
        if (!context.TelegramRules.IgnoreQueryFilters().Any(r => r.UserId == adminUser.Id))
        {
            var defaultRules = new List<TelegramRule>
            {
                new()
                {
                    Command = "bakiye",
                    Title = "Bakiye Sorgulama",
                    Description = "Vadesiz banka hesaplarının güncel bakiyelerini ve toplamını listeler.",
                    Pattern = "^/bakiye$",
                    ActionType = "GetBalance",
                    ResponseTemplate = "💳 *SPENDLOG VADESİZ BANKA HESAP BAKİYELERİNİZ*\n{hesap_listesi}\n💰 *Toplam Vadesiz Banka Bakiyesi:* {toplam_varlik} ₺",
                    SendType = "Text",
                    ScheduleType = "Manual",
                    UserId = adminUser.Id
                },
                new()
                {
                    Command = "harcama",
                    Title = "Harcama Ekleme",
                    Description = "Hızlı harcama kaydeder (Örn: /harcama 250 Yemek Kahve)",
                    Pattern = @"^/harcama\s+(\d+(?:[.,]\d+)?)\s+(\S+)(?:\s+(.*))?$",
                    ActionType = "CreateTransaction",
                    ResponseTemplate = "✅ *Harcama Kaydedildi!*\nTutar: {tutar} ₺\nKategori: {kategori}\nAçıklama: {aciklama}\nHesap: {hesap}",
                    SendType = "Text",
                    ScheduleType = "Manual",
                    UserId = adminUser.Id
                },
                new()
                {
                    Command = "kk",
                    Title = "Kredi Kartı Canlı Harcama (Ön-Ekstre)",
                    Description = "Sıradaki ekstre dönemine harcama notu ekler (Örn: /kk 546 çocuklar ile kahve)",
                    Pattern = @"^/(kk|kart)\s+(\d+(?:[.,]\d+)?)(?:\s+(.*))?$",
                    ActionType = "CreateCreditCardExpense",
                    ResponseTemplate = "💳 *Kredi Kartı Harcaması İşlendi!*\nTutar: -{tutar} ₺\nNot: {not}\nDönem: {donem}",
                    SendType = "Text",
                    ScheduleType = "Manual",
                    UserId = adminUser.Id
                },
                new()
                {
                    Command = "durum",
                    Title = "Sistem ve Sunucu Durumu (Health Check)",
                    Description = "Uptime süresi, DB ping gecikmesi ve servis durumlarını listeler.",
                    Pattern = "^/(durum|ping|health|sistem)$",
                    ActionType = "GetSystemStatus",
                    ResponseTemplate = "🖥️ *SpendLog V2 Sistem Durumu:*\nUptime: {uptime}\nDB Ping: {ping} ms",
                    SendType = "Text",
                    ScheduleType = "Manual",
                    UserId = adminUser.Id
                },
                new()
                {
                    Command = "rapor",
                    Title = "Aylık Harcama Grafiği & PDF Dökümü",
                    Description = "Belirtilen ayın (Örn: 2026-8 veya /rapor 2026-8) kategori harcama grafiğini (PNG) ve detaylı PDF dökümünü üretir.",
                    Pattern = @"^(?:/rapor\s+)?(\d{4}-(?:1[0-2]|0[1-9]|[1-9]))$",
                    ActionType = "MonthlyReport",
                    ResponseTemplate = "📊 Aylık harcama dağılım grafiği ve PDF dökümü hazırlanıyor...",
                    SendType = "ChartAndPdf",
                    ScheduleType = "Manual",
                    UserId = adminUser.Id
                },
                new()
                {
                    Command = "EVENT_PRICE_ALERT",
                    Title = "Fiyat Alarmı Bildirimi",
                    Description = "Varlık hedef fiyata ulaştığında veya altına düştüğünde iletilen dinamik Telegram alarm şablonu.",
                    Pattern = "EVENT_PRICE_ALERT",
                    ActionType = "PriceAlert",
                    ResponseTemplate = "🚨 *SPENDLOG FİYAT ALARMI TETİKLENDİ!*\n\n🪙 *Varlık:* `{Symbol}` ({Name})\n🎯 *Hedef:* `{TargetPrice} {Currency}` ({Condition})\n📈 *Anlık Fiyat:* `{CurrentPrice} {Currency}`\n📝 *Not:* _{Note}_\n⏰ *Zaman:* {Time}",
                    SendType = "Text",
                    ScheduleType = "Manual",
                    IsActive = true,
                    UserId = adminUser.Id
                }
            };

            context.TelegramRules.AddRange(defaultRules);
            await context.SaveChangesAsync();
        }
        else
        {
            // Mevcut veritabanlarında EVENT_PRICE_ALERT kuralı eksikse otomatik ekle
            var priceAlertExists = await context.TelegramRules.IgnoreQueryFilters().AnyAsync(r => r.UserId == adminUser.Id && r.Command == "EVENT_PRICE_ALERT");
            if (!priceAlertExists)
            {
                context.TelegramRules.Add(new TelegramRule
                {
                    Command = "EVENT_PRICE_ALERT",
                    Title = "Fiyat Alarmı Bildirimi",
                    Description = "Varlık hedef fiyata ulaştığında veya altına düştüğünde iletilen dinamik Telegram alarm şablonu.",
                    Pattern = "EVENT_PRICE_ALERT",
                    ActionType = "PriceAlert",
                    ResponseTemplate = "🚨 *SPENDLOG FİYAT ALARMI TETİKLENDİ!*\n\n🪙 *Varlık:* `{Symbol}` ({Name})\n🎯 *Hedef:* `{TargetPrice} {Currency}` ({Condition})\n📈 *Anlık Fiyat:* `{CurrentPrice} {Currency}`\n📝 *Not:* _{Note}_\n⏰ *Zaman:* {Time}",
                    SendType = "Text",
                    ScheduleType = "Manual",
                    IsActive = true,
                    UserId = adminUser.Id
                });
                await context.SaveChangesAsync();
            }
        }

        // 5. Varsayılan Scraping Scheduler Ayarları
        if (!context.SchedulerJobSettings.IgnoreQueryFilters().Any(s => s.UserId == adminUser.Id))
        {
            var defaultJobs = new List<SchedulerJobSetting>
            {
                new() { JobKey = "BIST_STOCKS", JobName = "BIST Hisse Fiyatları (BigPara/Yahoo)", CronExpression = "*/1 * * * *", IsEnabled = true, UserId = adminUser.Id },
                new() { JobKey = "GOLD_COMMODITIES", JobName = "Altın ve Emtia Fiyatları (GenelPara)", CronExpression = "*/2 * * * *", IsEnabled = true, UserId = adminUser.Id },
                new() { JobKey = "CRYPTO_PRICES", JobName = "Kripto Para Fiyatları (CoinGecko)", CronExpression = "*/1 * * * *", IsEnabled = true, UserId = adminUser.Id },
                new() { JobKey = "CURRENCY_RATES", JobName = "Döviz Kurları (USD/EUR TRY)", CronExpression = "*/5 * * * *", IsEnabled = true, UserId = adminUser.Id }
            };

            context.SchedulerJobSettings.AddRange(defaultJobs);
            await context.SaveChangesAsync();
        }
    }
}
