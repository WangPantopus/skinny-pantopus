//
//  PackagesListViewModel.swift
//  Pantopus
//
//  T6.3d (P14) — Per-home Packages list. Wraps
//  `GET /api/homes/:id/packages` (route `backend/routes/home.js:4673`)
//  and projects each `PackageDTO` onto the shared `ListOfRows` shell
//  (T5.0 archetype) using:
//
//    - `RowLeading.typeIcon` tinted via `CourierKind` (per-courier
//      palette in `CourierPalette.swift`)
//    - `RowTrailing.statusChip` driven by `PackageChipStatus`
//      (palette in `PackageStatusPalette.swift`)
//    - title = description (or tracking number / "Package" fallback)
//    - subtitle = `[courier] · [drop location]`
//    - body = recipient label ("For Ava" / "Picked up by Maria") when
//      `picked_up_by` is set and ≠ the current user
//
//  Tab projection (`PackagesTab` → backend statuses):
//    Expected  = expected, out_for_delivery
//    Delivered = delivered, picked_up
//    Archived  = lost, returned
//

import Foundation
import Observation
import SwiftUI

private struct PackagesTabCounts {
    let expected: Int?
    let delivered: Int?
    let archived: Int?
}

/// Banner summary for the Packages top-of-list strip. Pure projection
/// from the loaded payload + clock — exposed as a top-level type so
/// tests can exercise it directly.
public struct PackagesBannerSummary: Sendable, Equatable {
    /// Count of in-flight packages (status `expected` or
    /// `out_for_delivery`).
    public let inFlightCount: Int
    /// Count of in-flight packages whose `expected_at` falls on the
    /// same calendar day as `now`.
    public let arrivingTodayCount: Int
    /// Count of packages whose status is `lost` (anything the user
    /// needs to act on).
    public let exceptionCount: Int

    public init(
        inFlightCount: Int,
        arrivingTodayCount: Int,
        exceptionCount: Int
    ) {
        self.inFlightCount = inFlightCount
        self.arrivingTodayCount = arrivingTodayCount
        self.exceptionCount = exceptionCount
    }

    /// Whether the banner has anything to render. The shell hides the
    /// banner when this returns `false`.
    public var hasContent: Bool {
        inFlightCount > 0 || exceptionCount > 0
    }
}

/// Pure projection of one package into a row's display fields. Used
/// both by the VM and by tests.
public struct PackageRowProjection: Sendable, Equatable {
    public let title: String
    public let subtitle: String?
    public let body: String?
    public let chipText: String
    public let chipVariant: StatusChipVariant
    public let chipIcon: PantopusIcon
    public let status: PackageChipStatus
    public let courier: CourierKind
    public let highlight: RowHighlight?
}

/// ViewModel for the per-home Packages list. Tab filtering is
/// client-side — backend supports `?status=` but the design wants three
/// buckets that don't map 1:1 to a single status value.
@Observable
@MainActor
public final class PackagesListViewModel: ListOfRowsDataSource {
    public let title = "Packages"

    /// No top-bar action in T6.3d. The design's right-side filter glyph
    /// isn't wired to a sheet yet (the 3 tabs cover the filter intent)
    /// and the FAB owns the canonical "Log a package" action.
    public var topBarAction: TopBarAction? {
        nil
    }

    public var tabs: [ListOfRowsTab] {
        let counts = packages.map(counts) ??
            PackagesTabCounts(expected: nil, delivered: nil, archived: nil)
        return [
            ListOfRowsTab(id: PackagesTab.expected.rawValue, label: "Expected", count: counts.expected),
            ListOfRowsTab(id: PackagesTab.delivered.rawValue, label: "Delivered", count: counts.delivered),
            ListOfRowsTab(id: PackagesTab.archived.rawValue, label: "Archived", count: counts.archived)
        ]
    }

    public var selectedTab: String = PackagesTab.expected.rawValue {
        didSet { rebuildState() }
    }

    public var fab: FABAction? {
        FABAction(
            icon: .plus,
            accessibilityLabel: "Log a package",
            variant: .canonicalCreate,
            tint: .home
        ) { [onLogPackage] in onLogPackage() }
    }

    /// Summary banner — only rendered on the Expected tab when at least
    /// one in-flight package exists.
    public var banner: BannerConfig? {
        guard case .loaded = state,
              PackagesTab(rawValue: selectedTab) == .expected else {
            return nil
        }
        let summary = currentBannerSummary()
        guard summary.hasContent else { return nil }
        return BannerConfig(
            icon: .package,
            title: bannerTitle(for: summary),
            subtitle: bannerSubtitle(for: summary),
            tint: .home
        )
    }

    public private(set) var state: ListOfRowsState = .loading

    /// Last successful payload — held so a tab change can re-filter
    /// without re-fetching.
    private var packages: [PackageDTO]?

    private let homeId: String
    private let api: APIClient
    private let currentUserId: String?
    private let memberLookup: @Sendable (String) -> String?
    private let onOpenPackage: @Sendable (String) -> Void
    private let onLogPackage: @Sendable () -> Void
    private let now: @Sendable () -> Date

    init(
        homeId: String,
        api: APIClient = .shared,
        currentUserId: String? = nil,
        memberLookup: @escaping @Sendable (String) -> String? = { _ in nil },
        onOpenPackage: @escaping @Sendable (String) -> Void = { _ in },
        onLogPackage: @escaping @Sendable () -> Void = {},
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.homeId = homeId
        self.api = api
        self.currentUserId = currentUserId
        self.memberLookup = memberLookup
        self.onOpenPackage = onOpenPackage
        self.onLogPackage = onLogPackage
        self.now = now
    }

    public func load() async {
        if case .loading = state {} else { state = .loading }
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    public func loadMoreIfNeeded() async {}

    /// Re-issue the load after a successful create / update — the host
    /// view calls this on `pendingEvent == .logged`. Same path as
    /// `fetch()` so optimistic UI isn't required.
    public func reloadAfterMutation() async {
        await fetch()
    }

    private func fetch() async {
        do {
            let response: GetHomePackagesResponse = try await api.request(
                HomesEndpoints.packages(homeId: homeId)
            )
            packages = response.packages
            rebuildState()
        } catch {
            packages = nil
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load your packages."
            )
        }
    }

    private func rebuildState() {
        guard let packages else { return }
        let tab = PackagesTab(rawValue: selectedTab) ?? .expected
        let filtered = packages.filter { passes($0, tab: tab) }
        if filtered.isEmpty {
            state = .empty(
                ListOfRowsState.EmptyContent(
                    icon: .package,
                    headline: emptyHeadline(for: tab),
                    subcopy: emptySubcopy(for: tab),
                    ctaTitle: "Log a package"
                ) { [onLogPackage] in onLogPackage() }
            )
            return
        }
        let rows = filtered.map { row(for: $0) }
        state = .loaded(sections: [RowSection(rows: rows)], hasMore: false)
    }

    // MARK: - Row mapping

    func row(for pkg: PackageDTO) -> RowModel {
        let projection = PackagesListViewModel.project(
            package: pkg,
            currentUserId: currentUserId,
            memberLookup: memberLookup
        )
        let packageId = pkg.id
        return RowModel(
            id: pkg.id,
            title: projection.title,
            subtitle: projection.subtitle,
            template: .statusChip,
            leading: .typeIcon(
                projection.courier.icon,
                background: projection.courier.background,
                foreground: projection.courier.foreground
            ),
            trailing: .statusChip(
                text: projection.chipText,
                variant: projection.chipVariant
            ),
            onTap: { [onOpenPackage] in onOpenPackage(packageId) },
            body: projection.body,
            highlight: projection.highlight
        )
    }

    /// Pure mapping from a package + viewer context to display strings.
    /// Exposed `static` so unit tests can exercise the projection
    /// without standing the VM up.
    public static func project(
        package: PackageDTO,
        currentUserId: String?,
        memberLookup: @Sendable (String) -> String?
    ) -> PackageRowProjection {
        let courier = CourierKind.from(carrier: package.carrier)
        let status = PackageChipStatus.from(raw: package.status)

        let title: String = {
            if let desc = package.description?.trimmingCharacters(in: .whitespaces),
               !desc.isEmpty {
                return desc
            }
            if let trk = package.trackingNumber?.trimmingCharacters(in: .whitespaces),
               !trk.isEmpty {
                return "Tracking #\(shortTracking(trk))"
            }
            return "Package"
        }()

        let drop = package.deliveryInstructions?.trimmingCharacters(in: .whitespaces)
            .nilIfEmpty
        let subtitle: String? = {
            let parts: [String] = [courier.label, drop].compactMap { $0 }
            return parts.isEmpty ? nil : parts.joined(separator: " · ")
        }()

        let body: String? = {
            // Recipient line — only shown when the pickup is attributed
            // to a known household member who is NOT the current user.
            // Lookup is supplied by the caller; production wires it to
            // the household membership cache, tests pass a stub.
            guard let pickedUpBy = package.pickedUpBy,
                  !pickedUpBy.isEmpty,
                  pickedUpBy != currentUserId else {
                return nil
            }
            let label = memberLookup(pickedUpBy)?.trimmingCharacters(in: .whitespaces) ?? ""
            guard !label.isEmpty else { return nil }
            switch status {
            case .pickedUp: return "Picked up by \(label)"
            default: return "For \(label)"
            }
        }()

        let highlight: RowHighlight? = status == .returned ? .muted : nil

        return PackageRowProjection(
            title: title,
            subtitle: subtitle,
            body: body,
            chipText: status.label,
            chipVariant: status.chipVariant,
            chipIcon: status.chipIcon,
            status: status,
            courier: courier,
            highlight: highlight
        )
    }

    private func passes(_ pkg: PackageDTO, tab: PackagesTab) -> Bool {
        PackageChipStatus.from(raw: pkg.status).tab == tab
    }

    private func counts(_ packages: [PackageDTO]) -> PackagesTabCounts {
        var expected = 0
        var delivered = 0
        var archived = 0
        for pkg in packages {
            switch PackageChipStatus.from(raw: pkg.status).tab {
            case .expected: expected += 1
            case .delivered: delivered += 1
            case .archived: archived += 1
            }
        }
        return PackagesTabCounts(
            expected: expected,
            delivered: delivered,
            archived: archived
        )
    }

    // MARK: - Banner

    func currentBannerSummary() -> PackagesBannerSummary {
        guard let packages else {
            return PackagesBannerSummary(
                inFlightCount: 0,
                arrivingTodayCount: 0,
                exceptionCount: 0
            )
        }
        return PackagesListViewModel.summarize(packages: packages, now: now())
    }

    /// Pure summary projection. Public-static for tests.
    public static func summarize(
        packages: [PackageDTO],
        now: Date
    ) -> PackagesBannerSummary {
        var inFlight = 0
        var arrivingToday = 0
        var exception = 0
        let calendar = Calendar(identifier: .gregorian)
        let nowDay = calendar.startOfDay(for: now)
        let tomorrowDay = calendar.date(byAdding: .day, value: 1, to: nowDay)
            ?? nowDay.addingTimeInterval(24 * 60 * 60)
        for pkg in packages {
            let status = PackageChipStatus.from(raw: pkg.status)
            if status.isInFlight {
                inFlight += 1
                if let iso = pkg.expectedAt, let when = parseDate(iso),
                   when >= nowDay, when < tomorrowDay {
                    arrivingToday += 1
                }
            }
            if status == .lost { exception += 1 }
        }
        return PackagesBannerSummary(
            inFlightCount: inFlight,
            arrivingTodayCount: arrivingToday,
            exceptionCount: exception
        )
    }

    private func bannerTitle(for summary: PackagesBannerSummary) -> String {
        let inflight = summary.inFlightCount
        let today = summary.arrivingTodayCount
        let inflightWord = inflight == 1 ? "package in flight" : "packages in flight"
        if today > 0 {
            return "\(inflight) \(inflightWord) · \(today) arriving today"
        }
        return "\(inflight) \(inflightWord)"
    }

    private func bannerSubtitle(for summary: PackagesBannerSummary) -> String? {
        if summary.exceptionCount > 0 {
            let count = summary.exceptionCount
            return count == 1
                ? "1 needs attention · address or signature"
                : "\(count) need attention · address or signature"
        }
        return "All on schedule"
    }

    // MARK: - Empty state copy

    private func emptyHeadline(for tab: PackagesTab) -> String {
        switch tab {
        case .expected: "No packages tracked yet"
        case .delivered: "No delivered packages"
        case .archived: "No archived packages"
        }
    }

    private func emptySubcopy(for tab: PackagesTab) -> String {
        switch tab {
        case .expected:
            "Log incoming deliveries so the household can see what's arriving — " +
                "tracking, drop instructions, and who it's for."
        case .delivered:
            "Delivered packages show up here once a carrier marks them dropped off."
        case .archived:
            "Returned or missing packages move to Archived after their lifecycle closes."
        }
    }

    // MARK: - Helpers

    static func shortTracking(_ raw: String) -> String {
        let stripped = raw.replacingOccurrences(of: " ", with: "")
        if stripped.count <= 8 { return raw }
        return "…" + String(stripped.suffix(7))
    }

    static func parseDate(_ iso: String) -> Date? {
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

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
