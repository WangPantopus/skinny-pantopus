import Foundation

/// Format 2 is explicit: chronological months and one currency in major units.
enum HomeBillPresentation {
    static func isCurrent(_ data: HomeBillTrendsDTO) -> Bool {
        guard data.formatVersion == 2, data.calculationVersion == 2,
              data.currency == "USD" else { return false }
        guard data.billsByType.values.allSatisfy({ valid(months: $0.months, amounts: $0.amounts) }) else { return false }
        return data.benchmarks.values.allSatisfy { row in
            if row.insufficientData {
                return row.months.isEmpty && row.avgAmounts.isEmpty && (1...7).contains(row.needed ?? 0)
            }
            return (row.householdCount ?? 0) >= 10 && valid(months: row.months, amounts: row.avgAmounts)
        }
    }

    private static func valid(months: [String], amounts: [Double]) -> Bool {
        guard !months.isEmpty, months.count <= 24, months.count == amounts.count,
              months == months.sorted(), Set(months).count == months.count else { return false }
        return months.allSatisfy { $0.range(of: "^\\d{4}-(0[1-9]|1[0-2])$", options: .regularExpression) != nil }
            && amounts.allSatisfy { $0.isFinite && $0 >= 0 && $0 * 100 <= 9_007_199_254_740_991 }
    }

    static func amount(_ value: Double, currency: String) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter.string(from: NSNumber(value: value)) ?? "\(value) \(currency)"
    }

    static func note(series: HomeBillTrendSeriesDTO, benchmark: HomeBillBenchmarkDTO?, currency: String) -> String? {
        guard let month = series.months.last, let mine = series.amounts.last else { return nil }
        let period = "\(month) · \(currency)"
        guard let benchmark, !benchmark.insufficientData, (benchmark.householdCount ?? 0) >= 10,
              let index = benchmark.months.firstIndex(of: month), benchmark.avgAmounts.indices.contains(index) else {
            return "\(period) · No comparison for this month"
        }
        let neighbors = benchmark.avgAmounts[index]
        let label = amount(neighbors, currency: currency)
        if mine > neighbors { return "\(period) · Above the \(label) neighborhood average" }
        if mine < neighbors { return "\(period) · Below the \(label) neighborhood average" }
        return "\(period) · In line with the \(label) neighborhood average"
    }
}
