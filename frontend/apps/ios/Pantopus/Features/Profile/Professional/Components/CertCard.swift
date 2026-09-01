//
//  CertCard.swift
//  Pantopus
//
//  A.5 (A13.11) — a certification card: ribbon seal tile, name + issuer +
//  dates, an inline verification pill, and an overflow menu. Cards added
//  this session carry an amber border + fresh dot.
//

import SwiftUI

@MainActor
struct CertCard: View {
    let cert: Certification
    var onRemove: (() -> Void)?

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            ribbonTile
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Spacing.s1) {
                    Text(cert.name)
                        .pantopusTextStyle(.small)
                        .fontWeight(.bold)
                        .foregroundStyle(Theme.Color.appText)
                    ProVerifyBadge(status: cert.status)
                    if cert.isFresh { FreshDot() }
                }
                Text(cert.issuer)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextStrong)
                HStack(spacing: Spacing.s2) {
                    Text("Issued \(cert.issued)")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Text("·")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appBorderStrong)
                    Text("Expires \(cert.expires)")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(cert.status == .expiring ? Theme.Color.error : Theme.Color.appTextSecondary)
                }
                .padding(.top, 2)
            }
            Spacer(minLength: Spacing.s0)
            overflowMenu
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(cert.isFresh ? Theme.Color.warning : Theme.Color.appBorder, lineWidth: cert.isFresh ? 1.5 : 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
        .accessibilityIdentifier("proCertCard_\(cert.id)")
    }

    private var ribbonTile: some View {
        RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
            .fill(Theme.Color.appSurfaceSunken)
            .frame(width: 40, height: 48)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .overlay(Icon(.ribbon, size: 18, color: cert.status.foreground))
            .accessibilityHidden(true)
    }

    @ViewBuilder private var overflowMenu: some View {
        if let onRemove {
            Menu {
                Button("Remove certification", role: .destructive, action: onRemove)
            } label: {
                Icon(.moreHorizontal, size: 16, color: Theme.Color.appTextMuted)
                    .frame(width: 44, height: 44, alignment: .topTrailing)
            }
            .accessibilityLabel("Certification options")
            .accessibilityIdentifier("proCertMenu_\(cert.id)")
        }
    }

    private var accessibilityText: String {
        "\(cert.name), \(cert.issuer), issued \(cert.issued), expires \(cert.expires), \(cert.status.label)"
            + (cert.isFresh ? ", added this session" : "")
    }
}

/// Dashed "Upload certification" affordance shown at the foot of the list.
@MainActor
struct AddCertButton: View {
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s2) {
                Icon(.plusCircle, size: 15, color: Theme.Color.business)
                Text("Upload certification")
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.business)
                Spacer(minLength: Spacing.s0)
                Text("PDF · JPG")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 44)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .strokeBorder(Theme.Color.business.opacity(0.4), style: StrokeStyle(lineWidth: 1.5, dash: [5]))
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Upload certification")
        .accessibilityIdentifier("proAddCertButton")
    }
}

#Preview {
    VStack(spacing: Spacing.s2) {
        CertCard(
            cert: Certification(
                id: "1",
                name: "NY State General Contractor",
                issuer: "New York State Dept. of Labor",
                issued: "Mar 2021",
                expires: "Mar 2027",
                status: .verified
            )
        ) {}
        CertCard(
            cert: Certification(
                id: "2",
                name: "Certified Tile Installer (CTI)",
                issuer: "Ceramic Tile Education Foundation",
                issued: "May 2026",
                expires: "May 2031",
                status: .pending,
                isFresh: true
            )
        ) {}
        CertCard(
            cert: Certification(
                id: "3",
                name: "EPA Lead-Safe Renovator",
                issuer: "U.S. EPA",
                issued: "Jan 2022",
                expires: "Jan 2027",
                status: .expiring
            )
        ) {}
        AddCertButton {}
    }
    .padding()
    .background(Theme.Color.appBg)
}
