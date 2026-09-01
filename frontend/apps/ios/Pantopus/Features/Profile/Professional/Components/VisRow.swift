//
//  VisRow.swift
//  Pantopus
//
//  A.5 (A13.11) — a visibility toggle row with an optional Business-pillar
//  "scope" chip that appears only while the toggle is on.
//

import SwiftUI

@MainActor
struct VisRow: View {
    let row: ProVisibilityRow
    var onToggle: (Bool) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s3) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.label)
                        .pantopusTextStyle(.small)
                        .fontWeight(.medium)
                        .foregroundStyle(Theme.Color.appText)
                    if let sub = row.sub {
                        Text(sub)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: Spacing.s0)
                Toggle("", isOn: Binding(get: { row.isOn }, set: { onToggle($0) }))
                    .labelsHidden()
                    .tint(Theme.Color.primary600)
                    .accessibilityIdentifier("proVisToggle_\(row.id)")
            }
            if let scope = row.scope, row.isOn {
                HStack(spacing: Spacing.s1) {
                    Icon(.users, size: 11, color: Theme.Color.business)
                    Text("Visible to \(scope)")
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.business)
                }
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, Spacing.s1)
                .background(Theme.Color.businessBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Visible to \(scope)")
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(row.label), \(row.isOn ? "on" : "off")")
    }
}

#Preview {
    VStack(spacing: Spacing.s0) {
        VisRow(
            row: ProVisibilityRow(
                id: "1",
                label: "Show on neighbor search",
                sub: "Verified neighbors searching Pulse find your pro profile.",
                isOn: true,
                scope: "Elm Park · 0.6 mi radius"
            )
        ) { _ in }
        VisRow(
            row: ProVisibilityRow(
                id: "2",
                label: "Show hourly rate publicly",
                sub: "$85/hr · weekday daytime.",
                isOn: false
            )
        ) { _ in }
    }
    .background(Theme.Color.appSurface)
    .padding()
    .background(Theme.Color.appBg)
}
