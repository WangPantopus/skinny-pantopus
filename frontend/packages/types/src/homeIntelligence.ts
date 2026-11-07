// ============================================================
// HOME INTELLIGENCE TYPES
// Types for Health Score, Seasonal Checklist, Bill Trends,
// Property Value, and Timeline features.
// ============================================================

// ─── Health Score ─────────────────────────────────────────────

export interface DimensionScore {
  score: number;
  max: number;
  issues: string[];
}

export interface HomeHealthScore {
  score: number;
  breakdown: {
    maintenance: DimensionScore;
    bills: DimensionScore;
    seasonal: DimensionScore;
    emergency: DimensionScore;
    household: DimensionScore;
    documents: DimensionScore;
  };
  topIssue: string | null;
  topAction: { type: string; label: string; route: string } | null;
}

// ─── Seasonal Checklist ──────────────────────────────────────

export interface SeasonalChecklistItem {
  id: string;
  season_key: string;
  year: number;
  item_key: string;
  title: string;
  description: string | null;
  gig_category: string | null;
  gig_title_suggestion: string | null;
  status: 'pending' | 'completed' | 'skipped' | 'hired';
  completed_at: string | null;
  gig_id: string | null;
  sort_order: number;
}

export interface SeasonalChecklistCarryover {
  season: { key: string; label: string };
  items: SeasonalChecklistItem[];
}

export interface SeasonalChecklist {
  season: { key: string; label: string };
  items: SeasonalChecklistItem[];
  progress: { total: number; completed: number; percentage: number };
  carryover?: SeasonalChecklistCarryover;
}

export interface SeasonalChecklistHistory {
  checklists: Array<SeasonalChecklist & { year: number }>;
}

// ─── Bill Trends ─────────────────────────────────────────────

export interface BillBenchmark {
  months: string[];
  avg_amounts: number[];
  household_count: number;
}

export interface BillBenchmarkInsufficient {
  insufficient_data: true;
  needed: number;
  message: string;
}

export interface BillTrendData {
  currency?: string;
  available_currencies?: string[];
  as_of?: string;
  calculation_version?: number;
  format_version?: number;
  period_basis?: string;
  bills_by_type: Record<string, { months: string[]; amounts: number[] }>;
  benchmarks: Record<string, BillBenchmark | BillBenchmarkInsufficient>;
  bill_benchmark_opt_in: boolean;
}

// ─── Property Value ──────────────────────────────────────────

/** Where a record came from, worded by the server (backend/services/recordVocabulary.js). */
export interface RecordProvenance {
  publisher: string;
  dataset: string;
  as_of: string;
  scope: 'unit' | 'building' | 'parcel' | 'area';
  method: string;
  /** Shown as it comes: "From Clark County Assessor's records, updated Oct 31, 2026". */
  label: string;
  /** Add Home's heading for the record ("County records"); "Public records" without one. */
  title?: string | null;
}

/** One line of the value card: a county value with its year, or the last sale. */
export interface HomeValueCardRow {
  id: string;
  label: string;
  value: string;
}

/** The area's price change, from an index: never the home's value. */
export interface HomeAreaTrend {
  direction: 'up' | 'down' | 'flat';
  scope: 'zip' | 'county';
  change_pct: number;
  year: number;
  label: string;
  note: string;
}

/** The value card in the server's words, drawn as it comes. Sent only for the new vocabulary and only to the confirmed owner. */
export interface HomeValueCard {
  title: string;
  /** The card's number as text, or null when no county value is known. */
  value: string | null;
  /** The value in a few words for a list row ("county value $412,000"). */
  summary: string | null;
  /** What to say when there's no number. */
  empty_message: string | null;
  rows: HomeValueCardRow[];
  notes: string[];
  area_trend: HomeAreaTrend | null;
  source: string | null;
}

export interface PropertyValueData {
  estimated_value: number | null;
  value_range_low: number | null;
  value_range_high: number | null;
  value_confidence: number | null;
  zip_median_sale_price_trend: 'up' | 'down' | 'flat' | null;
  year_built: number | null;
  sqft: number | null;
  last_updated: string | null;
  /** `cache`, `unavailable` or `error`; a record that names its source sends its own words with `provenance`. */
  source: string | null;
  provenance?: RecordProvenance | null;
  /** The card's title when the record says what the number is ("County market value"). */
  value_title?: string | null;
  /** The whole card, when the server sends it; a build reads this first. */
  value_card?: HomeValueCard | null;
}

// ─── Timeline ────────────────────────────────────────────────

export interface HomeTimelineItem {
  id: string;
  action: string;
  description: string | null;
  actor_id: string | null;
  actor_name: string | null;
  metadata: Record<string, any>;
  created_at: string;
}
