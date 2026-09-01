//
//  BillsListViewModel.swift
//  Pantopus
//
//  Backs `BillsListView` (T6.0a — re-skin of T5.2.2 / P13). Fetches
//  `GET /api/homes/:id/bills` (route `backend/routes/home.js:4506`) and
//  maps each row to the `RowTrailing.amountWithChip` template + a
//  utility-tinted `RowLeading.typeIcon` (utility category derived
//  client-side from the payee string — see `UtilityCategoryPalette`).
//
//  Drift from T5.2.2:
//    • 8 utility-tinted category tiles (electric / gas / water /
//      internet / hoa / insurance / trash / phone) + `generic`.
//    • 6-status chip palette (added `dueSoon` for due-in-7d and
//      `cancelled` for soft-deleted rows).
//    • Summary banner above the list — 30-day total + overdue count.
//    • Optional inline "Auto-pay" chip on scheduled rows.
//    • FAB shrunk to 56pt `canonicalCreate` + `.home` tint (was 52pt
//      sky `secondaryCreate`).
//
//  Splits: `splitWith` field is wired on `RowModel` (shell extension
//  T6.0a) but stays `nil` on every row today — the backend list
//  endpoint doesn't surface split membership on bills yet. Splits are
//  visible on the bill detail screen, which makes its own fetch to
//  `GET /api/homes/:id/bills/:billId/splits`. Wiring rows to splits is
//  a backend-prep follow-up (extend `/api/homes/:id/bills` response
//  with `split_members[≤3]` + `split_total_ways`).
//

import Foundation
import Observation
import SwiftUI

// swiftlint:disable file_length type_body_length function_body_length

/// Canonical bill-chip status, derived from `BillDTO.status` + `due_date`.
/// T6.0a adds `dueSoon` (≤ 7 days from now) and `cancelled` (soft-deleted).
public enum BillChipStatus: String, Sendable, Hashable {
    case due
    case dueSoon
    case overdue
    case scheduled
    case paid
    case cancelled
}

/// Tab identifiers for the Bills shell — kept as raw strings so they
/// survive the `ListOfRowsDataSource.selectedTab: String` contract.
enum BillsTab: String, CaseIterable {
    case upcoming
    case paid
    case all
}

private struct BillsTabCounts {
    let upcoming: Int?
    let paid: Int?
    let all: Int?
}

/// Banner data for the Bills summary banner. Pure projection from the
/// loaded bills + clock — exposed as a top-level value so tests can
/// exercise it without standing the VM up.
public struct BillsBannerSummary: Sendable, Equatable {
    /// Pre-formatted USD string for the 30-day total
    /// (e.g. `"$1,248.19"`). `nil` when zero bills are due.
    public let totalDueLabel: String?
    /// Count of overdue, non-cancelled, unpaid bills.
    public let overdueCount: Int
    /// Pre-formatted next-bill subtitle when nothing is overdue, e.g.
    /// `"All current · next bill in 4 days"`.
    public let nextBillSubtitle: String?

    public init(
        totalDueLabel: String?,
        overdueCount: Int,
        nextBillSubtitle: String?
    ) {
        self.totalDueLabel = totalDueLabel
        self.overdueCount = overdueCount
        self.nextBillSubtitle = nextBillSubtitle
    }

    /// Whether the banner has anything to render. The shell hides the
    /// banner when this returns `false` so empty-state surfaces don't
    /// carry a "0 due in the next 30 days" preamble.
    public var hasContent: Bool {
        totalDueLabel != nil || overdueCount > 0
    }
}

/// ViewModel for the Bills list. Builds `RowModel`s from `BillDTO`s and
/// re-renders the tab filter client-side — backend supports a
/// `?status=` query but the design wants three buckets the server
/// doesn't speak, so the VM owns the projection.
@Observable
@MainActor
final class BillsListViewModel: ListOfRowsDataSource {
    let title = "Bills"
    /// No top-bar action in T6.0a: the design's filter glyph isn't
    /// wired to a real filter sheet yet; the 3 tabs cover the design's
    /// filter intent. The FAB owns the canonical "Add a bill" action so
    /// we don't need a duplicate entry point in the top bar. Tracked for
    /// a follow-up if a filter sheet ships.
    var topBarAction: TopBarAction? {
        nil
    }

    /// Tabs with live counts. Rebuilt whenever `bills` changes.
    var tabs: [ListOfRowsTab] {
        let summary = bills.map(counts) ?? BillsTabCounts(upcoming: nil, paid: nil, all: nil)
        return [
            ListOfRowsTab(id: BillsTab.upcoming.rawValue, label: "Upcoming", count: summary.upcoming),
            ListOfRowsTab(id: BillsTab.paid.rawValue, label: "Paid", count: summary.paid),
            ListOfRowsTab(id: BillsTab.all.rawValue, label: "All", count: summary.all)
        ]
    }

    var selectedTab: String = BillsTab.upcoming.rawValue {
        didSet { rebuildState() }
    }

    var fab: FABAction? {
        FABAction(
            icon: .plus,
            accessibilityLabel: "Add a bill",
            variant: .canonicalCreate,
            tint: .home
        ) { [onAddBill] in onAddBill() }
    }

    /// Optional summary banner above the rows. Nil on the Paid tab,
    /// nil on Upcoming when nothing is due and nothing is overdue,
    /// nil on the All tab. Loading / empty / error states also hide it.
    var banner: BannerConfig? {
        guard case .loaded = state, BillsTab(rawValue: selectedTab) == .upcoming else {
            return nil
        }
        let summary = currentBannerSummary()
        guard summary.hasContent else { return nil }
        return BannerConfig(
            icon: .wallet,
            title: bannerTitle(for: summary),
            subtitle: bannerSubtitle(for: summary),
            tint: .home
        )
    }

    private(set) var state: ListOfRowsState = .loading

    /// Last successful payload — held so a tab change can re-filter
    /// without re-fetching.
    private var bills: [BillDTO]?

    private let homeId: String
    private let api: APIClient
    private let onOpenBill: @Sendable (String) -> Void
    private let onAddBill: @Sendable () -> Void
    /// Inject a stable "now" for tests; production uses `Date()`.
    private let now: @Sendable () -> Date

    init(
        homeId: String,
        api: APIClient = .shared,
        onOpenBill: @escaping @Sendable (String) -> Void = { _ in },
        onAddBill: @escaping @Sendable () -> Void = {},
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.homeId = homeId
        self.api = api
        self.onOpenBill = onOpenBill
        self.onAddBill = onAddBill
        self.now = now
    }

    func load() async {
        if case .loading = state {} else { state = .loading }
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    /// Backend has no pagination on bills today.
    func loadMoreIfNeeded() async {}

    /// Re-issue the load after a successful create / update — the host
    /// view calls this on `pendingEvent == .created`. Falls back to the
    /// same `fetch()` path so optimistic UI isn't required.
    func reloadAfterMutation() async {
        await fetch()
    }

    private func fetch() async {
        do {
            let response: GetHomeBillsResponse = try await api.request(
                HomesEndpoints.bills(homeId: homeId)
            )
            bills = response.bills
            rebuildState()
        } catch {
            bills = nil
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load your bills."
            )
        }
    }

    private func rebuildState() {
        guard let bills else { return }
        let nowDate = now()
        let tab = BillsTab(rawValue: selectedTab) ?? .upcoming
        let filtered = bills.filter { passes($0, tab: tab, now: nowDate) }
        if filtered.isEmpty {
            state = .empty(
                ListOfRowsState.EmptyContent(
                    icon: .receipt,
                    headline: "No bills tracked yet",
                    subcopy: "Add the utilities, insurance, and HOA dues for this home. " +
                        "Schedule auto-pay or split between household members.",
                    ctaTitle: "Add a bill"
                ) { [onAddBill] in onAddBill() }
            )
            return
        }
        let rows = filtered.map { row(for: $0, now: nowDate) }
        state = .loaded(sections: [RowSection(rows: rows)], hasMore: false)
    }

    // MARK: - Row + chip mapping

    func row(for bill: BillDTO, now: Date) -> RowModel {
        let projection = BillsListViewModel.project(bill: bill, now: now)
        let billId = bill.id
        let category = projection.category
        return RowModel(
            id: bill.id,
            title: projection.payee,
            subtitle: projection.subtitle,
            template: .statusChip,
            leading: .typeIcon(
                category.icon,
                background: category.background,
                foreground: category.foreground
            ),
            trailing: .amountWithChip(
                amount: projection.amount,
                chipText: projection.chipText,
                chipVariant: projection.chipVariant,
                chipIcon: projection.chipIcon
            ),
            onTap: { [onOpenBill] in onOpenBill(billId) },
            inlineChip: projection.inlineChip,
            highlight: projection.highlight
        )
    }

    /// Pure mapping from a bill + clock to display strings. Exposed
    /// `static` so unit tests can exercise the chip / subtitle
    /// derivation without standing the VM up.
    static func project(bill: BillDTO, now: Date) -> BillRowProjection {
        let chip = chipStatus(for: bill, now: now)
        let category = UtilityCategory.from(payee: bill.providerName)
        let payee = bill.providerName ?? category.label
        let amount = formatCurrency(bill.displayAmount)
        let dueShort = formatDateShort(iso: bill.dueDate)
        let paidShort = formatDateShort(iso: bill.paidAt)

        switch chip {
        case .paid:
            return BillRowProjection(
                payee: payee,
                subtitle: paidShort.map { "Paid \($0)" } ?? "Paid",
                amount: amount,
                chipText: "Paid",
                chipVariant: .success,
                chipIcon: .check,
                status: chip,
                category: category,
                inlineChip: nil,
                highlight: nil
            )
        case .cancelled:
            return BillRowProjection(
                payee: payee,
                subtitle: "Cancelled",
                amount: amount,
                chipText: "Cancelled",
                chipVariant: .neutral,
                chipIcon: .x,
                status: chip,
                category: category,
                inlineChip: nil,
                highlight: .muted
            )
        case .overdue:
            return BillRowProjection(
                payee: payee,
                subtitle: dueShort.map { "Overdue · was due \($0)" } ?? "Overdue",
                amount: amount,
                chipText: "Overdue",
                chipVariant: .error,
                chipIcon: .alertCircle,
                status: chip,
                category: category,
                inlineChip: nil,
                highlight: nil
            )
        case .dueSoon:
            return BillRowProjection(
                payee: payee,
                subtitle: dueShort.map { "Due \($0)" } ?? "Due soon",
                amount: amount,
                chipText: "Due soon",
                chipVariant: .warning,
                chipIcon: .clock,
                status: chip,
                category: category,
                inlineChip: nil,
                highlight: nil
            )
        case .scheduled:
            return BillRowProjection(
                payee: payee,
                subtitle: dueShort.map { "Auto-pays \($0)" } ?? "Auto-pay scheduled",
                amount: amount,
                chipText: "Scheduled",
                chipVariant: .info,
                chipIcon: .calendar,
                status: chip,
                category: category,
                inlineChip: RowChip(
                    text: "Auto-pay",
                    icon: .arrowsRepeat,
                    tint: .status(.info)
                ),
                highlight: nil
            )
        case .due:
            return BillRowProjection(
                payee: payee,
                subtitle: dueShort.map { "Due \($0)" } ?? "No due date",
                amount: amount,
                chipText: "Due",
                chipVariant: .warning,
                chipIcon: .clock,
                status: chip,
                category: category,
                inlineChip: nil,
                highlight: nil
            )
        }
    }

    /// Derive the chip status per the T6.0a contract:
    ///   - `cancelled`   when status is "cancelled"
    ///   - `paid`        when status is "paid"
    ///   - `scheduled`   when status is "scheduled"
    ///   - `overdue`     when due_date is in the past
    ///   - `dueSoon`     when due_date is within the next 7 days
    ///   - `due`         otherwise
    static func chipStatus(for bill: BillDTO, now: Date) -> BillChipStatus {
        if bill.status == "cancelled" { return .cancelled }
        if bill.status == "paid" { return .paid }
        if bill.status == "scheduled" { return .scheduled }
        if let iso = bill.dueDate, let due = parseDate(iso) {
            if due < now { return .overdue }
            let sevenDaysOut = now.addingTimeInterval(7 * 24 * 60 * 60)
            if due <= sevenDaysOut { return .dueSoon }
        }
        return .due
    }

    private func passes(_ bill: BillDTO, tab: BillsTab, now: Date) -> Bool {
        let chip = BillsListViewModel.chipStatus(for: bill, now: now)
        switch tab {
        case .upcoming:
            // Upcoming excludes cancelled + paid; everything else (due,
            // dueSoon, overdue, scheduled) is upcoming.
            return chip != .cancelled && chip != .paid
        case .paid:
            return chip == .paid
        case .all:
            return chip != .cancelled
        }
    }

    private func counts(_ bills: [BillDTO]) -> BillsTabCounts {
        let nowDate = now()
        var upcoming = 0
        var paid = 0
        var all = 0
        for b in bills {
            let chip = BillsListViewModel.chipStatus(for: b, now: nowDate)
            if chip == .cancelled { continue }
            all += 1
            if chip == .paid {
                paid += 1
            } else {
                upcoming += 1
            }
        }
        return BillsTabCounts(upcoming: upcoming, paid: paid, all: all)
    }

    // MARK: - Banner

    /// Compute the banner summary for the currently-loaded bills.
    /// Exposed `internal` so tests can exercise it without going through
    /// the SwiftUI view body.
    func currentBannerSummary() -> BillsBannerSummary {
        guard let bills else {
            return BillsBannerSummary(
                totalDueLabel: nil,
                overdueCount: 0,
                nextBillSubtitle: nil
            )
        }
        return BillsListViewModel.summarize(bills: bills, now: now())
    }

    /// Pure summary projection. Public-static for tests.
    static func summarize(bills: [BillDTO], now: Date) -> BillsBannerSummary {
        let thirtyDaysOut = now.addingTimeInterval(30 * 24 * 60 * 60)
        var totalDue: Decimal = 0
        var overdueCount = 0
        var totalCount = 0
        var nextDue: (Date, BillDTO)?
        for bill in bills {
            let chip = chipStatus(for: bill, now: now)
            if chip == .cancelled || chip == .paid { continue }
            totalCount += 1
            // Sum due in next 30 days (overdue counts too — the user owes it).
            if let iso = bill.dueDate, let due = parseDate(iso) {
                if due <= thirtyDaysOut {
                    totalDue += bill.displayAmount
                }
                if due >= now, nextDue.map({ due < $0.0 }) ?? true {
                    nextDue = (due, bill)
                }
            } else {
                // No due date — still surface in the total when the bill
                // is upcoming (scheduled with no date, etc.).
                totalDue += bill.displayAmount
            }
            if chip == .overdue { overdueCount += 1 }
        }
        let totalLabel = totalCount > 0 ? formatCurrency(totalDue) : nil
        let nextSubtitle = nextDue.map { date, _ -> String in
            let days = Int(date.timeIntervalSince(now) / (24 * 60 * 60))
            if days <= 0 {
                return "Next bill due today"
            } else if days == 1 {
                return "All current · next bill tomorrow"
            } else {
                return "All current · next bill in \(days) days"
            }
        }
        return BillsBannerSummary(
            totalDueLabel: totalLabel,
            overdueCount: overdueCount,
            nextBillSubtitle: nextSubtitle
        )
    }

    private func bannerTitle(for summary: BillsBannerSummary) -> String {
        if let total = summary.totalDueLabel {
            return "\(total) due in the next 30 days"
        }
        return "No upcoming bills"
    }

    private func bannerSubtitle(for summary: BillsBannerSummary) -> String? {
        if summary.overdueCount > 0 {
            let count = summary.overdueCount
            return count == 1
                ? "1 overdue · pay or schedule today"
                : "\(count) overdue · pay or schedule today"
        }
        return summary.nextBillSubtitle
    }

    // MARK: - Formatting

    static func formatCurrency(_ amount: Decimal) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        return formatter.string(from: amount as NSDecimalNumber) ?? "$\(amount)"
    }

    static func formatDateShort(iso: String?) -> String? {
        guard let iso, let date = parseDate(iso) else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    static func parseDate(_ iso: String) -> Date? {
        // Accept full ISO timestamps and bare yyyy-MM-dd strings.
        let isoFull = ISO8601DateFormatter()
        isoFull.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = isoFull.date(from: iso) { return d }
        let isoShort = ISO8601DateFormatter()
        isoShort.formatOptions = [.withInternetDateTime]
        if let d = isoShort.date(from: iso) { return d }
        let day = DateFormatter()
        day.locale = Locale(identifier: "en_US_POSIX")
        day.timeZone = TimeZone(secondsFromGMT: 0)
        day.dateFormat = "yyyy-MM-dd"
        return day.date(from: iso)
    }
}

/// Pure projection of one bill into a row's display fields. Used both
/// by the VM and by tests.
public struct BillRowProjection: Sendable, Equatable {
    public let payee: String
    public let subtitle: String
    public let amount: String
    public let chipText: String
    public let chipVariant: StatusChipVariant
    public let chipIcon: PantopusIcon?
    public let status: BillChipStatus
    public let category: UtilityCategory
    public let inlineChip: RowChip?
    public let highlight: RowHighlight?
}
