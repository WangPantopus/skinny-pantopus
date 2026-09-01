//
//  TaxDocsRow.swift
//  Pantopus
//
//  A10.10 — single tax-docs row. File-text icon tile + "Tax documents"
//  + body line + chevron. `ready` lights the home-green icon tile, a
//  `New` chip beside the title, and the "1099-NEC … ready" body copy.
//

import SwiftUI

struct TaxDocsRow: View {
    let docs: WalletTaxDocs
    var onTap: () -> Void = {}

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .center, spacing: Spacing.s3) {
                iconTile
                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: Spacing.s1 + 2) {
                        Text("Tax documents")
                            .font(.system(size: 12.5, weight: .bold))
                            .tracking(-0.1)
                            .foregroundStyle(Theme.Color.appText)
                        if docs.ready {
                            newChip
                        }
                    }
                    Text(docs.bodyText)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.s2)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous))
            .pantopusShadow(.sm)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("walletTaxDocsRow")
        .accessibilityLabel(docs.ready ? "Tax documents, new: \(docs.bodyText)" : "Tax documents: \(docs.bodyText)")
    }

    private var iconTile: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.lg - 2, style: .continuous)
                .fill(docs.ready ? Theme.Color.homeBg : Theme.Color.appSurfaceSunken)
            Icon(
                .fileText,
                size: 17,
                strokeWidth: 2,
                color: docs.ready ? Theme.Color.homeDark : Theme.Color.appTextStrong
            )
        }
        .frame(width: 34, height: 34)
        .accessibilityHidden(true)
    }

    private var newChip: some View {
        Text("New")
            .font(.system(size: 9, weight: .bold))
            .tracking(0.4)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Color.homeDark)
            .padding(.horizontal, Spacing.s1 + 2)
            .padding(.vertical, 1)
            .background(Theme.Color.homeBg)
            .clipShape(Capsule())
    }
}

#Preview("TaxDocsRow variants") {
    VStack(spacing: Spacing.s4) {
        TaxDocsRow(docs: WalletSampleData.taxDocsSample)
        TaxDocsRow(docs: WalletSampleData.taxDocsHoldSample)
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
