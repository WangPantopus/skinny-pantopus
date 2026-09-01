//
//  ProVerifyBadge.swift
//  Pantopus
//
//  A.5 (A13.11) — inline verification pill for high-trust claims. Color is
//  driven by the claim status: verified → success, pending → warning,
//  expiring → error.
//

import SwiftUI

@MainActor
struct ProVerifyBadge: View {
    let status: ProVerificationStatus

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(status.icon, size: 11, color: status.foreground)
            Text(status.label)
                .pantopusTextStyle(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(status.foreground)
        }
        .padding(.horizontal, Spacing.s1)
        .padding(.vertical, 2)
        .background(status.background)
        .clipShape(Capsule())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Status: \(status.label)")
    }
}

/// The amber "added this session" dot shown on fresh skills, certs, and
/// portfolio links. The pale ring mirrors the design's 2px halo.
@MainActor
struct FreshDot: View {
    var body: some View {
        Circle()
            .fill(Theme.Color.warning)
            .frame(width: 6, height: 6)
            .overlay(Circle().stroke(Theme.Color.warningBg, lineWidth: 2))
            .accessibilityLabel("Added this session")
    }
}

#Preview {
    VStack(alignment: .leading, spacing: Spacing.s2) {
        ProVerifyBadge(status: .verified)
        ProVerifyBadge(status: .pending)
        ProVerifyBadge(status: .expiring)
        FreshDot()
    }
    .padding()
    .background(Theme.Color.appBg)
}
