//
//  VaultBreadcrumb.swift
//  Pantopus
//
//  A17.10 — VaultBreadcrumb. The "Will be filed at" / "Filed at" card
//  on the records variant: a header strip with a "Change folder"
//  affordance, the slate-tinted chevron breadcrumb (Mailbox › Vault ›
//  Finance › Statements › 2026) wrapping across lines, and a retention
//  strip at the bottom — neutral clock copy when open, success-lock
//  copy when filed.
//
//  Design reference: `docs/designs/A17/records.jsx` (VaultDestination).
//

import SwiftUI

// swiftlint:disable multiple_closures_with_trailing_closure

/// Vault destination breadcrumb + retention note. Header label flips
/// from "Will be filed at" → "Filed at" when `isFiled` is true.
@MainActor
struct VaultBreadcrumb: View {
    let trail: [RecordsVaultCrumb]
    let retentionLine: String
    let isFiled: Bool
    var onChangeFolder: (@MainActor () -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            header
            crumbs
            retentionStrip
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("mailDetail_records_vaultBreadcrumb")
    }

    private var header: some View {
        HStack(spacing: Spacing.s1) {
            Text(isFiled ? "FILED AT" : "WILL BE FILED AT")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer()
            if let onChangeFolder, !isFiled {
                Button(action: { onChangeFolder() }) {
                    HStack(spacing: Spacing.s1) {
                        Icon(.pencil, size: 11, color: Theme.Color.primary600)
                        Text("Change folder")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Theme.Color.primary600)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("mailDetail_records_changeFolder")
            }
        }
    }

    private var crumbs: some View {
        // The breadcrumb is allowed to wrap. iOS doesn't ship a true
        // flow-layout primitive, so we stack rows manually by chunking
        // the trail into rows of N items. For up to 5 crumbs the design
        // fits two rows at 390pt; we keep a single horizontal scroll as
        // the fallback for narrow widths.
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s1) {
                ForEach(Array(trail.enumerated()), id: \.element.id) { index, crumb in
                    crumbChip(crumb)
                    if index < trail.count - 1 {
                        Icon(.chevronRight, size: 11, color: Theme.Color.appTextMuted)
                    }
                }
            }
            .padding(.vertical, 2)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Path: " + trail.map(\.label).joined(separator: ", "))
    }

    private func crumbChip(_ crumb: RecordsVaultCrumb) -> some View {
        let isCurrent = crumb.isCurrent
        return HStack(spacing: Spacing.s1) {
            Icon(
                icon(for: crumb.glyph),
                size: 11,
                color: isCurrent ? Theme.Color.appTextInverse : Theme.Color.categoryRecordsDeep
            )
            Text(crumb.label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(
                    isCurrent ? Theme.Color.appTextInverse : Theme.Color.categoryRecordsDeep
                )
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 4)
        .background(isCurrent ? Theme.Color.categoryRecordsDeep : Theme.Color.categoryRecordsBg)
        .overlay(
            RoundedRectangle(cornerRadius: 7)
                .stroke(
                    isCurrent ? Color.clear : Theme.Color.categoryRecordsBorder,
                    lineWidth: 1
                )
        )
        .clipShape(RoundedRectangle(cornerRadius: 7))
    }

    private var retentionStrip: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(
                isFiled ? .lock : .clock,
                size: 12,
                color: isFiled ? Theme.Color.success : Theme.Color.appTextSecondary
            )
            Text(retentionLine)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(isFiled ? Theme.Color.success : Theme.Color.appTextStrong)
                + Text(isFiled
                    ? " Auto-delete prompt April 2033."
                    : " Filing will start the retention clock.")
                .font(.system(size: 11.5))
                .foregroundStyle(isFiled ? Theme.Color.success : Theme.Color.appTextSecondary)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(isFiled ? Theme.Color.successBg : Theme.Color.appSurfaceSunken)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md)
                .stroke(
                    isFiled ? Theme.Color.successLight : Theme.Color.appBorderSubtle,
                    lineWidth: 1
                )
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
    }

    private func icon(for glyph: RecordsVaultCrumb.Glyph) -> PantopusIcon {
        switch glyph {
        case .inbox: .inbox
        case .archive: .archive
        case .landmark: .landmark
        case .fileText: .fileText
        case .calendar: .calendar
        }
    }
}

#Preview("VaultBreadcrumb · open") {
    VaultBreadcrumb(
        trail: RecordsSampleData.record.vaultTrail,
        retentionLine: RecordsSampleData.record.retentionLine,
        isFiled: false
    ) {}
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}

#Preview("VaultBreadcrumb · filed") {
    VaultBreadcrumb(
        trail: RecordsSampleData.filedRecord.vaultTrail,
        retentionLine: RecordsSampleData.filedRecord.retentionLine,
        isFiled: true
    )
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
