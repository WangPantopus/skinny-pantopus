//
//  PackageTrackingTimeline.swift
//  Pantopus
//
//  A17.8 - Vertical package-tracking timeline (Shipped / In transit /
//  Out for delivery / Delivered, plus carrier-specific intermediate
//  scans). Wraps the canonical `TimelineStepper` in a card shell so the
//  Package body can drop it in alongside the status card and the proof
//  photo without re-implementing geometry.
//

import SwiftUI

/// Vertical tracking timeline rendered as its own card. Owners pass the
/// list of `TimelineStep`s and (optionally) a carrier name; when present
/// the card surfaces a "View on <carrier>" external-link affordance in
/// the section header.
@MainActor
public struct PackageTrackingTimeline: View {
    private let steps: [TimelineStep]
    private let carrier: String?
    private let onOpenCarrier: (@MainActor () -> Void)?

    public init(
        steps: [TimelineStep],
        carrier: String? = nil,
        onOpenCarrier: (@MainActor () -> Void)? = nil
    ) {
        self.steps = steps
        self.carrier = carrier
        self.onOpenCarrier = onOpenCarrier
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            header
            TimelineStepper(steps: steps)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .pantopusShadow(.sm)
        .accessibilityIdentifier("packageTrackingTimeline")
    }

    private var header: some View {
        HStack(spacing: Spacing.s2) {
            Text("TRACKING TIMELINE")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer(minLength: 0)
            if let carrier, let onOpenCarrier {
                Button(action: { onOpenCarrier() }, label: {
                    HStack(spacing: 3) {
                        Text("View on \(carrierShort(carrier))")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Theme.Color.primary600)
                        Icon(.externalLink, size: 11, color: Theme.Color.primary600)
                    }
                })
                .buttonStyle(.plain)
                .accessibilityIdentifier("packageTrackingTimeline.viewOnCarrier")
            }
        }
    }

    private func carrierShort(_ carrier: String) -> String {
        let upper = carrier.uppercased()
        if upper.contains("USPS") { return "USPS" }
        if upper.contains("UPS") { return "UPS" }
        if upper.contains("FEDEX") { return "FedEx" }
        if upper.contains("DHL") { return "DHL" }
        return carrier.split(separator: " ").first.map(String.init) ?? carrier
    }
}

#Preview {
    PackageTrackingTimeline(
        steps: [
            TimelineStep(id: "shipped", title: "Shipped", subtitle: "Wed May 13", state: .done),
            TimelineStep(id: "transit", title: "In transit", subtitle: "Sat May 16", state: .done),
            TimelineStep(id: "out", title: "Out for delivery", subtitle: "Mon May 18", state: .current),
            TimelineStep(id: "delivered", title: "Delivered", subtitle: "Expected today", state: .upcoming)
        ],
        carrier: "USPS"
    ) {}
        .padding()
        .background(Theme.Color.appBg)
}
