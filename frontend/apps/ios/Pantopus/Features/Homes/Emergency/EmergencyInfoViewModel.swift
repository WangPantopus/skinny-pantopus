//
//  EmergencyInfoViewModel.swift
//  Pantopus
//
// swiftlint:disable file_length type_body_length

//  T6.4b / P17 — Backs `EmergencyInfoView`. Fetches
//  `GET /api/homes/:id/emergencies` (route `backend/routes/home.js:5406`)
//  and projects each row into a category-grouped section with a
//  category-tinted `RowLeading.typeIcon` + `RowTrailing.circularAction`
//  (tap-to-call for contact/medical, view-photo for shutoff, open-in-
//  maps for evac).
//
//  Composition mirrors `emergency-frames.jsx`:
//    • Chip strip — `All / Shutoffs / Contacts / Evac / Medical`
//      filters the section visibility client-side. The "Pinned" pseudo-
//      group (the household's curated quick-access shortcut) renders at
//      the top whenever the All chip is selected and at least one row
//      has `details["pinned"] == "1"`.
//    • Banner — home-green summary card (item count + last reviewed +
//      review-needed amber tail).
//    • Sections — one per `EmergencyCategory` in the order
//      shutoff → contact → evac → medical.
//

import Foundation
import Observation
import SwiftUI

/// Chip-strip filter ids. Stored as strings so they survive the
/// `ListOfRowsDataSource.selectedTab: String` contract.
public enum EmergencyFilter: String, CaseIterable, Sendable {
    case all
    case shutoff
    case contact
    case evac
    case medical

    /// Resolve the underlying `EmergencyCategory` for chip ids that
    /// represent a single category. `.all` returns `nil`.
    public var category: EmergencyCategory? {
        switch self {
        case .all: nil
        case .shutoff: .shutoff
        case .contact: .contact
        case .evac: .evac
        case .medical: .medical
        }
    }
}

/// Dialable phone number carried by a projection, or `nil` when the row
/// has no number to call. Only contact / medical rows carry a phone in
/// `actionTarget`; shutoff / evac carry a map or photo URL instead.
/// Nonisolated so the `@Sendable` row handler can read it.
func emergencyPhoneNumber(for projection: EmergencyRowProjection) -> String? {
    switch projection.category {
    case .contact, .medical:
        guard let target = projection.actionTarget,
              !target.trimmingCharacters(in: .whitespaces).isEmpty
        else { return nil }
        return target
    case .shutoff, .evac:
        return nil
    }
}

/// Pure projection: one DTO → display fields. Tested directly so the
/// chip / banner mapping doesn't need a SwiftUI view to exercise.
public struct EmergencyRowProjection: Sendable, Equatable {
    public let id: String
    public let category: EmergencyCategory
    public let glyph: PantopusIcon
    public let title: String
    public let body: String
    public let bodyIcon: PantopusIcon?
    public let lastReviewed: String?
    public let needsReview: Bool
    public let pinned: Bool
    public let actionTarget: String?
}

/// Banner summary. Pure projection from the loaded rows.
public struct EmergencyBannerSummary: Sendable, Equatable {
    public let totalItems: Int
    public let lastReviewedLabel: String?
    public let needsReviewCount: Int

    public var hasContent: Bool {
        totalItems > 0
    }
}

@Observable
@MainActor
final class EmergencyInfoViewModel: ListOfRowsDataSource {
    let title = "Emergency info"

    /// Home-tinted home subtitle rendered in the toolbar — set once the
    /// home label resolves. Today we don't fetch the home detail
    /// alongside emergencies, so the subtitle stays nil and the screen
    /// renders the title-only top bar. A future patch can populate this
    /// after a `GET /api/homes/:id` call lands on this surface.
    var homeSubtitle: String?

    var topBarAction: TopBarAction? {
        TopBarAction(
            icon: .share,
            accessibilityLabel: "Share emergency info"
        ) { [weak self] in
            Task { @MainActor in
                self?.shareRequested = true
            }
        }
    }

    /// Set by the top-bar share action; `EmergencyInfoView` observes this to
    /// present the system share sheet, then clears it.
    var shareRequested = false
    /// Set by the banner's "Print card" CTA; `EmergencyInfoView` observes
    /// this to render + present the emergency-card PDF, then clears it.
    var printRequested = false

    /// Phone number the user just asked to dial — either the standing
    /// "Emergency? Call 911" banner or a stored contact's tap-to-dial
    /// row. `EmergencyInfoView` observes this, opens the `tel:` URL, and
    /// clears it. Mirrors RN's `callPhone` (`emergency.tsx:80`), which
    /// dials both the 911 banner (`:107`) and every contact's phone row
    /// (`:158`).
    var dialRequest: String?

    /// The number the standing red banner dials. RN hardcodes 911
    /// (`emergency.tsx:107`).
    static let emergencyNumber = "911"

    /// Banner copy — word-for-word with RN (`emergency.tsx:109`) and the
    /// Android screen.
    static let emergencyBannerTitle = "Emergency? Call 911"

    /// Ask the view to dial `number`. No-op for blank input so a contact
    /// row without a stored phone can't open an empty dialer.
    func dial(_ number: String?) {
        guard let number, !number.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        dialRequest = number
    }

    /// Dial the emergency services number from the standing banner.
    func dialEmergencyNumber() {
        dial(Self.emergencyNumber)
    }

    /// Chip-strip filter — primary navigation for the screen. Lives on
    /// `chipStrip` (mutually exclusive with `tabs`); the shell renders
    /// it as the secondary header row beneath the top bar.
    var chipStrip: ChipStripConfig? {
        let counts = rowsByCategory().mapValues(\.count)
        let totalCount = counts.values.reduce(0, +)
        let chips: [ChipStripConfig.Chip] = EmergencyFilter.allCases.map { filter in
            let label = switch filter {
            case .all: "All \(totalCount)"
            case .shutoff: "\(EmergencyCategory.shutoff.chipLabel) \(counts[.shutoff] ?? 0)"
            case .contact: "\(EmergencyCategory.contact.chipLabel) \(counts[.contact] ?? 0)"
            case .evac: "\(EmergencyCategory.evac.chipLabel) \(counts[.evac] ?? 0)"
            case .medical: "\(EmergencyCategory.medical.chipLabel) \(counts[.medical] ?? 0)"
            }
            return ChipStripConfig.Chip(
                id: filter.rawValue,
                label: label,
                icon: filter.category?.icon
            )
        }
        return ChipStripConfig(
            chips: chips,
            selectedId: selectedTab
        ) { [weak self] id in
            Task { @MainActor [weak self] in
                self?.selectedTab = id
            }
        }
    }

    var tabs: [ListOfRowsTab] {
        []
    }

    var selectedTab: String = EmergencyFilter.all.rawValue {
        didSet { rebuildState() }
    }

    var fab: FABAction? {
        FABAction(
            icon: .plus,
            accessibilityLabel: "Add emergency info",
            variant: .secondaryCreate,
            tint: .home
        ) { [onAdd] in onAdd() }
    }

    var banner: BannerConfig? {
        guard case .loaded = state else { return nil }
        let summary = currentBannerSummary()
        guard summary.hasContent else { return nil }
        return BannerConfig(
            icon: .shieldCheck,
            title: bannerTitle(for: summary),
            subtitle: bannerSubtitle(for: summary),
            cta: BannerCTA(
                label: "Print card",
                icon: .printer,
                accessibilityLabel: "Print emergency card",
                tint: .home
            ) { [weak self] in
                Task { @MainActor in
                    self?.printRequested = true
                }
            },
            tint: .home
        )
    }

    private(set) var state: ListOfRowsState = .loading

    /// Last successful payload — held so a chip filter change can
    /// re-project without re-fetching.
    private var emergencies: [HomeEmergencyDTO]?

    private let homeId: String
    private let api: APIClient
    private let onAction: @Sendable (HomeEmergencyDTO) -> Void
    private let onAdd: @Sendable () -> Void
    /// Inject a stable "now" for tests; production uses `Date()`.
    private let now: @Sendable () -> Date

    init(
        homeId: String,
        api: APIClient = .shared,
        onAction: @escaping @Sendable (HomeEmergencyDTO) -> Void = { _ in },
        onAdd: @escaping @Sendable () -> Void = {},
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.homeId = homeId
        self.api = api
        self.onAction = onAction
        self.onAdd = onAdd
        self.now = now
    }

    // MARK: - Share / print payloads

    /// Home label used on the share text + printed card header.
    private var cardHomeLabel: String {
        homeSubtitle.map { "\(title) · \($0)" } ?? title
    }

    /// Plain-text summary handed to the share sheet for "Share emergency
    /// info". `nil` when nothing has loaded yet.
    func shareSummaryText() -> String? {
        guard let emergencies, !emergencies.isEmpty else { return nil }
        let content = EmergencyCardPDF.content(from: emergencies, homeLabel: cardHomeLabel, now: now())
        var lines = ["\(content.homeLabel) — emergency info"]
        for section in content.sections where !section.items.isEmpty {
            lines.append("")
            lines.append(section.heading)
            for item in section.items {
                lines.append(item.detail.isEmpty ? "• \(item.title)" : "• \(item.title): \(item.detail)")
            }
        }
        return lines.joined(separator: "\n")
    }

    /// Printable A4 card content for "Print emergency card". `nil` when
    /// nothing has loaded yet.
    func printableCard() -> EmergencyCardContent? {
        guard let emergencies, !emergencies.isEmpty else { return nil }
        return EmergencyCardPDF.content(from: emergencies, homeLabel: cardHomeLabel, now: now())
    }

    func load() async {
        if case .loading = state {} else { state = .loading }
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    /// Backend has no pagination on emergencies today.
    func loadMoreIfNeeded() async {}

    private func fetch() async {
        do {
            let response: GetHomeEmergenciesResponse = try await api.request(
                HomesEndpoints.emergencies(homeId: homeId)
            )
            emergencies = response.emergencies
            rebuildState()
        } catch {
            emergencies = nil
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load emergency info."
            )
        }
    }

    private func rebuildState() {
        guard let emergencies else { return }
        if emergencies.isEmpty {
            state = .empty(
                ListOfRowsState.EmptyContent(
                    icon: .shieldCheck,
                    headline: "No emergency info set up",
                    subcopy: "Set up shutoffs, key contacts, evac spots, and medical info for this home. " +
                        "Easier to do now than during a 2 AM water leak.",
                    ctaTitle: "Add info"
                ) { [onAdd] in onAdd() }
            )
            return
        }

        let filter = EmergencyFilter(rawValue: selectedTab) ?? .all
        let bucketed = rowsByCategory()
        let categoriesToShow: [EmergencyCategory] = {
            if let category = filter.category { return [category] }
            return [.shutoff, .contact, .evac, .medical]
        }()

        var sections: [RowSection] = []

        // Pinned pseudo-section — only when All is active. The household's
        // curated quick-access shortcut list reads at the top of the page.
        if filter == .all {
            let pinned = emergencies.filter { $0.details["pinned"] == "1" }
            if !pinned.isEmpty {
                let rows = pinned.map { row(for: $0, pinned: true) }
                sections.append(RowSection(
                    id: "emergency.pinned",
                    header: "Pinned · Quick access",
                    rows: rows,
                    count: rows.count
                ))
            }
        }

        for category in categoriesToShow {
            let dtos = bucketed[category] ?? []
            if dtos.isEmpty { continue }
            let rows = dtos.map { row(for: $0, pinned: false) }
            sections.append(RowSection(
                id: "emergency.\(category.rawValue)",
                header: category.label,
                rows: rows,
                count: rows.count
            ))
        }

        if sections.isEmpty {
            state = .empty(
                ListOfRowsState.EmptyContent(
                    icon: .shieldCheck,
                    headline: "No \(filter.category?.chipLabel.lowercased() ?? "items") in this scope",
                    subcopy: "Switch chips above or add an item to populate this category."
                )
            )
            return
        }
        state = .loaded(sections: sections, hasMore: false)
    }

    // MARK: - Projection

    func row(for dto: HomeEmergencyDTO, pinned: Bool) -> RowModel {
        let projection = EmergencyInfoViewModel.project(dto: dto, pinned: pinned)
        let category = projection.category
        let dtoCopy = dto
        return RowModel(
            id: projection.id,
            title: projection.title,
            template: .statusChip,
            leading: .typeIcon(
                projection.glyph,
                background: category.background,
                foreground: category.foreground
            ),
            trailing: .circularAction(
                icon: category.actionIcon,
                accessibilityLabel: category.actionAccessibilityLabel,
                background: category.background,
                foreground: category.foreground
            ) { [weak self, onAction] in
                // A stored phone number is a tap-to-dial affordance (RN
                // `emergency.tsx:157-162`); everything else opens the
                // item detail.
                if let phone = emergencyPhoneNumber(for: projection) {
                    Task { @MainActor in self?.dial(phone) }
                } else {
                    onAction(dtoCopy)
                }
            },
            onTap: { [onAction] in onAction(dtoCopy) },
            body: projection.body,
            bodyIcon: projection.bodyIcon,
            inlineChip: nil,
            chips: chips(for: projection),
            metaTail: projection.needsReview ? nil : projection.lastReviewed
        )
    }

    private func chips(for projection: EmergencyRowProjection) -> [RowChip] {
        var chips: [RowChip] = [
            RowChip(
                text: projection.category.label,
                icon: projection.category.icon,
                tint: .custom(
                    background: projection.category.background,
                    foreground: projection.category.foreground
                )
            )
        ]
        if projection.needsReview {
            chips.append(RowChip(
                text: "Review needed",
                icon: .alertCircle,
                tint: .status(.warning)
            ))
        }
        return chips
    }

    /// Pure mapping from a DTO to display strings. Public-static so
    /// tests can exercise it without standing the VM up.
    nonisolated static func project(dto: HomeEmergencyDTO, pinned: Bool) -> EmergencyRowProjection {
        let category = EmergencyCategory.from(type: dto.type)
        let glyph = EmergencyCategory.glyph(for: dto.type)
        let body = detailString(dto: dto)
        let bodyIcon: PantopusIcon? = bodyIconFor(category: category, dto: dto)
        let lastReviewed = dto.details["reviewed"].map { "Reviewed \($0)" }
        let needsReview = dto.details["needs_review"] == "1"
        let actionTarget = actionTargetFor(category: category, dto: dto)
        return EmergencyRowProjection(
            id: dto.id,
            category: category,
            glyph: glyph,
            title: dto.label,
            body: body,
            bodyIcon: bodyIcon,
            lastReviewed: lastReviewed,
            needsReview: needsReview,
            pinned: pinned,
            actionTarget: actionTarget
        )
    }

    /// Compose the row's body string from the DTO. Prefers
    /// `details.detail` (a free-form sentence), falling back to
    /// `location` then to an empty string.
    private nonisolated static func detailString(dto: HomeEmergencyDTO) -> String {
        if let detail = dto.details["detail"], !detail.isEmpty { return detail }
        if let phone = dto.details["phone"], !phone.isEmpty {
            if let note = dto.details["note"], !note.isEmpty {
                return "\(phone) · \(note)"
            }
            return phone
        }
        if let location = dto.location, !location.isEmpty { return location }
        return ""
    }

    private nonisolated static func bodyIconFor(
        category: EmergencyCategory,
        dto: HomeEmergencyDTO
    ) -> PantopusIcon? {
        switch category {
        case .contact:
            dto.details["phone"] != nil ? .phone : .info
        case .shutoff, .evac:
            .mapPin
        case .medical:
            dto.details["phone"] != nil ? .phone : .mapPin
        }
    }

    private nonisolated static func actionTargetFor(
        category: EmergencyCategory,
        dto: HomeEmergencyDTO
    ) -> String? {
        switch category {
        case .contact, .medical:
            dto.details["phone"]
        case .evac, .shutoff:
            dto.details["map_url"] ?? dto.details["photo_url"]
        }
    }

    // MARK: - Banner + counts

    func currentBannerSummary() -> EmergencyBannerSummary {
        guard let emergencies else {
            return EmergencyBannerSummary(
                totalItems: 0,
                lastReviewedLabel: nil,
                needsReviewCount: 0
            )
        }
        return Self.summarize(emergencies: emergencies)
    }

    static func summarize(emergencies: [HomeEmergencyDTO]) -> EmergencyBannerSummary {
        let total = emergencies.count
        let needsReview = emergencies.filter { $0.details["needs_review"] == "1" }.count
        // Pick the most recent `reviewed` value across rows. Designs use
        // a single household-wide review date so the most recent wins.
        let mostRecent = emergencies
            .compactMap { $0.details["reviewed"] }
            .max()
        let label = mostRecent.map { "reviewed \($0)" }
        return EmergencyBannerSummary(
            totalItems: total,
            lastReviewedLabel: label,
            needsReviewCount: needsReview
        )
    }

    private func bannerTitle(for summary: EmergencyBannerSummary) -> String {
        let suffix = summary.lastReviewedLabel.map { " · \($0)" } ?? ""
        let unit = summary.totalItems == 1 ? "item" : "items"
        return "\(summary.totalItems) \(unit)\(suffix)"
    }

    private func bannerSubtitle(for summary: EmergencyBannerSummary) -> String {
        if summary.needsReviewCount > 0 {
            let unit = summary.needsReviewCount == 1 ? "item needs" : "items need"
            return "\(summary.needsReviewCount) \(unit) review · keep the plan current"
        }
        return "Plan current · shared with household members"
    }

    // MARK: - Helpers

    private func rowsByCategory() -> [EmergencyCategory: [HomeEmergencyDTO]] {
        guard let emergencies else { return [:] }
        var bucketed: [EmergencyCategory: [HomeEmergencyDTO]] = [:]
        for dto in emergencies {
            let category = EmergencyCategory.from(type: dto.type)
            bucketed[category, default: []].append(dto)
        }
        return bucketed
    }
}
