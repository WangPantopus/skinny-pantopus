//
//  ServicesList.swift
//  Pantopus
//
//  A10.6 — the Services card: priced rows with a business-tinted glyph
//  tile, name + meta, and a right-aligned price + unit.
//
//  Design reference: `docs/designs/A10/business-frames.jsx` (Services).
//

import SwiftUI

@MainActor
struct ServicesList: View {
    let services: [BusinessServiceRow]

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(services.enumerated()), id: \.element.id) { index, service in
                row(service)
                if index != services.count - 1 {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                        .padding(.horizontal, 14)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("businessProfile.services")
    }

    private func row(_ service: BusinessServiceRow) -> some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.businessBg)
                    .frame(width: 34, height: 34)
                Icon(service.icon, size: 16, strokeWidth: 2, color: Theme.Color.business)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(service.name)
                    .font(.system(size: 13, weight: .semibold))
                    .tracking(-0.1)
                    .foregroundStyle(Theme.Color.appText)
                if let detail = service.detail, !detail.isEmpty {
                    Text(detail)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer(minLength: Spacing.s2)
            VStack(alignment: .trailing, spacing: 0) {
                Text(service.priceLabel)
                    .font(.system(size: 13, weight: .bold))
                    .tracking(-0.2)
                    .foregroundStyle(Theme.Color.appText)
                if let unit = service.unit, !unit.isEmpty {
                    Text(unit)
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(service.name), \(service.priceLabel)")
    }
}

#Preview("ServicesList") {
    ServicesList(services: [
        BusinessServiceRow(
            id: "std",
            name: "Standard clean",
            detail: "2 hr · 2-person team",
            priceLabel: "from $90",
            unit: "per visit",
            icon: .droplets
        ),
        BusinessServiceRow(
            id: "deep",
            name: "Deep clean",
            detail: "4 hr · baseboards, inside oven",
            priceLabel: "from $180",
            unit: "per visit",
            icon: .sparkles
        )
    ])
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
