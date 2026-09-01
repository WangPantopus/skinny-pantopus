//
//  StampsViewModel.swift
//  Pantopus
//
//  A17.11 — Stamps view-model. Drives three surfaces:
//
//   1. the postage *wallet* frame (`state`) — the A17.11 book / sheet /
//      denomination rail / usage ledger. No backend route models a
//      postage wallet, so this frame still projects the deterministic
//      `StampsSampleData` fixtures (the same no-backend pattern as
//      `VacationHold` / `MailDay`). When a wallet endpoint lands, only
//      `projectedState()` changes.
//   2. the stamp **collection** (`collection`) — live from
//      `GET /api/mailbox/v2/p3/stamps`
//      (`backend/routes/mailboxV2Phase3.js:1204`).
//   3. the seasonal **themes** view (`themes`) — live from
//      `GET /api/mailbox/v2/p3/themes` (`:1249`), applied with
//      `POST /api/mailbox/v2/p3/themes/apply` (`:1285`).
//
//  RN drives 2 + 3 from the same screen and flips between them with a
//  header toggle (`src/app/mailbox/stamps.tsx:107-112`); `mode` mirrors
//  that.
//
//  Buy actions are stubs per the brief (no Stripe): "Buy more" refills
//  the featured book in local state; "Buy stamps" / "Get book" on the
//  empty state acquires the starter book and flips to the populated
//  wallet.
//

import Foundation
import Observation

/// Initial seed for the screen — which frame the route lands on.
public enum StampsSeed: Sendable, Hashable {
    case populated
    case empty
}

@Observable
@MainActor
public final class StampsViewModel {
    public private(set) var state: StampsState = .loading
    /// Which half of the screen is on show — RN's header toggle.
    public private(set) var mode: StampsViewMode = .stamps
    /// Live stamp collection (`GET /p3/stamps`).
    public private(set) var collection: StampCollectionState = .loading
    /// Live seasonal themes (`GET /p3/themes`).
    public private(set) var themes: StampThemesState = .loading
    /// A theme apply is in flight; disables the rows while it runs.
    public private(set) var applyingThemeId: String?
    /// Transient banner shown after an apply succeeds or fails.
    public var toast: String?

    private let seed: StampsSeed
    private let seededContent: StampsContent?
    private let onBack: @MainActor () -> Void
    private let api: APIClient

    /// - Parameters:
    ///   - seed: Which wallet frame to project. `.populated` is the default
    ///     route landing; `.empty` is reached when the wallet is bare.
    ///   - content: Optional override (tests / previews) for the
    ///     populated projection.
    ///   - onBack: Pops the screen.
    public convenience init(
        seed: StampsSeed = .populated,
        content: StampsContent? = nil,
        onBack: @escaping @MainActor () -> Void = {}
    ) {
        self.init(seed: seed, content: content, api: .shared, onBack: onBack)
    }

    /// Test/internal initializer with injectable networking. Not `public`:
    /// `APIClient` is module-internal.
    init(
        seed: StampsSeed = .populated,
        content: StampsContent? = nil,
        api: APIClient,
        onBack: @escaping @MainActor () -> Void = {}
    ) {
        self.seed = seed
        seededContent = content
        self.api = api
        self.onBack = onBack
    }

    // MARK: - Lifecycle

    public func load() async {
        state = projectedState()
        await fetchCollection()
        await fetchThemes()
    }

    public func refresh() async {
        state = projectedState()
        await fetchCollection()
        await fetchThemes()
    }

    private func projectedState() -> StampsState {
        switch seed {
        case .populated:
            .loaded(seededContent ?? StampsSampleData.populated)
        case .empty:
            .empty(StampsSampleData.empty)
        }
    }

    // MARK: - Intents

    public func tapBack() {
        onBack()
    }

    /// Flip between the collection and the seasonal-themes view.
    public func toggleMode() {
        mode = mode.toggled
    }

    public func consumeToast() {
        toast = nil
    }

    /// "Buy more stamps" (populated dock). Stub: refills the featured
    /// book to full in local state — no purchase flow (out of scope).
    public func buyMore() {
        guard case let .loaded(content) = state else { return }
        var refilled = content
        refilled.book = StampBook(
            series: content.book.series,
            total: content.book.total,
            used: 0,
            purchasedLabel: content.book.purchasedLabel,
            validityLabel: content.book.validityLabel
        )
        state = .loaded(refilled)
    }

    /// "Buy stamps" / "Get book" (empty state). Stub: acquires the
    /// starter book and flips to the populated wallet — no purchase flow.
    public func purchaseStarterBook() {
        state = .loaded(seededContent ?? StampsSampleData.populated)
    }

    // MARK: - Collection (GET /p3/stamps)

    public func fetchCollection() async {
        collection = .loading
        do {
            let response: MailboxStampsResponse = try await api.request(
                MailboxStampsEndpoints.stamps()
            )
            let content = Self.projectCollection(response)
            collection = content.earned.isEmpty && content.locked.isEmpty
                ? .empty
                : .loaded(content)
        } catch {
            collection = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "We couldn't load your stamp collection."
            )
        }
    }

    static func projectCollection(_ response: MailboxStampsResponse) -> StampCollectionContent {
        StampCollectionContent(
            earned: response.earned.map { row in
                CollectedStamp(
                    id: row.id,
                    name: row.name ?? row.stampType ?? "Stamp",
                    detail: nonEmpty(row.description),
                    rarity: StampRarity.fromRaw(row.rarity),
                    earnedLabel: earnedLabel(row.earnedAt),
                    isLocked: false
                )
            },
            locked: response.locked.map { row in
                CollectedStamp(
                    id: row.stampType,
                    name: row.name ?? row.stampType,
                    detail: nonEmpty(row.description),
                    rarity: StampRarity.fromRaw(row.rarity),
                    earnedLabel: nil,
                    isLocked: true
                )
            },
            totalEarned: response.totalEarned,
            totalAvailable: response.totalAvailable
        )
    }

    /// "Earned May 4, 2026" from an ISO-8601 `earned_at`.
    static func earnedLabel(_ iso: String?) -> String? {
        guard let iso, !iso.isEmpty else { return nil }
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else {
            return nil
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d, yyyy"
        return "Earned \(formatter.string(from: date))"
    }

    // MARK: - Themes (GET /p3/themes · POST /p3/themes/apply)

    public func fetchThemes() async {
        themes = .loading
        do {
            let response: SeasonalThemesResponse = try await api.request(
                MailboxStampsEndpoints.themes()
            )
            let content = Self.projectThemes(response)
            themes = content.themes.isEmpty ? .empty : .loaded(content)
        } catch {
            themes = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "We couldn't load your mailbox themes."
            )
        }
    }

    static func projectThemes(_ response: SeasonalThemesResponse) -> StampThemesContent {
        StampThemesContent(
            themes: response.themes.map { row in
                MailboxTheme(
                    id: row.id,
                    name: nonEmpty(row.name) ?? "Theme",
                    season: MailboxThemeSeason.fromRaw(row.season),
                    isUnlocked: row.unlocked ?? false,
                    autoApplies: nonEmpty(row.activeFrom) != nil
                )
            },
            activeThemeId: nonEmpty(response.active)
        )
    }

    /// Apply an unlocked theme. Optimistic — swaps the active id locally
    /// and rolls back when the write fails. Mirrors RN
    /// `handleApplyTheme` (`src/app/mailbox/stamps.tsx:69-79`).
    public func applyTheme(id: String) async {
        guard case let .loaded(content) = themes,
              let theme = content.themes.first(where: { $0.id == id }),
              theme.isUnlocked,
              applyingThemeId == nil else { return }
        applyingThemeId = id
        defer { applyingThemeId = nil }
        let previous = content
        themes = .loaded(StampThemesContent(themes: content.themes, activeThemeId: id))
        do {
            let _: ApplyMailboxThemeResponse = try await api.request(
                MailboxStampsEndpoints.applyTheme(themeId: id)
            )
            toast = "\(theme.name) applied"
        } catch {
            themes = .loaded(previous)
            toast = (error as? APIError)?.errorDescription ?? "Could not apply theme"
        }
    }

    // MARK: - Helpers

    static func nonEmpty(_ value: String?) -> String? {
        guard let value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return nil
        }
        return value
    }
}
