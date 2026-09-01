//
//  OfflineBanner.swift
//  Pantopus
//
//  Top-of-screen banner shown when the app is offline but cached data
//  is still visible underneath. Use the `.offlineBanner(...)` modifier
//  on every list / detail screen so the chrome stays consistent (P15).
//

import SwiftUI

/// Dismissible amber banner: "You're offline. Showing last known data."
public struct OfflineBanner: View {
    private let onDismiss: () -> Void

    public init(onDismiss: @escaping () -> Void = {}) {
        self.onDismiss = onDismiss
    }

    public var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.wifiOff, size: 18, color: Theme.Color.warning)
            Text("You're offline. Showing last known data.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: onDismiss) {
                Icon(.x, size: 16, color: Theme.Color.appTextSecondary)
                    .frame(width: 32, height: 32)
            }
            .accessibilityLabel("Dismiss offline banner")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.warningBg)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.warning.opacity(0.3)).frame(height: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("You're offline. Showing last known data.")
        .accessibilityIdentifier("offlineBanner")
    }
}

public extension View {
    /// Show an `OfflineBanner` above this view when `isOffline` is true
    /// and the user hasn't dismissed it. The banner re-appears on the
    /// next offline transition.
    func offlineBanner(isOffline: Bool) -> some View {
        modifier(OfflineBannerModifier(isOffline: isOffline))
    }
}

private struct OfflineBannerModifier: ViewModifier {
    let isOffline: Bool
    @State private var dismissed = false

    func body(content: Content) -> some View {
        VStack(spacing: Spacing.s0) {
            if isOffline && !dismissed {
                OfflineBanner { dismissed = true }
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
            content
        }
        .pantopusAnimation(.componentState, value: isOffline)
        .pantopusAnimation(.componentState, value: dismissed)
        .onChange(of: isOffline) { _, online in
            // Reset the dismiss flag whenever connectivity flips back so
            // the banner re-appears on the next offline transition.
            if online == false { dismissed = false }
        }
    }
}

#Preview {
    VStack {
        OfflineBanner()
        Text("Below the banner")
            .padding()
    }
}
