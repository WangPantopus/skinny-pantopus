//
//  CancellationPolicyEditorViewModel.swift
//  Pantopus
//
//  G14 Cancellation & Refund Policy editor (Stream I14). Preset picker
//  (Flexible / Moderate / Strict / Custom) with inline custom rows, a live
//  "what the invitee sees" preview, and a Save that round-trips:
//   • page-level (eventTypeId == nil) → `PUT /booking-page` `cancellation_policy`
//     (a preset string, or a structured object for Custom).
//   • per-service (eventTypeId != nil) → `PUT /event-types/:id`
//     `cancellation_window_min` / `reschedule_cutoff_min` / `refund_policy` /
//     `no_show_fee_cents` / `deposit_refundable`.
//  Reuses the Foundation `CancellationPolicyDisplay` for the preview sentence.
//  Gated behind `SchedulingFeatureFlags.paidEnabled`. Matches `policy-sheet-frames`.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class CancellationPolicyEditorViewModel {
    enum Phase: Equatable { case loading, loaded, error(String) }

    enum Preset: String, CaseIterable, Equatable {
        case flexible = "Flexible"
        case moderate = "Moderate"
        case strict = "Strict"
        case custom = "Custom"

        var summary: String {
            switch self {
            case .flexible: "Full refund up to 24h before"
            case .moderate: "50% refund up to 48h before"
            case .strict: "No refund after booking"
            case .custom: "Set your own rules"
            }
        }
    }

    /// How a no-show is charged. Page-level stores the raw string; per-service
    /// maps it to `no_show_fee_cents`.
    enum NoShowMode: String, CaseIterable, Equatable {
        case chargeFull = "charge_full"
        case chargeDeposit = "charge_deposit"
        case noCharge = "no_charge"

        var label: String {
            switch self {
            case .chargeFull: "Charge full price"
            case .chargeDeposit: "Charge the deposit"
            case .noCharge: "No charge"
            }
        }
    }

    // MARK: Inputs

    let owner: SchedulingOwner
    let eventTypeId: String?
    let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    // MARK: State

    private(set) var phase: Phase = .loading
    var selectedPreset: Preset = .flexible
    var customCutoffHours = 24
    var customRefundPct = 50
    var depositNonRefundable = true
    var noShowMode: NoShowMode = .chargeFull
    private(set) var saving = false
    private(set) var didSave = false
    private(set) var saveError: String?

    /// Captured for the per-service no-show-fee mapping.
    private var priceCents = 0
    private var depositCents = 0

    // MARK: Derived

    var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var accent: Color {
        theme.accent
    }

    var accentBg: Color {
        theme.accentBg
    }

    var isCustom: Bool {
        selectedPreset == .custom
    }

    /// The cutoff ladder the stepper walks (hours).
    static let cutoffLadder = [0, 1, 2, 4, 6, 12, 24, 48, 72]

    var canDecrementCutoff: Bool {
        customCutoffHours > (Self.cutoffLadder.first ?? 0)
    }

    var canIncrementCutoff: Bool {
        customCutoffHours < (Self.cutoffLadder.last ?? 0)
    }

    var canDecrementRefund: Bool {
        customRefundPct > 0
    }

    var canIncrementRefund: Bool {
        customRefundPct < 100
    }

    /// The plain-language sentence shown to invitees (frame preview).
    var previewText: String {
        switch selectedPreset {
        case .flexible: "Free cancellation up to 24 hours before. After that, no refund."
        case .moderate: "50% refund up to 48 hours before. After that, no refund."
        case .strict: "No refund once the booking is confirmed."
        case .custom: customPreviewText
        }
    }

    private var customPreviewText: String {
        var parts: [String] = []
        if customCutoffHours > 0 {
            parts.append("\(Self.hoursLabel(customCutoffHours)) before: full refund.")
            parts.append(customRefundPct > 0
                ? "After that: \(customRefundPct)% refund."
                : "After that: no refund.")
        } else {
            parts.append(customRefundPct > 0
                ? "\(customRefundPct)% refund anytime."
                : "No refund once confirmed.")
        }
        if depositNonRefundable { parts.append("Deposit is non-refundable.") }
        return parts.joined(separator: " ")
    }

    var footnote: String {
        selectedPreset == .flexible
            ? "Flexible is the friendliest — most people start here."
            : "Invitees see this wording before they pay."
    }

    init(
        owner: SchedulingOwner,
        eventTypeId: String?,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.owner = owner
        self.eventTypeId = eventTypeId
        self.push = push
        self.client = client
    }

    // MARK: Lifecycle

    func load() async {
        phase = .loading
        do {
            if let eventTypeId {
                let detail: EventTypeDetailResponse = try await client.request(
                    SchedulingEndpoints.getEventType(owner: owner, id: eventTypeId)
                )
                applyEventType(detail.eventType)
            } else {
                let result: BookingPageResponse = try await client.request(
                    SchedulingEndpoints.getBookingPage(owner: owner)
                )
                applyPagePolicy(result.page.cancellationPolicy)
            }
            phase = .loaded
        } catch let error as SchedulingError {
            phase = .error(error.userMessage ?? "Couldn't load the cancellation policy.")
        } catch {
            phase = .error("Couldn't load the cancellation policy.")
        }
    }

    func refresh() async {
        await load()
    }

    // MARK: Selection

    func select(_ preset: Preset) {
        selectedPreset = preset
        switch preset {
        case .flexible: customCutoffHours = 24
            customRefundPct = 0
        case .moderate: customCutoffHours = 48
            customRefundPct = 50
        case .strict: customCutoffHours = 0
            customRefundPct = 0
        case .custom: break // keep current custom values
        }
    }

    func decrementCutoff() {
        guard let idx = Self.cutoffLadder.firstIndex(of: customCutoffHours), idx > 0 else {
            customCutoffHours = Self.cutoffLadder.last { $0 < customCutoffHours } ?? 0
            return
        }
        customCutoffHours = Self.cutoffLadder[idx - 1]
    }

    func incrementCutoff() {
        guard let idx = Self.cutoffLadder.firstIndex(of: customCutoffHours), idx < Self.cutoffLadder.count - 1 else {
            customCutoffHours = Self.cutoffLadder.first { $0 > customCutoffHours } ?? Self.cutoffLadder.last ?? customCutoffHours
            return
        }
        customCutoffHours = Self.cutoffLadder[idx + 1]
    }

    func decrementRefund() {
        customRefundPct = max(0, customRefundPct - 5)
    }

    func incrementRefund() {
        customRefundPct = min(100, customRefundPct + 5)
    }

    func cycleNoShow() {
        let all = NoShowMode.allCases
        let idx = all.firstIndex(of: noShowMode) ?? 0
        noShowMode = all[(idx + 1) % all.count]
    }

    // MARK: Save

    func save() async {
        guard !saving else { return }
        saving = true
        defer { saving = false }
        saveError = nil
        do {
            if let eventTypeId {
                _ = try await client.request(
                    SchedulingEndpoints.updateEventType(owner: owner, id: eventTypeId, eventTypeUpdate()),
                    as: EventTypeResponse.self
                )
            } else {
                _ = try await client.request(
                    SchedulingEndpoints.updateBookingPage(owner: owner, BookingPageUpdateRequest(cancellationPolicy: pagePolicyValue())),
                    as: BookingPageResponse.self
                )
            }
            didSave = true
        } catch let error as SchedulingError {
            saveError = error.userMessage ?? "Couldn't save the policy."
        } catch {
            saveError = "Couldn't save the policy."
        }
    }

    func clearSaveError() {
        saveError = nil
    }

    // MARK: Page-level encoding (cancellation_policy free-form)

    func pagePolicyValue() -> JSONValue {
        switch selectedPreset {
        case .flexible, .moderate, .strict:
            .string(selectedPreset.rawValue)
        case .custom:
            .object([
                "preset": .string("custom"),
                "free_cancel_window_min": .number(Double(customCutoffHours * 60)),
                "refund_after_pct": .number(Double(customRefundPct)),
                "deposit_non_refundable": .bool(depositNonRefundable),
                "no_show": .string(noShowMode.rawValue)
            ])
        }
    }

    // MARK: Per-service encoding (event-type fields)

    func eventTypeUpdate() -> UpdateEventTypeRequest {
        let windowMin = customCutoffHours * 60
        return UpdateEventTypeRequest(
            depositRefundable: !depositNonRefundable,
            cancellationWindowMin: windowMin,
            rescheduleCutoffMin: windowMin,
            noShowFeeCents: noShowFeeCents,
            refundPolicy: refundPolicyValue
        )
    }

    /// Map the editor state onto the backend `refund_policy` enum.
    var refundPolicyValue: String {
        switch selectedPreset {
        case .flexible: return "full"
        case .moderate: return "partial"
        case .strict: return "none"
        case .custom:
            if depositNonRefundable, customRefundPct > 0 { return "deposit_only" }
            if customRefundPct >= 100 { return "full" }
            if customRefundPct == 0 { return "none" }
            return "partial"
        }
    }

    private var noShowFeeCents: Int {
        switch noShowMode {
        case .chargeFull: priceCents
        case .chargeDeposit: depositCents
        case .noCharge: 0
        }
    }

    // MARK: Loading projections

    private func applyEventType(_ et: EventTypeDTO) {
        priceCents = et.priceCents ?? 0
        depositCents = et.depositCents ?? 0
        let window = et.cancellationWindowMin ?? 0
        let policy = et.refundPolicy ?? "full"
        depositNonRefundable = (et.depositRefundable == false) || policy == "deposit_only"
        customCutoffHours = window / 60
        switch (policy, window) {
        case ("full", 1440): selectedPreset = .flexible
            customRefundPct = 0
        case ("partial", 2880): selectedPreset = .moderate
            customRefundPct = 50
        case ("none", _): selectedPreset = .strict
            customRefundPct = 0
        default:
            selectedPreset = .custom
            customRefundPct = Self.refundPct(for: policy)
        }
        // Derive no-show mode from the stored fee.
        let fee = et.noShowFeeCents ?? 0
        if fee == 0 { noShowMode = .noCharge } else if fee == depositCents,
                                                       depositCents > 0 { noShowMode = .chargeDeposit } else { noShowMode = .chargeFull }
    }

    private func applyPagePolicy(_ value: JSONValue?) {
        guard let value else { selectedPreset = .flexible
            return
        }
        if let raw = value.stringValue, let preset = Preset(rawValue: raw) {
            select(preset)
            return
        }
        if let dict = value.dictValue {
            selectedPreset = .custom
            if let mins = dict["free_cancel_window_min"]?.numberValue { customCutoffHours = Int(mins) / 60 }
            if let pct = dict["refund_after_pct"]?.numberValue { customRefundPct = Int(pct) }
            depositNonRefundable = dict["deposit_non_refundable"]?.boolValue ?? true
            if let raw = dict["no_show"]?.stringValue, let mode = NoShowMode(rawValue: raw) { noShowMode = mode }
            return
        }
        selectedPreset = .flexible
    }

    // MARK: Helpers

    static func refundPct(for policy: String) -> Int {
        switch policy {
        case "full": 100
        case "partial": 50
        default: 0
        }
    }

    static func hoursLabel(_ hours: Int) -> String {
        switch hours {
        case let h where h % 24 == 0 && h > 0: "\(h / 24) day\(h / 24 == 1 ? "" : "s")"
        default: "\(hours) hour\(hours == 1 ? "" : "s")"
        }
    }
}
