//
//  PlaceBlockDetailContent.swift
//  Pantopus
//
//  C6 — Your block. Verified-homes density (k-anon bucket), the census
//  area context, and the permits placeholder (no national source — a
//  coverage-honest "coming to your area" state).
//

import SwiftUI

struct PlaceBlockDetailContent: View {
    let intel: PlaceIntelligence
    let vm: PlaceDetailViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let density = vm.section(.blockDensity, in: intel) {
                PlaceDetailSectionLabel(text: "Verified homes nearby")
                if let data = density.blockDensity {
                    PlaceDensityCard(
                        bucket: data.bucket,
                        label: data.label,
                        ctaTitle: "Be one of the first to verify on your block",
                        onTap: nil
                    )
                } else {
                    vm.fallbackCard(density)
                }
                PlaceSourceNote(name: "Pantopus verified neighbors", asOf: nil)
            }

            if let census = vm.section(.censusContext, in: intel) {
                PlaceDetailSectionLabel(text: "Neighborhood")
                if let data = census.censusContext, census.status == .ready || census.status == .stale {
                    CensusCard(data: data)
                } else {
                    vm.fallbackCard(census)
                }
                PlaceSourceNote(
                    name: "U.S. Census · American Community Survey",
                    asOf: PlacePresentation.fmtMonthYear(census.asOf)
                )
            }

            PlaceDetailSectionLabel(text: "Recent permits nearby")
            PlaceDetailCard(padding: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 11) {
                        PlaceIconTile(icon: .hardHat, tone: .muted, size: 32)
                        Text("Permits")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        Spacer(minLength: 0)
                    }
                    Text("Not available for your area yet.")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Text("Building permits come from each city's portal — we're expanding coverage metro by metro.")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
        }
    }
}

private struct CensusCard: View {
    let data: PlaceCensusContextData

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 16) {
                    stat(label: "Median year built", value: data.medianYearBuilt.map(String.init) ?? "—")
                    stat(label: "Median home value", value: PlacePresentation.money(data.medianHomeValue) ?? "—")
                }
                if !data.summary.isEmpty {
                    Text(data.summary)
                        .font(.system(size: 13.5))
                        .lineSpacing(2)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
        }
    }

    private func stat(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.system(size: 19, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
