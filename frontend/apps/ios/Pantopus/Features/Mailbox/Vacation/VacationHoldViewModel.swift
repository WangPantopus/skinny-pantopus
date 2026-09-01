//
//  VacationHoldViewModel.swift
//  Pantopus
//
//  A14.8 — Vacation Hold view-model. Drives both the `scheduling`
//  (compose a hold) and `active` (in-flight hold) variants from a
//  single mode enum, wired to the live Phase-3 routes:
//
//    · `GET  /api/mailbox/v2/p3/vacation/status`  → `load()`
//    · `POST /api/mailbox/v2/p3/vacation/start`   → Save
//    · `POST /api/mailbox/v2/p3/vacation/cancel`  → End hold early
//
//  Mirrors Android `ui/screens/mailbox/vacation/VacationHoldViewModel.kt`
//  (same repository calls, same mode machine, same error handling).
//
//  The production seam is `init(api:…)`. `init(seed:…)` is the preview /
//  test seam: it holds no API client, so `load()` / `tapTrailingAction()`
//  keep the deterministic local behaviour the existing unit + snapshot
//  tests assert (mirrors Android's `internal constructor(seed)`).
//

// swiftlint:disable type_body_length

import Foundation
import Observation
import SwiftUI

/// Initial seed for the preview / test seam. Production callers use
/// `init(api:…)`, whose `load()` resolves the real mode from
/// `/vacation/status`.
public enum VacationHoldSeed: Sendable, Hashable {
    case scheduling
    case active
}

@Observable
@MainActor
public final class VacationHoldViewModel {
    public private(set) var mode: VacationHoldMode
    /// Save / End-hold mutation in-flight; the top bar + destructive row
    /// disable while it runs.
    public private(set) var mutationInFlight: Bool = false
    /// Transient banner; the view clears it after display.
    public var toast: String?

    /// `nil` in the preview / test seam — that path flips `mode` locally.
    private let api: APIClient?

    private let onBack: @MainActor () -> Void
    private let onEditForwarding: @MainActor () -> Void
    private let onEditEmergency: @MainActor () -> Void
    private let onPickFromDate: @MainActor () -> Void
    private let onPickToDate: @MainActor () -> Void

    /// Id of the live hold (from `/vacation/status` or `/vacation/start`)
    /// — needed to cancel.
    private var activeHoldId: String?
    /// Wire row backing the active hold, so Edit can seed the composer
    /// from it rather than from a stale default.
    private var activeHoldDTO: VacationHoldDTO?
    /// Id of the hold the composer is currently editing. The backend has
    /// no update route (`/vacation/start` always inserts), so saving an
    /// edit cancels this hold first — otherwise Save would leave two
    /// overlapping holds on the same home.
    private var editingHoldId: String?

    /// Production seam. `APIClient` is internal, so this initialiser is
    /// internal too (see `MembersListViewModel.swift:204`).
    init(
        api: APIClient = .shared,
        onBack: @escaping @MainActor () -> Void = {},
        onEditForwarding: @escaping @MainActor () -> Void = {},
        onEditEmergency: @escaping @MainActor () -> Void = {},
        onPickFromDate: @escaping @MainActor () -> Void = {},
        onPickToDate: @escaping @MainActor () -> Void = {}
    ) {
        self.api = api
        mode = .scheduling(VacationScheduleDraft.liveDefault())
        self.onBack = onBack
        self.onEditForwarding = onEditForwarding
        self.onEditEmergency = onEditEmergency
        self.onPickFromDate = onPickFromDate
        self.onPickToDate = onPickToDate
    }

    /// Preview / test seam — no network. `seed` is deliberately
    /// non-defaulted so `VacationHoldViewModel { pop() }` unambiguously
    /// resolves to the production initialiser.
    public init(
        seed: VacationHoldSeed,
        onBack: @escaping @MainActor () -> Void = {},
        onEditForwarding: @escaping @MainActor () -> Void = {},
        onEditEmergency: @escaping @MainActor () -> Void = {},
        onPickFromDate: @escaping @MainActor () -> Void = {},
        onPickToDate: @escaping @MainActor () -> Void = {}
    ) {
        api = nil
        switch seed {
        case .scheduling:
            mode = .scheduling(VacationHoldSampleData.schedulingDraft)
        case .active:
            mode = .active(VacationHoldSampleData.activeHold)
        }
        self.onBack = onBack
        self.onEditForwarding = onEditForwarding
        self.onEditEmergency = onEditEmergency
        self.onPickFromDate = onPickFromDate
        self.onPickToDate = onPickToDate
    }

    // MARK: - Lifecycle

    /// Fetch the current hold. An `active` hold renders the Active
    /// variant; otherwise the scheduling composer. A14.8 has no dedicated
    /// error frame, so a transport failure falls back to the composer
    /// (with a toast) rather than blanking the screen — same as Android.
    public func load() async {
        guard let api else { return }
        do {
            let response: VacationStatusResponse = try await api.request(
                MailboxP3Endpoints.vacationStatus()
            )
            if let active = response.active {
                activeHoldId = active.id
                activeHoldDTO = active
                editingHoldId = nil
                mode = .active(Self.activeHold(from: active))
            } else {
                activeHoldId = nil
                activeHoldDTO = nil
                editingHoldId = nil
                mode = .scheduling(VacationScheduleDraft.liveDefault())
            }
        } catch {
            mode = .scheduling(VacationScheduleDraft.liveDefault())
            toast = (error as? APIError)?.errorDescription ?? "Couldn't load your hold."
        }
    }

    public func refresh() async {
        await load()
    }

    // MARK: - Trailing-action labels

    /// Top-bar trailing label. `Save` in scheduling, `Edit` in active
    /// (ending the hold moved to the destructive bottom row).
    public var trailingActionLabel: String {
        switch mode {
        case .scheduling: "Save"
        case .active: "Edit"
        }
    }

    /// Scheduling mode disables Save when the draft is invalid. Active
    /// mode always renders the Edit button enabled so the user can
    /// adjust the hold at any time.
    public var trailingActionEnabled: Bool {
        guard !mutationInFlight else { return false }
        switch mode {
        case let .scheduling(draft): return draft.isValid
        case .active: return true
        }
    }

    /// `primary600` in scheduling for the Save CTA; muted fg3 tone in
    /// the active variant for Edit, per the JSX active frame.
    public var trailingActionTint: Color {
        switch mode {
        case .scheduling: trailingActionEnabled ? Theme.Color.primary600 : Theme.Color.appTextMuted
        case .active: Theme.Color.appTextSecondary
        }
    }

    // MARK: - View intents

    public func tapBack() {
        onBack()
    }

    public func tapTrailingAction() async {
        guard api != nil else {
            // Preview / test seam — flip locally so QA + snapshots still
            // validate the "Save flips chrome" / "Edit returns to form"
            // handoff.
            switch mode {
            case .scheduling: mode = .active(VacationHoldSampleData.activeHold)
            case .active: mode = .scheduling(VacationHoldSampleData.schedulingDraft)
            }
            return
        }
        switch mode {
        case let .scheduling(draft):
            await startHold(draft)
        case .active:
            // Edit returns to the scheduling form (the only edit state the
            // screen has today), seeded from the *live* hold — dropping
            // back to a blank default would silently rewrite the user's
            // real dates. Ending the hold is `endHoldEarly`.
            editingHoldId = activeHoldId
            mode = .scheduling(Self.draftForEdit(activeHoldDTO))
        }
    }

    /// A14.8 — destructive "End hold early" row at the bottom of the
    /// active body. Cancels the live hold (or flips locally in preview).
    public func endHoldEarly() async {
        guard case .active = mode else { return }
        guard api != nil else {
            mode = .scheduling(VacationHoldSampleData.schedulingDraft)
            return
        }
        await cancelHold()
    }

    public func tapFromDate() {
        onPickFromDate()
    }

    public func tapToDate() {
        onPickToDate()
    }

    public func tapForwarding() {
        onEditForwarding()
    }

    public func tapEmergency() {
        onEditEmergency()
    }

    /// Toggle a scope row in the scheduling variant. Locked rows are
    /// ignored (civic notices stay locked on `.always-on`).
    public func toggleScope(_ kind: VacationHoldScope.Kind, isOn: Bool) {
        guard case var .scheduling(draft) = mode else { return }
        draft.scopes = draft.scopes.map { scope in
            guard scope.kind == kind, !scope.isLocked else { return scope }
            return VacationHoldScope(
                kind: scope.kind,
                label: scope.label,
                sub: scope.sub,
                isOn: isOn,
                isLocked: scope.isLocked
            )
        }
        mode = .scheduling(draft)
    }

    /// Toggle forwarding on/off.
    public func toggleForwarding(_ isOn: Bool) {
        guard case var .scheduling(draft) = mode else { return }
        draft.forwardingEnabled = isOn
        mode = .scheduling(draft)
    }

    /// Replace the `fromDate` (callable from a date-picker sheet host).
    /// Clamps `toDate` so the span stays at least 1 day.
    public func setFromDate(_ newValue: Date) {
        guard case var .scheduling(draft) = mode else { return }
        draft.fromDate = newValue
        if draft.toDate < newValue {
            draft.toDate = newValue
        }
        mode = .scheduling(draft)
    }

    /// Replace the `toDate`. Clamps to `fromDate` if a user picks a date
    /// earlier than the start.
    public func setToDate(_ newValue: Date) {
        guard case var .scheduling(draft) = mode else { return }
        draft.toDate = max(newValue, draft.fromDate)
        mode = .scheduling(draft)
    }

    // MARK: - Network mutations

    private func startHold(_ draft: VacationScheduleDraft) async {
        guard let api, !mutationInFlight else { return }
        mutationInFlight = true
        defer { mutationInFlight = false }

        guard let homeId = await resolveHomeId() else {
            toast = "Add a home before scheduling a hold."
            return
        }

        // Editing an existing hold: there is no update route, so retire
        // the old row first. Bail out if that fails rather than leaving
        // two overlapping holds on the same home.
        if let editingHoldId {
            do {
                let _: CancelVacationResponse = try await api.request(
                    MailboxP3Endpoints.cancelVacation(holdId: editingHoldId)
                )
            } catch {
                toast = (error as? APIError)?.errorDescription ?? "Couldn't update your hold."
                return
            }
            self.editingHoldId = nil
            activeHoldId = nil
            activeHoldDTO = nil
        }

        // The composer collects scopes / forwarding, not the backend's
        // hold / package enums — derive the closest action from forwarding.
        let request = StartVacationRequest(
            homeId: homeId,
            startDate: Self.isoDay(draft.fromDate),
            endDate: Self.isoDay(draft.toDate),
            holdAction: draft.forwardingEnabled ? Self.forwardToHousehold : "hold_in_vault",
            packageAction: "hold_at_carrier",
            autoNeighborRequest: false
        )
        do {
            let response: StartVacationResponse = try await api.request(
                MailboxP3Endpoints.startVacation(request)
            )
            activeHoldId = response.hold.id
            activeHoldDTO = response.hold
            mode = .active(Self.activeHold(from: response.hold))
            toast = "Hold scheduled"
        } catch {
            // Keep the composer; the CTA can be retried.
            toast = (error as? APIError)?.errorDescription ?? "Couldn't schedule your hold."
        }
    }

    private func cancelHold() async {
        guard let api, let holdId = activeHoldId, !mutationInFlight else { return }
        mutationInFlight = true
        defer { mutationInFlight = false }
        do {
            let _: CancelVacationResponse = try await api.request(
                MailboxP3Endpoints.cancelVacation(holdId: holdId)
            )
            activeHoldId = nil
            activeHoldDTO = nil
            editingHoldId = nil
            mode = .scheduling(VacationScheduleDraft.liveDefault())
            toast = "Hold ended"
        } catch {
            // Keep the active hold visible.
            toast = (error as? APIError)?.errorDescription ?? "Couldn't end your hold."
        }
    }

    /// `/vacation/start` needs a `homeId`; RN and Android both take the
    /// caller's first home (`api.homes.getHomes()[0]` /
    /// `homesRepo.myHomes().homes.first`).
    private func resolveHomeId() async -> String? {
        guard let api else { return nil }
        do {
            let response: MyHomesResponse = try await api.request(HomesEndpoints.myHomes())
            return response.homes.first?.id
        } catch {
            return nil
        }
    }

    // MARK: - Projection

    /// Backend `hold_action` value for "forward urgent mail to the household".
    private static let forwardToHousehold = "forward_to_household"

    /// Seed the composer from the live hold. The rich scope / forwarding /
    /// emergency fields have no backend source, so they keep the live
    /// defaults; the dates and the forwarding switch come from the wire row.
    static func draftForEdit(_ hold: VacationHoldDTO?) -> VacationScheduleDraft {
        var base = VacationScheduleDraft.liveDefault()
        guard let hold else { return base }
        if let from = parseDay(hold.startDate) {
            base.fromDate = from
            base.toDate = max(base.toDate, from)
        }
        if let to = parseDay(hold.endDate) {
            base.toDate = max(to, base.fromDate)
        }
        base.forwardingEnabled = hold.holdAction == forwardToHousehold
        return base
    }

    /// Project a wire `VacationHold` into the Active-variant content. The
    /// backend row is sparse (a single held-item count, no per-type ledger
    /// / emergency contact), so those slots stay minimal — real holds
    /// render simpler than the design fixture, which is expected.
    static func activeHold(
        from hold: VacationHoldDTO,
        today: Date = Date()
    ) -> VacationActiveHold {
        let end = parseDay(hold.endDate)
        let start = parseDay(hold.startDate)
        let daysLeft = end.map { max(0, Self.dayCount(from: today, to: $0)) } ?? 0
        let untilLabel = end.map(shortDayLabel(_:)) ?? (hold.endDate ?? "")
        let heldCount = hold.itemsHeldCount ?? 0
        let heldItems: [VacationHeldItem] = heldCount > 0
            ? [
                VacationHeldItem(
                    icon: .mail,
                    label: "Held items",
                    sub: "Holding until you return",
                    count: heldCount
                )
            ]
            : []
        let forwarding: VacationForwardingTarget? = hold.holdAction == forwardToHousehold
            ? VacationForwardingTarget(
                title: "Forwarding urgent mail",
                sub: "To your household address"
            )
            : nil
        return VacationActiveHold(
            daysLeft: daysLeft,
            untilLabel: untilLabel,
            resumeBlurb: untilLabel.isEmpty
                ? "Everything held resumes delivery when your hold ends."
                : "Everything held resumes delivery the morning of \(untilLabel).",
            stats: [VacationHoldStat(id: "items", count: heldCount, label: "Items held")],
            heldItems: heldItems,
            forwarding: forwarding,
            emergency: nil,
            activeSinceLabel: start.map { "Active since \(shortDayLabel($0))" } ?? "Active"
        )
    }

    // MARK: - Date helpers

    /// UTC gregorian calendar — matches `VacationScheduleDraft.spanDays`
    /// so a draft round-trips through the wire without drifting a day.
    private static var dayCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .current
        return calendar
    }

    /// `2026-06-09` (or the day part of a full ISO timestamp) → `Date`.
    static func parseDay(_ value: String?) -> Date? {
        guard let value, !value.isEmpty else { return nil }
        let day = value.split(separator: "T").first.map(String.init) ?? value
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var comps = DateComponents()
        comps.year = parts[0]
        comps.month = parts[1]
        comps.day = parts[2]
        return dayCalendar.date(from: comps)
    }

    /// `Date` → `yyyy-MM-dd`, the shape `startVacationSchema` expects.
    static func isoDay(_ date: Date) -> String {
        let comps = dayCalendar.dateComponents([.year, .month, .day], from: date)
        return String(
            format: "%04d-%02d-%02d",
            comps.year ?? 0,
            comps.month ?? 0,
            comps.day ?? 0
        )
    }

    private static func shortDayLabel(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC") ?? .current
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    private static func dayCount(from: Date, to: Date) -> Int {
        let calendar = dayCalendar
        let start = calendar.startOfDay(for: from)
        let end = calendar.startOfDay(for: to)
        return calendar.dateComponents([.day], from: start, to: end).day ?? 0
    }
}
