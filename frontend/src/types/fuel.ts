export interface FuelLog {
  id: number;
  tarih: string;
  ay: string;
  tutar: number;
  litreFiyat: number;
  miktarLitre: number;
  aracKm: number;
  gidilenKm?: number | null;
  ortalamaTuketimLt?: number | null;
  ortalamaTuketimTL?: number | null;
  alisSikligiGun?: number | null;
  benzinlik?: string | null;
  konum?: string | null;
  not?: string | null;
  fisGorselUrl?: string | null;
}

export interface FuelStationStat {
  station: string;
  totalAmount: number;
  totalLiters: number;
  count: number;
}

export interface FuelMonthlyStat {
  monthKey: string;
  monthLabel: string;
  totalAmount: number;
  totalLiters: number;
  averageCostPerKm: number;
}

export interface FuelPeriodKpi {
  totalExpense: number;
  totalLiters: number;
  totalKilometers: number;
  averageCostPerKm: number;
  averageLitersPer100Km: number;
  averageLiterPrice: number;
  logsCount: number;
  label: string;
}

export interface FuelSummary {
  totalExpense: number;
  totalLiters: number;
  averageLiterPrice: number;
  totalKilometers: number;
  averageCostPerKm: number;
  averageLitersPer100Km: number;
  topStation?: string | null;
  totalLogsCount: number;
  currentYear: FuelPeriodKpi;
  currentMonth: FuelPeriodKpi;
  stationBreakdown: FuelStationStat[];
  monthlyTrend: FuelMonthlyStat[];
}

export interface FuelLogsResponse {
  logs: FuelLog[];
  summary: FuelSummary;
}
