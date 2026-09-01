//
//  MailDayViewModel.swift
//  Pantopus
//
//  A13.16 — Backs the My Mail Day editor. Two variants seeded by the
//  caller:
//
//    `.populated` — mid-afternoon triage. The latest reviewed row pulses
//      a 5-second undo countdown; `tickUndo()` (driven by `MailDayView`)
//      decrements the seconds and clears the chip when it hits 0.
//    `.empty` — no scans yet today; the hero + recap + setup-nudges
//      render off the same `MailDayContent`.
//
//  P3F wiring: `load()` reads the live day frame from
//  `GET /api/mailbox/v2/mailday/today` and maps it into `MailDayContent`.
//  `acceptSuggestion` optimistically moves a piece to the reviewed rail
//  and POSTs `/items/:id/route` (rolling back on failure); `finishDay`
//  POSTs `/finish` and reflects the bumped streak. The fixture
//  (`MailDaySampleData`, keyed by `variant`) is the offline / preview /
//  test fallback when the fetch can't complete.
//

// swiftlint:disable type_body_length

import Foundation
import Observation

public enum MailDayVariant: String, Sendable, Hashable {
    case populated
    case empty
}

@Observable
@MainActor
public final class MailDayViewModel {
    public private(set) var state: MailDayState = .loading

    public var variant: MailDayVariant
    private let seededContent: MailDayContent?
    private let onScanRequested: @MainActor () -> Void
    private let api: APIClient

    /// - Parameters:
    ///   - variant: Which fixture to fall back to when the fetch can't
    ///     complete (offline / previews / tests). Defaults to `.populated`.
    ///   - content: Optional seed (tests / previews) overriding the
    ///     sample fixture for this variant.
    ///   - onScanRequested: Invoked when the user taps any Scan CTA
    ///     (top scan-more card or empty-hero primary). Out of scope to
    ///     wire to the real scanner here — the host hands a closure.
    public convenience init(
        variant: MailDayVariant = .populated,
        content: MailDayContent? = nil,
        onScanRequested: @escaping @MainActor () -> Void = {}
    ) {
        self.init(
            variant: variant,
            api: .shared,
            content: content,
            onScanRequested: onScanRequested
        )
    }

    /// Test/internal initializer with injectable networking.
    init(
        variant: MailDayVariant = .populated,
        api: APIClient,
        content: MailDayContent? = nil,
        onScanRequested: @escaping @MainActor () -> Void = {}
    ) {
        self.variant = variant
        self.api = api
        seededContent = content
        self.onScanRequested = onScanRequested
    }

    // MARK: - Lifecycle

    public func load() async {
        state = .loading
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    private func fetch() async {
        do {
            let response: MailDayTodayResponse = try await api.request(MailDayEndpoints.today())
            let content = Self.content(from: response)
            // A day with any piece (reviewed or unreviewed) stays populated
            // so the reviewed rail + finish bar show; only a day with no
            // pieces at all falls to the empty hero.
            state = (content.unreviewed.isEmpty && content.reviewed.isEmpty)
                ? .empty(content)
                : .populated(content)
        } catch {
            // Offline / preview / tests without a stub fall back to the
            // fixture for this variant so the screen still renders.
            state = projectedState()
        }
    }

    private func projectedState() -> MailDayState {
        switch variant {
        case .populated:
            .populated(seededContent ?? MailDaySampleData.populated)
        case .empty:
            .empty(seededContent ?? MailDaySampleData.empty)
        }
    }

    // MARK: - Settings sub-view (A13.16 · gear from the day header)

    /// `true` while the settings frame is on screen instead of the triage
    /// body. RN swaps the whole view the same way
    /// (`src/app/mailbox/mailday.tsx:77`).
    public private(set) var isShowingSettings = false
    /// `GET /api/mailbox/v2/p3/mailday/settings` projection.
    public private(set) var settings: MailDaySettingsState = .loading
    /// A PATCH is in flight — the header shows a saving indicator.
    public private(set) var settingsSaving = false
    /// Transient banner shown when a PATCH fails.
    public var settingsToast: String?

    /// Open the settings frame and fetch the row on first entry.
    public func openSettings() async {
        isShowingSettings = true
        if case .loaded = settings { return }
        await loadSettings()
    }

    public func closeSettings() {
        isShowingSettings = false
    }

    public func consumeSettingsToast() {
        settingsToast = nil
    }

    public func loadSettings() async {
        settings = .loading
        do {
            let dto: MailDaySettingsDTO = try await api.request(MailDaySettingsEndpoints.settings())
            settings = .loaded(MailDaySettingsForm(dto: dto))
        } catch {
            settings = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "We couldn't load your Mail Day settings."
            )
        }
    }

    /// Flip one switch. Optimistic — the UI moves immediately, then a
    /// single-key PATCH persists it and rolls back on failure. Mirrors RN
    /// `updateSetting` (`src/app/mailbox/mailday.tsx:52-64`).
    public func setSetting(_ key: MailDaySettingKey, to value: Bool) async {
        guard case let .loaded(form) = settings, !settingsSaving else { return }
        var optimistic = form
        optimistic.set(key, to: value)
        settings = .loaded(optimistic)
        settingsSaving = true
        defer { settingsSaving = false }
        do {
            let _: MailDaySettingsPatchResponse = try await api.request(
                MailDaySettingsEndpoints.updateSettings(key.patch(value))
            )
        } catch {
            settings = .loaded(form)
            settingsToast = (error as? APIError)?.errorDescription ?? "Failed to save setting"
        }
    }

    /// Pick a notification sound. Same optimistic + rollback shape.
    public func setSoundType(_ sound: MailDaySoundType) async {
        guard case let .loaded(form) = settings, !settingsSaving, form.soundType != sound else { return }
        var optimistic = form
        optimistic.soundType = sound
        settings = .loaded(optimistic)
        settingsSaving = true
        defer { settingsSaving = false }
        var patch = MailDaySettingsPatch()
        patch.soundType = sound.rawValue
        do {
            let _: MailDaySettingsPatchResponse = try await api.request(
                MailDaySettingsEndpoints.updateSettings(patch)
            )
        } catch {
            settings = .loaded(form)
            settingsToast = (error as? APIError)?.errorDescription ?? "Failed to save setting"
        }
    }

    // MARK: - Derived

    /// Total pieces (reviewed + unreviewed) — drives the ProgressRing
    /// denominator + the "Finish day · N pieces" CTA label.
    public var total: Int {
        guard case let .populated(content) = state else { return 0 }
        return content.unreviewed.count + content.reviewed.count
    }

    /// Pieces with a decision (any action) — ProgressRing numerator.
    public var done: Int {
        guard case let .populated(content) = state else { return 0 }
        return content.reviewed.count
    }

    /// Pieces still needing a call. Drives the "Finish day" disabled
    /// state.
    public var remaining: Int {
        guard case let .populated(content) = state else { return 0 }
        return content.unreviewed.count
    }

    /// Routed-only subset for the FinishDay summary line.
    public var routedCount: Int {
        guard case let .populated(content) = state else { return 0 }
        return content.reviewed.filter { $0.action == .routed }.count
    }

    public var junkedCount: Int {
        guard case let .populated(content) = state else { return 0 }
        return content.reviewed.filter { $0.action == .junked }.count
    }

    public var returnedCount: Int {
        guard case let .populated(content) = state else { return 0 }
        return content.reviewed.filter { $0.action == .returned }.count
    }

    /// `true` once every piece has a decision and FinishDay can fire.
    public var canFinishDay: Bool {
        guard case .populated = state else { return false }
        return remaining == 0 && total > 0
    }

    // MARK: - Actions

    /// Out-of-scope per the task — open the scanner flow.
    public func requestScan() {
        onScanRequested()
    }

    /// Decrement the undo countdown on the latest reviewed row. When it
    /// hits 0 the chip clears and the row reads as a normal reviewed
    /// entry. Idempotent on zero / nil.
    public func tickUndo() {
        guard case let .populated(content) = state else { return }
        var updated = content.reviewed
        guard let firstIndex = updated.firstIndex(where: { ($0.undoCountdown ?? 0) > 0 }) else {
            return
        }
        let current = updated[firstIndex]
        let next = (current.undoCountdown ?? 0) - 1
        updated[firstIndex] = ReviewedMailDayItem(
            id: current.id,
            kind: current.kind,
            label: current.label,
            action: current.action,
            routedTo: current.routedTo,
            routedTint: current.routedTint,
            whenLabel: current.whenLabel,
            undoCountdown: next > 0 ? next : nil
        )
        state = .populated(
            MailDayContent(
                dateLabel: content.dateLabel,
                streakDays: content.streakDays,
                lastScanLabel: content.lastScanLabel,
                unreviewed: content.unreviewed,
                reviewed: updated,
                yesterdayRecap: content.yesterdayRecap,
                setupNudges: content.setupNudges
            )
        )
    }

    /// Move an unreviewed piece into the reviewed list as `.routed` — the AI
    /// suggestion is treated as accepted. Optimistic: the move shows
    /// immediately, then `POST /items/:id/route` persists it (the server
    /// derives the same recipient + tint from the stored suggestion). On
    /// failure the prior content is restored.
    public func acceptSuggestion(for itemId: String) async {
        guard case let .populated(content) = state else { return }
        guard let index = content.unreviewed.firstIndex(where: { $0.id == itemId }) else { return }
        let previous = content
        let item = content.unreviewed[index]
        var unreviewed = content.unreviewed
        unreviewed.remove(at: index)
        let firstName = item.suggestedName.split(separator: " ").first.map(String.init) ?? item.suggestedName
        let reviewed = [
            ReviewedMailDayItem(
                id: item.id,
                kind: item.kind,
                label: item.label,
                action: .routed,
                routedTo: firstName,
                routedTint: item.suggestedAvatar == .personalSky ? .personPrimary : .householdHome,
                whenLabel: "just now",
                undoCountdown: 5
            )
        ] + clearedReviewed(content.reviewed)
        state = .populated(
            MailDayContent(
                dateLabel: content.dateLabel,
                streakDays: content.streakDays,
                lastScanLabel: content.lastScanLabel,
                unreviewed: unreviewed,
                reviewed: reviewed,
                yesterdayRecap: content.yesterdayRecap,
                setupNudges: content.setupNudges
            )
        )
        do {
            _ = try await api.request(MailDayEndpoints.route(itemId: itemId))
        } catch {
            state = .populated(previous)
        }
    }

    /// Close out the day: `POST /finish` bumps the streak server-side; the
    /// reviewed day stays on screen with the new streak. No-op unless every
    /// piece has a decision.
    public func finishDay() async {
        guard canFinishDay, case let .populated(content) = state else { return }
        do {
            let response: MailDayFinishResponse = try await api.request(MailDayEndpoints.finish())
            state = .populated(
                MailDayContent(
                    dateLabel: content.dateLabel,
                    streakDays: response.streakDays,
                    lastScanLabel: content.lastScanLabel,
                    unreviewed: content.unreviewed,
                    reviewed: content.reviewed,
                    yesterdayRecap: content.yesterdayRecap,
                    setupNudges: content.setupNudges
                )
            )
        } catch {
            // Leave the day open on failure.
        }
    }

    /// Clear `undoCountdown` from every prior row so only the latest
    /// action shows the pulse — matches the JSX's single-row treatment.
    private func clearedReviewed(_ rows: [ReviewedMailDayItem]) -> [ReviewedMailDayItem] {
        rows.map { row in
            ReviewedMailDayItem(
                id: row.id,
                kind: row.kind,
                label: row.label,
                action: row.action,
                routedTo: row.routedTo,
                routedTint: row.routedTint,
                whenLabel: row.whenLabel,
                undoCountdown: nil
            )
        }
    }

    // MARK: - DTO mapping (wire → render model)

    static func content(from dto: MailDayTodayResponse) -> MailDayContent {
        MailDayContent(
            dateLabel: dto.dateLabel,
            streakDays: dto.streakDays,
            lastScanLabel: dto.lastScanLabel,
            unreviewed: dto.unreviewed.map(mapUnreviewed),
            reviewed: dto.reviewed.map(mapReviewed),
            yesterdayRecap: dto.yesterdayRecap.map(mapRecap),
            setupNudges: dto.setupNudges.map(mapNudge)
        )
    }

    private static func mapKind(_ raw: String) -> MailDayKind {
        MailDayKind(rawValue: raw) ?? .envelope
    }

    private static func mapAvatar(_ raw: String) -> MailDaySuggestedAvatar {
        raw == "household_green" ? .householdGreen : .personalSky
    }

    private static func mapAction(_ raw: String) -> ReviewedMailAction {
        ReviewedMailAction(rawValue: raw) ?? .routed
    }

    private static func mapRoutedTint(_ raw: String?) -> MailDayRoutedTint? {
        guard let raw else { return nil }
        return raw == "household_home" ? .householdHome : .personPrimary
    }

    private static func mapSegmentTint(_ raw: String) -> YesterdayRecap.SegmentTint {
        switch raw {
        case "household": .household
        case "junked": .junked
        case "returned": .returned
        default: .personPrimary
        }
    }

    private static func mapUnreviewed(_ dto: MailDayUnreviewedDTO) -> UnreviewedMailDayItem {
        UnreviewedMailDayItem(
            id: dto.id,
            kind: mapKind(dto.kind),
            label: dto.label,
            sender: dto.sender,
            suggestedName: dto.suggestedName,
            suggestedAvatar: mapAvatar(dto.suggestedAvatar),
            confidencePercent: dto.confidencePercent,
            secondaryLabel: dto.secondaryLabel
        )
    }

    private static func mapReviewed(_ dto: MailDayReviewedDTO) -> ReviewedMailDayItem {
        ReviewedMailDayItem(
            id: dto.id,
            kind: mapKind(dto.kind),
            label: dto.label,
            action: mapAction(dto.action),
            routedTo: dto.routedTo,
            routedTint: mapRoutedTint(dto.routedTint),
            whenLabel: dto.whenLabel,
            undoCountdown: dto.undoCountdown
        )
    }

    private static func mapRecap(_ dto: MailDayRecapDTO) -> YesterdayRecap {
        YesterdayRecap(
            dateLabel: dto.dateLabel,
            pieces: dto.pieces,
            closedAtLabel: dto.closedAtLabel,
            segments: dto.segments.map { segment in
                YesterdayRecap.Segment(
                    id: segment.id,
                    percent: segment.percent,
                    label: segment.label,
                    tint: mapSegmentTint(segment.tint)
                )
            }
        )
    }

    private static func mapNudge(_ dto: MailDayNudgeDTO) -> MailDaySetupNudge {
        // The id is stable; the icon + tint are the client's design.
        let icon: PantopusIcon = dto.id == "auto-route" ? .users : .bell
        let tint: MailDaySetupNudge.MailDayNudgeTint = dto.id == "auto-route" ? .home : .primary
        return MailDaySetupNudge(id: dto.id, icon: icon, tint: tint, title: dto.title, subtitle: dto.subtitle)
    }
}
