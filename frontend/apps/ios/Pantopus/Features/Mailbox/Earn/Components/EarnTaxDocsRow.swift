//
//  EarnTaxDocsRow.swift
//  Pantopus
//
//  A10.11 — the Taxes row. File-text tile + "Tax documents" + the YTD /
//  1099 meta line + chevron. The empty new-earner frame renders a gated
//  `EarnLockedRow` here instead (taxes unlock after the first paid task).
//  Named `EarnTaxDocsRow` (file + type) to sit alongside the Wallet
//  `TaxDocsRow` — Swift requires unique filenames per target.
//

import SwiftUI

struct EarnTaxDocsRow: View {
    let docs: EarnTaxDocs
    var onTap: () -> Void = {}

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .center, spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.lg - 2, style: .continuous)
                        .fill(Theme.Color.appSurfaceSunken)
                    Icon(.fileText, size: 17, strokeWidth: 2, color: Theme.Color.appTextStrong)
                }
                .frame(width: 34, height: 34)
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Tax documents")
                        .font(.system(size: 12.5, weight: .bold))
                        .tracking(-0.1)
                        .foregroundStyle(Theme.Color.appText)
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
        .accessibilityIdentifier("earnTaxDocsRow")
        .accessibilityLabel("Tax documents: \(docs.bodyText)")
    }
}

#Preview("Tax docs row") {
    VStack(spacing: Spacing.s4) {
        if let docs = EarnSampleData.populated.taxDocs {
            EarnTaxDocsRow(docs: docs)
        }
        EarnLockedRow(
            title: "Tax documents",
            subcopy: "Your 1099 and YTD totals appear after your first paid task.",
            identifier: "earnTaxDocsLockedRow"
        )
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
