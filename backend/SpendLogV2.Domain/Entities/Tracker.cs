using SpendLogV2.Domain.Common;
using SpendLogV2.Domain.Enums;

namespace SpendLogV2.Domain.Entities;

public class Tracker : BaseEntity
{
    public TrackerType Type { get; set; } = TrackerType.Note;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public decimal? TargetAmount { get; set; }
    public decimal? CurrentAmount { get; set; }
    public DateTime? DueDate { get; set; }
    public bool IsCompleted { get; set; } = false;
    public string? SchemaDefinition { get; set; } // JSON columns definition

    public ICollection<TrackerItem> Items { get; set; } = new List<TrackerItem>();
}

public class TrackerItem : BaseEntity
{
    public int TrackerId { get; set; }
    public Tracker? Tracker { get; set; }
    public int OrderIndex { get; set; }
    public string JsonData { get; set; } = "{}"; // JSON row values
}
