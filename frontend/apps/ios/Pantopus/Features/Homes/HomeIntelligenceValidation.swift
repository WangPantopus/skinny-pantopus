import Foundation

/// Decoding alone does not establish a complete card or an exact Home receipt.
enum HomeIntelligenceValidation {
    private static let dimensions = ["maintenance": 25, "bills": 20, "seasonal": 20, "emergency": 15, "household": 10, "documents": 10]
    private static let destinations = ["maintenance", "bills", "dashboard", "emergency", "members", "documents"]
    private static let statuses = ["pending", "completed", "skipped", "hired"]
    private static let sources = ["cache", "cache_stale", "attom", "fallback", "unavailable"]

    static func health(_ value: HomeHealthScoreDTO, homeId: String) -> Bool {
        guard Set(value.breakdown.keys) == Set(dimensions.keys), (0...100).contains(value.score) else { return false }
        guard value.breakdown.allSatisfy({ key, part in
            part.max == dimensions[key] && (0...part.max).contains(part.score) && part.issues.allSatisfy(nonblank)
        }) else { return false }
        guard value.score == value.breakdown.values.reduce(0, { $0 + $1.score }) else { return false }
        if let issue = value.topIssue, !nonblank(issue) { return false }
        guard let action = value.topAction else { return true }
        return action.type == "navigate" && nonblank(action.label) && destinations.contains { action.route == "/homes/\(homeId)/\($0)" }
    }

    static func checklist(_ value: SeasonalChecklistDTO, homeId: String) -> Bool {
        guard nonblank(value.season.key), nonblank(value.season.label) else { return false }
        guard value.items.allSatisfy({ item($0, homeId: homeId) && $0.seasonKey == value.season.key }) else { return false }
        if let carryover = value.carryover {
            guard nonblank(carryover.season.key), nonblank(carryover.season.label) else { return false }
            guard carryover.items
                .allSatisfy({ item($0, homeId: homeId) && $0.seasonKey == carryover.season.key && $0.status == "pending" })
            else { return false }
        }
        let all = value.items + (value.carryover?.items ?? [])
        guard Set(all.map(\.id)).count == all.count else { return false }
        let completed = value.items.filter(\.isResolved).count
        let percentage = value.items.isEmpty ? 0 : Int((100.0 * Double(completed) / Double(value.items.count)).rounded())
        return value.progress.total == value.items.count && value.progress.completed == completed && value.progress.percentage == percentage
    }

    static func item(_ value: SeasonalChecklistItemDTO, homeId: String) -> Bool {
        guard value.homeId == homeId, nonblank(value.id), nonblank(value.title),
              let season = value.seasonKey, nonblank(season), let year = value.year, (1...9999).contains(year),
              let key = value.itemKey, nonblank(key), statuses.contains(value.status), value.sortOrder >= 0,
              timestamp(value.completedAt) else { return false }
        return value.status != "hired" || value.gigId.map(nonblank) == true
    }

    static func property(_ value: HomePropertyValueDTO) -> Bool {
        guard let source = value.source, sources.contains(source), timestamp(value.lastUpdated) else { return false }
        guard [value.estimatedValue, value.valueRangeLow, value.valueRangeHigh].compactMap({ $0 }).allSatisfy({ $0.isFinite && $0 > 0 })
        else { return false }
        if let confidence = value.valueConfidence, !confidence.isFinite || !(0...100).contains(confidence) { return false }
        if let trend = value.zipMedianSalePriceTrend, !["up", "down", "flat"].contains(trend) { return false }
        if let year = value.yearBuilt, !(1...9999).contains(year) { return false }
        if let sqft = value.sqft, sqft <= 0 { return false }
        return propertyRange(value)
    }

    private static func propertyRange(_ value: HomePropertyValueDTO) -> Bool {
        if value.source == "unavailable",
           [value.estimatedValue, value.valueRangeLow, value.valueRangeHigh, value.valueConfidence]
           .contains(where: { $0 != nil }) { return false }
        if let low = value.valueRangeLow, let high = value.valueRangeHigh, low > high { return false }
        if let estimate = value.estimatedValue, let low = value.valueRangeLow, estimate < low { return false }
        if let estimate = value.estimatedValue, let high = value.valueRangeHigh, estimate > high { return false }
        return true
    }

    private static func timestamp(_ value: String?) -> Bool {
        guard let value else { return true }
        let formatter = ISO8601DateFormatter()
        if formatter.date(from: value) != nil { return true }
        formatter.formatOptions.insert(.withFractionalSeconds)
        return formatter.date(from: value) != nil
    }

    private static func nonblank(_ value: String) -> Bool {
        !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}
