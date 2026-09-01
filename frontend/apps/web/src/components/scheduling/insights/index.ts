// W17 — Insights & reports. Barrel for the stream's own components + pure
// helpers. (Shared kit lives under components/scheduling/*; this folder is
// W17-owned.)

export { default as InsightsShell } from "./InsightsShell";
export { default as InsightsDashboard } from "./InsightsDashboard";
export { default as EventTypePerformance } from "./EventTypePerformance";
export { default as NoShowReport } from "./NoShowReport";
export { default as TeamPerformance } from "./TeamPerformance";
export { default as PeriodFilterSheet } from "./PeriodFilterSheet";
export { default as InsightsTabs, type InsightsTab } from "./InsightsTabs";

export * from "./filters";
export * from "./format";
export * from "./aggregate";
export * from "./gating";
export { useInsightsFilters } from "./useInsightsFilters";
export {
  useInsightsOwners,
  PILLAR_ORDER,
  type InsightsOwners,
  type OwnerOption,
} from "./useInsightsOwners";
export { useReport, type ReportState, type ReportPhase } from "./useReport";
