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
  bills_by_type: Record<string, { months: string[]; amounts: number[] }>;
  benchmarks: Record<string, BillBenchmark | BillBenchmarkInsufficient>;
  bill_benchmark_opt_in: boolean;
}

// ─── Property Value ──────────────────────────────────────────

export interface PropertyValueData {
  estimated_value: number | null;
  value_range_low: number | null;
  value_range_high: number | null;
  value_confidence: number | null;
  zip_median_sale_price_trend: 'up' | 'down' | 'flat' | null;
  year_built: number | null;
  sqft: number | null;
  last_updated: string | null;
  source: 'cache' | 'unavailable' | 'error' | null;
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
