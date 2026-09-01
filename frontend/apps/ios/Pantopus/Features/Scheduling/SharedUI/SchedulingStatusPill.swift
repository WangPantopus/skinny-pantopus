//
//  SchedulingStatusPill.swift
//  Pantopus
//
//  Foundation (I0b) — the canonical booking/page status pill. A leading
//  semantic glyph + a Title-case label on a tinted fill with a hairline tone
//  border — fontSize 10 / weight 700, tight 3×8 padding, 9px glyph. Tones:
//  green for confirmed / active, INFO-blue for pending / draft, red for
//  declined / no-show, neutral grey for paused / cancelled / completed / past /
//  expired / secret / unavailable / waitlisted. The leading glyph lets manage &
//  invoice badges (C-manage, C-mybookings, G12, G13) adopt this one primitive.
//  Tokens only.
//

import SwiftUI

/// Every booking, page, and link status the pill can render. The raw value is
/// the backend wire string; `init(backend:)` is tolerant of unknown values.
public enum SchedulingPillStatus: String, Sendable, Hashable, CaseIterable {
    case pending
    case confirmed
    case cancelled
    case declined
    case noShow = "no_show"
    case completed
    case past
    case active
    case paused
    case draft
    case secret
    case expired
    case unavailable
    case waitlisted
    case unknown

    /// Backend wire value (incl. aliases) → pill status.
    private static let aliases: [String: SchedulingPillStatus] = [
        "pending": .pending, "pending_approval": .pending, "requested": .pending,
        "confirmed": .confirmed, "approved": .confirmed, "accepted": .confirmed, "booked": .confirmed,
        "cancelled": .cancelled, "canceled": .cancelled,
        "declined": .declined, "rejected": .declined,
        "no_show": .noShow, "noshow": .noShow,
        "completed": .completed, "done": .completed,
        "past": .past,
        "active": .active, "live": .active, "published": .active,
        "paused": .paused,
        "draft": .draft,
        "secret": .secret, "private": .secret, "hidden": .secret,
        "expired": .expired,
        "unavailable": .unavailable, "full": .unavailable, "fully_booked": .unavailable,
        "waitlisted": .waitlisted, "waitlist": .waitlisted
    ]

    /// Map a backend status string (snake_case or camelCase) to a pill status.
    public init(backend raw: String) {
        let key = raw.lowercased().replacingOccurrences(of: "-", with: "_")
        self = Self.aliases[key] ?? .unknown
    }

    var label: String {
        switch self {
        case .pending: "Pending"
        case .confirmed: "Confirmed"
        case .cancelled: "Cancelled"
        case .declined: "Declined"
        case .noShow: "No-show"
        case .completed: "Completed"
        case .past: "Past"
        case .active: "Active"
        case .paused: "Paused"
        case .draft: "Draft"
        case .secret: "Private"
        case .expired: "Expired"
        case .unavailable: "Fully booked"
        case .waitlisted: "Waitlisted"
        case .unknown: "Status"
        }
    }

    var tone: Tone {
        switch self {
        case .confirmed, .active, .completed: .success
        // Pending / awaiting-approval reads as INFO-blue (in-progress), not a
        // warning. Draft (an unpublished page) also takes the calm info tone.
        case .pending, .draft: .info
        case .declined, .noShow, .expired: .error
        case .cancelled, .past, .paused, .secret,
             .unavailable, .waitlisted, .unknown: .neutral
        }
    }

    /// Leading glyph — every status carries a semantic icon so the chip reads
    /// at a glance without relying on color alone.
    var icon: PantopusIcon {
        switch self {
        case .confirmed: .checkCircle
        case .active: .circleDot
        case .completed: .calendarCheck
        case .pending: .clock
        case .draft: .circleDot
        case .declined: .xCircle
        case .noShow: .userX
        case .expired: .alertCircle
        case .cancelled: .xCircle
        case .past: .clock
        case .paused: .pauseCircle
        case .secret: .eyeOff
        case .unavailable: .ban
        case .waitlisted: .clock
        case .unknown: .circleDot
        }
    }

    enum Tone {
        case success, info, error, neutral

        var background: Color {
            switch self {
            case .success: Theme.Color.successBg
            case .info: Theme.Color.infoBg
            case .error: Theme.Color.errorBg
            case .neutral: Theme.Color.appSurfaceSunken
            }
        }

        var foreground: Color {
            switch self {
            case .success: Theme.Color.success
            case .info: Theme.Color.info
            case .error: Theme.Color.error
            case .neutral: Theme.Color.appTextSecondary
            }
        }

        /// Hairline border tint — the design draws a 1px tone-light outline
        /// around every status chip (neutral falls back to `appBorder`).
        var border: Color {
            switch self {
            case .success: Theme.Color.successLight
            case .info: Theme.Color.infoLight
            case .error: Theme.Color.errorLight
            case .neutral: Theme.Color.appBorder
            }
        }
    }
}

/// A pill rendering a booking/page/link status with a semantic chip + glyph.
public struct SchedulingStatusPill: View {
    private let status: SchedulingPillStatus
    private let labelOverride: String?

    public init(_ status: SchedulingPillStatus) {
        self.status = status
        labelOverride = nil
    }

    /// Render directly from a backend status string. An unrecognized wire value
    /// keeps a humanized form of the raw string ("in_review" → "In review")
    /// instead of a generic "Status", mirroring the per-screen chips this pill
    /// replaced (which echoed the raw value rather than dropping it).
    public init(status raw: String) {
        let mapped = SchedulingPillStatus(backend: raw)
        status = mapped
        labelOverride = mapped == .unknown ? Self.humanize(raw) : nil
    }

    private var label: String {
        labelOverride ?? status.label
    }

    /// "in_review" / "in-review" → "In review"; blank → nil (falls back to "Status").
    private static func humanize(_ raw: String) -> String? {
        let cleaned = raw
            .replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: "-", with: " ")
            .trimmingCharacters(in: .whitespaces)
        guard let first = cleaned.first else { return nil }
        return first.uppercased() + cleaned.dropFirst()
    }

    public var body: some View {
        HStack(spacing: 3) {
            Icon(status.icon, size: 9, strokeWidth: 2.2, color: status.tone.foreground)
            Text(label)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(status.tone.foreground)
                .lineLimit(1)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(status.tone.background)
        .overlay(Capsule().strokeBorder(status.tone.border, lineWidth: 1))
        .clipShape(Capsule())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityIdentifier("scheduling.statusPill.\(status.rawValue)")
    }
}

#if DEBUG
#Preview {
    ScrollView {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ForEach(SchedulingPillStatus.allCases, id: \.self) { status in
                SchedulingStatusPill(status)
            }
        }
        .padding()
    }
    .background(Theme.Color.appBg)
}
#endif
