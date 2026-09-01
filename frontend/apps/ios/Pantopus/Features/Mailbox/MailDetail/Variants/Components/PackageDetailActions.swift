//
//  PackageDetailActions.swift
//  Pantopus
//
//  A17.8 split dock for package detail screens.
//

import SwiftUI

/// A17.8 split dock: "Track on carrier" (secondary, opens browser to the
/// carrier-supplied tracking URL) + "Confirm pickup" (primary, fires the
/// acknowledge-delivery flow). Confirm pickup flips into a Received
/// indicator pill once the recipient acknowledges in-hand receipt.
struct PackageDetailActions: View {
    let isReceived: Bool
    let ackInFlight: Bool
    let trackingUrl: String?
    let carrier: String
    let onConfirmPickup: @MainActor () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            trackButton
            confirmButton
        }
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private var trackButton: some View {
        if let trackingUrl, let url = URL(string: trackingUrl) {
            Link(destination: url) {
                trackButtonLabel
            }
            .accessibilityIdentifier("mailDetail_package_trackOnCarrier")
        } else {
            Button(action: {}, label: { trackButtonLabel })
                .buttonStyle(.plain)
                .disabled(true)
                .accessibilityIdentifier("mailDetail_package_trackOnCarrier")
        }
    }

    private var trackButtonLabel: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.externalLink, size: 15, color: Theme.Color.appTextStrong)
            Text("Track on \(carrierShort)")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    @ViewBuilder
    private var confirmButton: some View {
        if isReceived {
            receivedPill
        } else {
            confirmPrimary
        }
    }

    private var confirmPrimary: some View {
        Button(
            action: { onConfirmPickup() },
            label: {
                HStack(spacing: Spacing.s2) {
                    if ackInFlight {
                        ProgressView().tint(Theme.Color.appTextInverse)
                    } else {
                        Icon(.checkCircle, size: 16, color: Theme.Color.appTextInverse)
                    }
                    Text("Confirm pickup")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .opacity(ackInFlight ? 0.6 : 1)
            }
        )
        .buttonStyle(.plain)
        .disabled(ackInFlight)
        .accessibilityIdentifier("mailDetail_package_confirmPickup")
    }

    private var receivedPill: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.checkCircle, size: 16, color: Theme.Color.success)
            Text("Picked up")
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(Theme.Color.success)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(Theme.Color.successBg)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Theme.Color.successLight, lineWidth: 1.5)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .onTapGesture { onConfirmPickup() }
        .accessibilityIdentifier("mailDetail_package_received")
    }

    private var carrierShort: String {
        let upper = carrier.uppercased()
        if upper.contains("USPS") { return "USPS" }
        if upper.contains("UPS") { return "UPS" }
        if upper.contains("FEDEX") { return "FedEx" }
        if upper.contains("DHL") { return "DHL" }
        return "carrier"
    }
}
