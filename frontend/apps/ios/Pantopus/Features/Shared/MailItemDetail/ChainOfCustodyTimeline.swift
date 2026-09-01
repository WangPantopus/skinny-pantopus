//
//  ChainOfCustodyTimeline.swift
//  Pantopus
//
//  T6.5c (P21) — Reusable vertical chain-of-custody timeline.
//
//  Originally introduced for the Certified mail variant (A17.3) to show
//  the postal scan + acknowledgement events. Lives in the shared
//  `MailItemDetail` folder because the same timeline shape is the
//  natural fit for any delivery-confirmation surface (P22 Community
//  variant's RSVP timeline, package-delivery scans, certified-letter
//  postal chains, etc.).
//
//  Anatomy per `certified.jsx:388-473`:
//    - section header card with title + subtitle + status pill
//    - 2px vertical track running through 24pt status circles
//    - per-step icon + label + (optional) "PANTOPUS" badge + meta line +
//      monospace timestamp
//    - active step gets a filled circle (primary600 for Pantopus
//      events, success-green for postal events); inactive steps get a
//      hollow circle with a 1.5pt border
//

import SwiftUI

/// One step in the timeline. Pure data — the renderer styles the active
/// vs inactive states and the optional Pantopus badge.
public struct ChainOfCustodyEvent: Sendable, Hashable, Identifiable {
    public let id: String
    /// Lucide-style glyph for the 24pt status circle (`mailbox` /
    /// `truck` / `building` / `plane` / `package` / `badgeCheck`, etc.).
    public let icon: PantopusIcon
    /// Bold label rendered next to the circle.
    public let label: String
    /// Single-line meta below the label (e.g. "Oakland P.O. · 94601").
    /// Nil when no extra context is available.
    public let meta: String?
    /// Monospace timestamp (e.g. "Today · 2:14 PM"). Nil hides the line.
    public let timestamp: String?
    /// `true` puts a small "PANTOPUS" pill next to the label — used for
    /// the Pantopus-side acknowledgement event so the user can tell
    /// platform events apart from postal events.
    public let isPantopusEvent: Bool
    /// `true` paints a filled circle (active) vs hollow (inactive).
    public let isComplete: Bool

    public init(
        id: String,
        icon: PantopusIcon,
        label: String,
        meta: String? = nil,
        timestamp: String? = nil,
        isPantopusEvent: Bool = false,
        isComplete: Bool = true
    ) {
        self.id = id
        self.icon = icon
        self.label = label
        self.meta = meta
        self.timestamp = timestamp
        self.isPantopusEvent = isPantopusEvent
        self.isComplete = isComplete
    }
}

/// Status pill rendered on the timeline card header.
public enum ChainOfCustodyStatus: Sendable, Equatable {
    /// "Unbroken" — green pill, success bg.
    case unbroken
    /// "Broken" — red pill, error bg.
    case broken
    /// Custom label + tint pair. Used by variants that need a
    /// different verb ("Delivered", "In transit", etc.).
    case custom(label: String, background: Color, foreground: Color)

    var label: String {
        switch self {
        case .unbroken: "Unbroken"
        case .broken: "Broken"
        case let .custom(label, _, _): label
        }
    }

    var background: Color {
        switch self {
        case .unbroken: Theme.Color.successBg
        case .broken: Theme.Color.errorBg
        case let .custom(_, background, _): background
        }
    }

    var foreground: Color {
        switch self {
        case .unbroken: Theme.Color.success
        case .broken: Theme.Color.error
        case let .custom(_, _, foreground): foreground
        }
    }
}

/// Reusable timeline. Each event is rendered as a row with a status
/// circle on the left, label + meta + timestamp on the right, and a
/// vertical 2pt track behind the circles.
public struct ChainOfCustodyTimeline: View {
    public let title: String
    public let subtitle: String?
    public let status: ChainOfCustodyStatus
    public let events: [ChainOfCustodyEvent]

    public init(
        title: String = "Chain of custody",
        subtitle: String? = nil,
        status: ChainOfCustodyStatus = .unbroken,
        events: [ChainOfCustodyEvent]
    ) {
        self.title = title
        self.subtitle = subtitle
        self.status = status
        self.events = events
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            header
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            timelineBody
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("chainOfCustodyTimeline")
    }

    private var header: some View {
        HStack(alignment: .center, spacing: Spacing.s2) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title.uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityAddTraits(.isHeader)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer(minLength: Spacing.s0)
            statusPill
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
    }

    private var statusPill: some View {
        Text(status.label)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(status.foreground)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 3)
            .background(status.background)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
            .accessibilityIdentifier("chainOfCustodyTimeline_status")
    }

    private var timelineBody: some View {
        ZStack(alignment: .leading) {
            // Vertical track behind the circles. Inset to align with the
            // 24pt circles' midline at x = 14 + 12 = 26pt.
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(width: 2)
                .padding(.leading, Spacing.s3 + 11)
                .padding(.vertical, Spacing.s3)
            VStack(alignment: .leading, spacing: Spacing.s3) {
                ForEach(events) { event in
                    EventRow(event: event)
                }
            }
            .padding(Spacing.s3)
        }
    }
}

private struct EventRow: View {
    let event: ChainOfCustodyEvent

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            statusCircle
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: Spacing.s1) {
                    Text(event.label)
                        .font(.system(size: 12.5, weight: event.isComplete ? .bold : .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                    if event.isPantopusEvent {
                        Text("PANTOPUS")
                            .font(.system(size: 9, weight: .bold))
                            .tracking(0.4)
                            .foregroundStyle(Theme.Color.primary700)
                            .padding(.horizontal, Spacing.s1)
                            .padding(.vertical, 1)
                            .background(Theme.Color.primary100)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
                    }
                }
                if let meta = event.meta {
                    Text(meta)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let timestamp = event.timestamp {
                    Text(timestamp)
                        .font(.system(size: 10.5, design: .monospaced))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("chainOfCustodyTimeline_event_\(event.id)")
    }

    @ViewBuilder private var statusCircle: some View {
        let colors = colors(for: event)
        ZStack {
            Circle()
                .fill(colors.background)
            Circle()
                .strokeBorder(colors.border, lineWidth: event.isComplete ? 2 : 1.5)
            Icon(event.icon, size: 12, color: colors.glyph)
        }
        .frame(width: 24, height: 24)
        .accessibilityHidden(true)
    }

    private struct EventColors {
        let background: Color
        let border: Color
        let glyph: Color
    }

    private func colors(for event: ChainOfCustodyEvent) -> EventColors {
        if event.isComplete {
            if event.isPantopusEvent {
                return EventColors(
                    background: Theme.Color.primary600,
                    border: Theme.Color.primary700,
                    glyph: Theme.Color.appTextInverse
                )
            }
            return EventColors(
                background: Theme.Color.success,
                border: Theme.Color.success,
                glyph: Theme.Color.appTextInverse
            )
        }
        return EventColors(
            background: Theme.Color.appSurface,
            border: Theme.Color.appBorderStrong,
            glyph: Theme.Color.appTextSecondary
        )
    }
}

#Preview {
    ChainOfCustodyTimeline(
        subtitle: "Postal scans · cryptographic receipts",
        events: [
            ChainOfCustodyEvent(
                id: "ack",
                icon: .badgeCheck,
                label: "Acknowledged on Pantopus",
                meta: "Cryptographic receipt OK-7c9d2a",
                timestamp: "Today · 2:14 PM",
                isPantopusEvent: true,
                isComplete: true
            ),
            ChainOfCustodyEvent(
                id: "delivered",
                icon: .mailbox,
                label: "Delivered to your Pantopus mailbox",
                meta: "Maria K. · scanned QR",
                timestamp: "Today · 1:02 PM",
                isComplete: true
            ),
            ChainOfCustodyEvent(
                id: "out",
                icon: .package,
                label: "Out for delivery",
                meta: "Oakland P.O. · 94601",
                timestamp: "Today · 10:38 AM",
                isComplete: false
            )
        ]
    )
    .padding()
    .background(Theme.Color.appBg)
}
