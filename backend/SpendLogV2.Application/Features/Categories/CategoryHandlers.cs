using MediatR;
using Microsoft.EntityFrameworkCore;
using SpendLogV2.Application.Common.Interfaces;
using SpendLogV2.Domain.Entities;
using SpendLogV2.Domain.Enums;
using System.Text.RegularExpressions;

namespace SpendLogV2.Application.Features.Categories;

public record CategoryDto(
    int Id,
    string Name,
    CategoryType Type,
    string? Icon,
    string? Color,
    int DisplayOrder,
    int? ParentCategoryId,
    List<CategoryDto> SubCategories);

public record GetCategoriesQuery(CategoryType? Type = null) : IRequest<List<CategoryDto>>;

public class GetCategoriesQueryHandler : IRequestHandler<GetCategoriesQuery, List<CategoryDto>>
{
    private readonly IAppDbContext _context;

    public GetCategoriesQueryHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<List<CategoryDto>> Handle(GetCategoriesQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Categories
            .Include(c => c.SubCategories)
            .Where(c => c.ParentCategoryId == null && !c.IsDeleted);

        if (request.Type.HasValue)
        {
            query = query.Where(c => c.Type == request.Type.Value || c.Type == CategoryType.Both);
        }

        var categories = await query
            .OrderBy(c => c.DisplayOrder)
            .ThenBy(c => c.Name)
            .ToListAsync(cancellationToken);

        // Otomatik ilk re-index kontrolü: Eğer ana kategorilerin tüm DisplayOrder değerleri 0 ise doğal sıraya göre indeksle
        if (categories.Count > 1 && categories.All(c => c.DisplayOrder == 0))
        {
            var sortedParents = categories
                .OrderBy(c => ParseLeadingNumber(c.Name))
                .ThenBy(c => c.Name)
                .ToList();

            for (int i = 0; i < sortedParents.Count; i++)
            {
                sortedParents[i].DisplayOrder = i;
            }

            var allSubs = await _context.Categories
                .Where(c => c.ParentCategoryId != null && !c.IsDeleted)
                .ToListAsync(cancellationToken);

            var subGroups = allSubs.GroupBy(s => s.ParentCategoryId!.Value);
            foreach (var group in subGroups)
            {
                var subs = group
                    .OrderBy(s => s.DisplayOrder > 0 ? s.DisplayOrder : int.MaxValue)
                    .ThenBy(s => s.Id)
                    .ThenBy(s => s.Name)
                    .ToList();

                for (int j = 0; j < subs.Count; j++)
                {
                    subs[j].DisplayOrder = j;
                }
            }

            await _context.SaveChangesAsync(cancellationToken);

            // Yeniden sıralanmış listeyi dön
            categories = sortedParents;
        }

        return categories.Select(MapToDto).ToList();
    }

    private static CategoryDto MapToDto(Category c) => new(
        c.Id,
        c.Name,
        c.Type,
        c.Icon,
        c.Color,
        c.DisplayOrder,
        c.ParentCategoryId,
        c.SubCategories
            .Where(s => !s.IsDeleted)
            .OrderBy(s => s.DisplayOrder)
            .ThenBy(s => s.Name)
            .Select(MapToDto)
            .ToList());

    private static int ParseLeadingNumber(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return 999;
        var match = Regex.Match(name.Trim(), @"^(\d+)");
        return match.Success && int.TryParse(match.Groups[1].Value, out var num) ? num : 999;
    }
}

public record CreateCategoryCommand(
    string Name,
    CategoryType Type,
    string? Icon,
    string? Color,
    int DisplayOrder,
    int? ParentCategoryId) : IRequest<CategoryDto>;

public class CreateCategoryCommandHandler : IRequestHandler<CreateCategoryCommand, CategoryDto>
{
    private readonly IAppDbContext _context;

    public CreateCategoryCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<CategoryDto> Handle(CreateCategoryCommand request, CancellationToken cancellationToken)
    {
        int calculatedOrder = request.DisplayOrder;

        // Eğer kullanıcı manuel bir sıra belirtmediyse veya 0 ise otomatik max(DisplayOrder) + 1 (n+1) ata
        if (calculatedOrder <= 0)
        {
            var maxOrder = await _context.Categories
                .Where(c => c.ParentCategoryId == request.ParentCategoryId && !c.IsDeleted)
                .Select(c => (int?)c.DisplayOrder)
                .MaxAsync(cancellationToken);

            calculatedOrder = (maxOrder ?? -1) + 1;
        }

        var category = new Category
        {
            Name = request.Name,
            Type = request.Type,
            Icon = !string.IsNullOrWhiteSpace(request.Icon) ? request.Icon : (request.ParentCategoryId.HasValue ? "tag" : "folder"),
            Color = !string.IsNullOrWhiteSpace(request.Color) ? request.Color : "#6366f1",
            DisplayOrder = calculatedOrder,
            ParentCategoryId = request.ParentCategoryId
        };

        _context.Categories.Add(category);
        await _context.SaveChangesAsync(cancellationToken);

        return new CategoryDto(category.Id, category.Name, category.Type, category.Icon, category.Color, category.DisplayOrder, category.ParentCategoryId, new List<CategoryDto>());
    }
}

public record UpdateCategoryCommand(
    int Id,
    string Name,
    CategoryType Type,
    string? Icon,
    string? Color,
    int DisplayOrder,
    int? ParentCategoryId) : IRequest<bool>;

public class UpdateCategoryCommandHandler : IRequestHandler<UpdateCategoryCommand, bool>
{
    private readonly IAppDbContext _context;

    public UpdateCategoryCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(UpdateCategoryCommand request, CancellationToken cancellationToken)
    {
        var category = await _context.Categories.FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);
        if (category == null) return false;

        category.Name = request.Name;
        category.Type = request.Type;
        category.Icon = request.Icon;
        category.Color = request.Color;
        category.DisplayOrder = request.DisplayOrder;
        category.ParentCategoryId = request.ParentCategoryId;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public record DeleteCategoryCommand(int Id) : IRequest<bool>;

public class DeleteCategoryCommandHandler : IRequestHandler<DeleteCategoryCommand, bool>
{
    private readonly IAppDbContext _context;

    public DeleteCategoryCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteCategoryCommand request, CancellationToken cancellationToken)
    {
        var category = await _context.Categories.FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);
        if (category == null) return false;

        category.IsDeleted = true;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public record ReindexCategoriesCommand() : IRequest<bool>;

public class ReindexCategoriesCommandHandler : IRequestHandler<ReindexCategoriesCommand, bool>
{
    private readonly IAppDbContext _context;

    public ReindexCategoriesCommandHandler(IAppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(ReindexCategoriesCommand request, CancellationToken cancellationToken)
    {
        var allCategories = await _context.Categories
            .Where(c => !c.IsDeleted)
            .ToListAsync(cancellationToken);

        // 1. Ana kategoriler (ParentCategoryId == null) - Doğal sayısal sıra (1-, 2-, 3-...)
        var parentCategories = allCategories
            .Where(c => c.ParentCategoryId == null)
            .OrderBy(c => ParseLeadingNumber(c.Name))
            .ThenBy(c => c.DisplayOrder)
            .ThenBy(c => c.Name)
            .ToList();

        for (int i = 0; i < parentCategories.Count; i++)
        {
            parentCategories[i].DisplayOrder = i;
        }

        // 2. Alt kategoriler (Her parent için sırayı koruyarak 0, 1, 2... ata)
        var subGroups = allCategories
            .Where(c => c.ParentCategoryId != null)
            .GroupBy(c => c.ParentCategoryId!.Value);

        foreach (var group in subGroups)
        {
            var subs = group
                .OrderBy(s => s.DisplayOrder > 0 ? s.DisplayOrder : int.MaxValue)
                .ThenBy(s => s.Id)
                .ThenBy(s => s.Name)
                .ToList();

            for (int j = 0; j < subs.Count; j++)
            {
                subs[j].DisplayOrder = j;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static int ParseLeadingNumber(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return 999;
        var match = Regex.Match(name.Trim(), @"^(\d+)");
        return match.Success && int.TryParse(match.Groups[1].Value, out var num) ? num : 999;
    }
}

public record SeedDefaultCategoriesCommand(bool OverwriteExisting = false, string? TargetUserId = null) : IRequest<bool>;

public class SeedDefaultCategoriesCommandHandler : IRequestHandler<SeedDefaultCategoriesCommand, bool>
{
    private readonly IAppDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public SeedDefaultCategoriesCommandHandler(IAppDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<bool> Handle(SeedDefaultCategoriesCommand request, CancellationToken cancellationToken)
    {
        var targetUserId = request.TargetUserId ?? _currentUserService.UserId;
        if (string.IsNullOrEmpty(targetUserId))
        {
            return false;
        }
        var template = new[]
        {
            new
            {
                Name = "1-Gelir & Kazanç",
                Icon = "wallet",
                Color = "#10b981",
                Type = CategoryType.Income,
                Subs = new[]
                {
                    new { Name = "Maaş", Icon = "banknote" },
                    new { Name = "Ek Gelir & Prim", Icon = "trending-up" },
                    new { Name = "Temettü & Yatırım Getirisi", Icon = "landmark" },
                    new { Name = "Diğer Gelirler", Icon = "wallet" }
                }
            },
            new
            {
                Name = "2-Konut & Faturalar",
                Icon = "home",
                Color = "#3b82f6",
                Type = CategoryType.Expense,
                Subs = new[]
                {
                    new { Name = "Kira", Icon = "home" },
                    new { Name = "Aidat / Site", Icon = "receipt" },
                    new { Name = "Elektrik", Icon = "zap" },
                    new { Name = "Doğalgaz", Icon = "flame" },
                    new { Name = "Su", Icon = "droplets" },
                    new { Name = "İnternet & TV", Icon = "wifi" },
                    new { Name = "Cep Telefonu", Icon = "phone" },
                    new { Name = "Ev Bakım & Eşya", Icon = "wrench" }
                }
            },
            new
            {
                Name = "3-Market & Beslenme",
                Icon = "shopping-cart",
                Color = "#10b981",
                Type = CategoryType.Expense,
                Subs = new[]
                {
                    new { Name = "Süpermarket", Icon = "shopping-cart" },
                    new { Name = "Manav & Kasap", Icon = "shopping-bag" },
                    new { Name = "Şarküteri & Fırın", Icon = "coffee" },
                    new { Name = "Temizlik & Sarf", Icon = "package" }
                }
            },
            new
            {
                Name = "4-Yeme, İçme & Sosyal",
                Icon = "utensils",
                Color = "#f59e0b",
                Type = CategoryType.Expense,
                Subs = new[]
                {
                    new { Name = "Restoran & Yemek", Icon = "utensils" },
                    new { Name = "Kafe & Kahve", Icon = "coffee" },
                    new { Name = "Paket Servis (Getir/Yemeksepeti)", Icon = "shopping-bag" },
                    new { Name = "Fast-Food & Atıştırmalık", Icon = "flame" }
                }
            },
            new
            {
                Name = "5-Ulaşım & Araç",
                Icon = "car",
                Color = "#06b6d4",
                Type = CategoryType.Expense,
                Subs = new[]
                {
                    new { Name = "Akaryakıt", Icon = "fuel" },
                    new { Name = "HGS / OGS / Köprü", Icon = "tag" },
                    new { Name = "Otopark", Icon = "tag" },
                    new { Name = "Toplu Taşıma & Taksi", Icon = "bus" },
                    new { Name = "Araç Bakım & Servis", Icon = "wrench" },
                    new { Name = "Sigorta & Kasko", Icon = "shield-alert" },
                    new { Name = "MTV & Araç Vergileri", Icon = "receipt" }
                }
            },
            new
            {
                Name = "6-Alışveriş & Teknoloji",
                Icon = "shopping-bag",
                Color = "#ec4899",
                Type = CategoryType.Expense,
                Subs = new[]
                {
                    new { Name = "Giyim & Moda", Icon = "shirt" },
                    new { Name = "Elektronik & Bilgisayar", Icon = "tv" },
                    new { Name = "İnternet / E-Ticaret", Icon = "gift" },
                    new { Name = "Ev & Yaşam", Icon = "home" },
                    new { Name = "Hobi & Oyun", Icon = "film" }
                }
            },
            new
            {
                Name = "7-Abonelik, Sağlık & Eğitim",
                Icon = "tv",
                Color = "#8b5cf6",
                Type = CategoryType.Expense,
                Subs = new[]
                {
                    new { Name = "Dijital Medya (Netflix/Spotify/YT)", Icon = "film" },
                    new { Name = "Yazılım & Bulut (Apple/Google/AI)", Icon = "wifi" },
                    new { Name = "Eczane & Sağlık", Icon = "heart-pulse" },
                    new { Name = "Spor & Fitness", Icon = "dumbbell" },
                    new { Name = "Eğitim, Kurs & Kitap", Icon = "graduation-cap" }
                }
            },
            new
            {
                Name = "8-Seyahat, Eğlence & Finans",
                Icon = "plane",
                Color = "#f97316",
                Type = CategoryType.Expense,
                Subs = new[]
                {
                    new { Name = "Tatil & Konaklama", Icon = "plane" },
                    new { Name = "Uçak / Otobüs Bileti", Icon = "plane" },
                    new { Name = "Etkinlik / Konser / Sinema", Icon = "film" },
                    new { Name = "Banka / Kart Faiz & Ücret", Icon = "receipt" },
                    new { Name = "Resmi Harç & Vergiler", Icon = "landmark" }
                }
            }
        };

        var existingCategories = await _context.Categories
            .IgnoreQueryFilters()
            .Where(c => c.UserId == targetUserId && !c.IsDeleted)
            .ToListAsync(cancellationToken);

        int mainOrder = existingCategories.Count(c => c.ParentCategoryId == null);

        for (int i = 0; i < template.Length; i++)
        {
            var tMain = template[i];
            var existingMain = existingCategories.FirstOrDefault(c => c.ParentCategoryId == null && c.Name.Trim().ToLower() == tMain.Name.Trim().ToLower());

            Category mainCat;
            if (existingMain == null)
            {
                mainCat = new Category
                {
                    Name = tMain.Name,
                    Icon = tMain.Icon,
                    Color = tMain.Color,
                    Type = tMain.Type,
                    DisplayOrder = mainOrder++,
                    ParentCategoryId = null,
                    UserId = targetUserId
                };
                _context.Categories.Add(mainCat);
                await _context.SaveChangesAsync(cancellationToken);
            }
            else
            {
                mainCat = existingMain;
            }

            var existingSubs = existingCategories.Where(c => c.ParentCategoryId == mainCat.Id).ToList();
            int subOrder = existingSubs.Count;

            for (int j = 0; j < tMain.Subs.Length; j++)
            {
                var tSub = tMain.Subs[j];
                var subExists = existingSubs.Any(s => s.Name.Trim().ToLower() == tSub.Name.Trim().ToLower());
                if (!subExists)
                {
                    var newSub = new Category
                    {
                        Name = tSub.Name,
                        Icon = tSub.Icon,
                        Color = mainCat.Color,
                        Type = mainCat.Type,
                        DisplayOrder = subOrder++,
                        ParentCategoryId = mainCat.Id,
                        UserId = targetUserId
                    };
                    _context.Categories.Add(newSub);
                }
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

