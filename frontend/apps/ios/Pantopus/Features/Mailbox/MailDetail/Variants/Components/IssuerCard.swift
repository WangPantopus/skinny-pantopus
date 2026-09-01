//
//  IssuerCard.swift
//  Pantopus
//
//  A17.10 — IssuerCard. Records mail's bespoke sender card: institution
//  avatar with a slate gradient + corner landmark badge, two-line name
//  + department, a regulated identifier in mono (CRD# / FINRA / FDA),
//  and a DKIM-verified trust note in a slate-tinted strip below.
//
//  Design reference: `docs/designs/A17/records.jsx` (IssuerCard).
//

import SwiftUI

/// Records mail issuer card. Stands in for the standard `SenderCard`
/// because financial / medical / legal records need the regulated
/// identifier surfaced alongside the institution name.
@MainActor
struct IssuerCard: View {
    let issuer: RecordsIssuer

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("ISSUER")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)

            HStack(alignment: .center, spacing: Spacing.s3) {
                avatar
                VStack(alignment: .leading, spacing: 2) {
                    Text(issuer.name)
                        .font(.system(size: 14.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(issuer.dept)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(2)
                    Text(issuer.identifier)
                        .font(.system(size: 10.5, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Theme.Color.categoryRecordsDeep)
                        .padding(.top, 2)
                }
                Spacer(minLength: Spacing.s0)
            }

            trustNote
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("mailDetail_records_issuerCard")
    }

    private var avatar: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Theme.Color.categoryRecordsDeep,
                            Theme.Color.categoryRecordsDeep.opacity(0.85)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            Text(issuer.initials)
                .font(.system(size: 14, weight: .heavy))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextInverse)
        }
        .frame(width: 46, height: 46)
        .overlay(alignment: .bottomTrailing) {
            // Corner landmark badge — signals "institution" beyond the
            // gradient. Sits half off the avatar's bottom-right corner.
            ZStack {
                Circle().fill(Theme.Color.appSurface)
                Circle().stroke(Theme.Color.categoryRecordsDeep, lineWidth: 1.5)
                Icon(.landmark, size: 10, color: Theme.Color.categoryRecordsDeep)
            }
            .frame(width: 18, height: 18)
            .offset(x: 4, y: 4)
        }
        .accessibilityHidden(true)
    }

    private var trustNote: some View {
        HStack(alignment: .center, spacing: Spacing.s2) {
            Icon(.shieldCheck, size: 12, color: Theme.Color.categoryRecordsDeep)
            Text(issuer.trustNote)
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.categoryRecordsDeep)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.categoryRecordsBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md)
                .stroke(Theme.Color.categoryRecordsBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(issuer.trustNote)
    }
}

#Preview("IssuerCard") {
    IssuerCard(issuer: RecordsSampleData.record.issuer)
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}
