//
//  OwnerNavRow.swift
//  Pantopus
//
//  C3 — a generic owner-dashboard entry-point card, the same geometry as
//  `TeamSummaryRow` / `PagesSummaryRow` but parameterised so the money +
//  legal sections (Payments, Invoices, Legal & verification) can share one
//  implementation instead of cloning it three times.
//
//  Mirrors Android `OwnerNavRow` in `BusinessOwnerScreen.kt`.
//

import SwiftUI

@MainActor
struct OwnerNavRow: View {
    let icon: PantopusIcon
    let title: String
    let subtitle: String
    let identifier: String
    let onOpen: @MainActor () -> Void

    var body: some View {
        Button { onOpen() } label: {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.businessBg)
                        .frame(width: 34, height: 34)
                    Icon(icon, size: 16, strokeWidth: 2, color: Theme.Color.business)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.system(size: 13, weight: .semibold))
                        .tracking(-0.1)
                        .foregroundStyle(Theme.Color.appText)
                    Text(subtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.s2)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s3)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier(identifier)
    }
}
