//
//  SchedulingA11yAudit.swift
//  Pantopus
//
//  H14 Accessibility & Large-Text pass · Stream I18. The accessibility contract
//  for the Calendarly surface, encoded as data so it is testable and reviewable
//  (see SchedulingA11yTests). Each finding records a surface, the requirement it
//  is checked against, whether it passes today, and — when flagged — the
//  follow-up issue to file against the OWNING stream's files (H14 never edits
//  another stream's code; it files follow-ups, preserving disjointness).
//
//  Findings reflect a read of the merged surface on `feature/calendarly`
//  (Foundation SlotPicker/SchedulingSlotRow, I6 confirmed screen, and this
//  stream's H15). The human-readable report lives in SchedulingA11yAudit.md.
//

import Foundation

/// The accessibility requirements every scheduling surface is held to (from the
/// H14 design: the gate that fixes SlotCalendar's fixed-size tiles).
public enum SchedulingA11yRequirement: String, Sendable, CaseIterable {
    case minimumTapTarget
    case fullSlotLabel
    case timezoneAffordance
    case textNotColorOnly
    case dynamicTypeReflow
    case visibleFocusRing
    case reduceMotion
    case accessibilityIdentifier

    /// One-line statement of the requirement.
    public var summary: String {
        switch self {
        case .minimumTapTarget:
            "Interactive controls are ≥44pt, including at the largest Dynamic Type."
        case .fullSlotLabel:
            "Each slot button announces its full label: '<date>, <time>, available/taken'."
        case .timezoneAffordance:
            "Times shown in <tz> is announced as text; host/viewer mismatch is spoken, not color."
        case .textNotColorOnly:
            "Availability, status, and conflicts are conveyed by text/shape, never color alone."
        case .dynamicTypeReflow:
            "Dense slot grids reflow to a single stacked list at accessibility sizes."
        case .visibleFocusRing:
            "Focused controls show a visible focus ring offset from the control."
        case .reduceMotion:
            "Decorative motion (confetti, pulses) is suppressed under Reduce Motion."
        case .accessibilityIdentifier:
            "Every routed screen and key control carries a stable accessibilityIdentifier."
        }
    }
}

/// Whether a checked surface meets the requirement today.
public enum SchedulingA11yStatus: String, Sendable {
    case pass
    case flagged
}

/// One audited (surface × requirement) result.
public struct SchedulingA11yFinding: Sendable, Hashable, Identifiable {
    public let surface: String
    public let requirement: SchedulingA11yRequirement
    public let status: SchedulingA11yStatus
    public let note: String
    /// When flagged, the follow-up to file against the owning stream's files.
    public let followUp: String?

    public var id: String {
        "\(surface)·\(requirement.rawValue)"
    }

    public init(
        surface: String,
        requirement: SchedulingA11yRequirement,
        status: SchedulingA11yStatus,
        note: String,
        followUp: String? = nil
    ) {
        self.surface = surface
        self.requirement = requirement
        self.status = status
        self.note = note
        self.followUp = followUp
    }
}

/// The audit of the merged Calendarly surface.
public enum SchedulingA11yAudit {
    public static let findings: [SchedulingA11yFinding] = [
        // Foundation — SchedulingSlotRow (the reused slot primitive)
        .init(
            surface: "SchedulingSlotRow",
            requirement: .minimumTapTarget,
            status: .pass,
            note: "Row applies frame(minHeight: 44)."
        ),
        .init(
            surface: "SchedulingSlotRow",
            requirement: .fullSlotLabel,
            status: .flagged,
            note: "Label is time-only when detail is nil; the day/date and availability are not announced per slot.",
            followUp: "i18-a11y-slotrow-label"
        ),
        // Foundation — SlotPicker (calendar strip + slot column)
        .init(
            surface: "SlotPicker.calendar",
            requirement: .minimumTapTarget,
            status: .flagged,
            note: "Day cells use a 40pt button height (< 44pt); the selected/today disc is 36pt.",
            followUp: "i18-a11y-slotpicker-daycell-target"
        ),
        .init(
            surface: "SlotPicker.calendar",
            requirement: .textNotColorOnly,
            status: .pass,
            note: "Day cells append ', available'/', unavailable'/', today' to the label; a dot supplements color."
        ),
        .init(
            surface: "SlotPicker.slots",
            requirement: .dynamicTypeReflow,
            status: .pass,
            note: "Slots already render as full-width grouped rows (Morning/Afternoon/Evening), not a fixed grid."
        ),
        .init(
            surface: "SlotPicker.slots",
            requirement: .fullSlotLabel,
            status: .flagged,
            note: "SlotPicker passes detail: nil, so rows announce '3:00 PM' without the selected day or availability.",
            followUp: "i18-a11y-slotpicker-slot-label"
        ),
        .init(
            surface: "SlotPicker.timezone",
            requirement: .timezoneAffordance,
            status: .pass,
            note: "Timezone chip is a labelled button: 'Time zone, <tz>. Tap to change.'"
        ),
        .init(
            surface: "SlotPicker.timezone",
            requirement: .timezoneAffordance,
            status: .flagged,
            note: "Host/viewer timezone mismatch is not spoken in the chip; use SchedulingA11y.timezoneLabel(viewer:host:).",
            followUp: "i18-a11y-timezone-mismatch-vo"
        ),
        // I6 — Booking confirmed
        .init(
            surface: "InviteeConfirmedView",
            requirement: .reduceMotion,
            status: .pass,
            note: "Confetti and the HaloBadge pulse are gated on accessibilityReduceMotion."
        ),
        // I18 — H15 channel prompt (this stream — the exemplar)
        .init(
            surface: "NotificationChannelPromptView",
            requirement: .minimumTapTarget,
            status: .pass,
            note: "Code boxes are 40×48 with a ≥44pt phone field; CTAs reuse PrimaryButton/GhostButton."
        ),
        .init(
            surface: "NotificationChannelPromptView",
            requirement: .visibleFocusRing,
            status: .pass,
            note: "The active code box uses a11yFocusRing; the input is a real labelled TextField."
        ),
        .init(
            surface: "NotificationChannelPromptView",
            requirement: .textNotColorOnly,
            status: .pass,
            note: "Push/connected/denied states use distinct headlines + icons, not color alone."
        ),
        .init(
            surface: "NotificationChannelPromptView",
            requirement: .accessibilityIdentifier,
            status: .pass,
            note: "Frame, primary/secondary CTAs, resend, and toast all carry stable identifiers."
        )
    ]

    /// Findings that still need a follow-up against the owning stream's files.
    public static var flagged: [SchedulingA11yFinding] {
        findings.filter { $0.status == .flagged }
    }

    /// Findings that already meet the contract.
    public static var passing: [SchedulingA11yFinding] {
        findings.filter { $0.status == .pass }
    }
}
