//
//  CompanyField.swift
//  Pantopus
//
//  A.5 (A13.11) — the Role-section company row: a logo disc, the company
//  name + locality, and an inline verification pill. Display-only here
//  (the company picker needs a backend), so the trailing chevron is
//  decorative.
//

import SwiftUI

@MainActor
struct CompanyField: View {
    let company: CompanyClaim

    var body: some View {
        HStack(spacing: Spacing.s2) {
            logoDisc
            VStack(alignment: .leading, spacing: 1) {
                Text(company.name)
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                HStack(spacing: Spacing.s1) {
                    Text(company.locality)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                    Text("·")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appBorderStrong)
                    ProVerifyBadge(status: company.status)
                }
            }
            Spacer(minLength: Spacing.s0)
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
        }
        .padding(.horizontal, Spacing.s2)
        .frame(minHeight: 52)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Company \(company.name), \(company.locality), \(company.status.label)")
        .accessibilityIdentifier("proCompanyField")
    }

    private var logoDisc: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .fill(Theme.Color.business)
                .frame(width: 32, height: 32)
            Text(String(company.name.prefix(1)).uppercased())
                .pantopusTextStyle(.small)
                .fontWeight(.bold)
                .foregroundStyle(Theme.Color.appTextInverse)
        }
        .accessibilityHidden(true)
    }
}

#Preview {
    VStack(spacing: Spacing.s3) {
        CompanyField(company: CompanyClaim(name: "Kovács & Co Handywork", locality: "Elm Park, NY", status: .verified))
        CompanyField(company: CompanyClaim(name: "Elm Park Trades Co-op", locality: "Elm Park, NY", status: .pending))
    }
    .padding()
    .background(Theme.Color.appBg)
}
