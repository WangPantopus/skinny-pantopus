//
//  PlaceMoneyDetailContent.swift
//  Pantopus
//
//  C7 — Money signals. Utility bill benchmark (peer track), incentive
//  programs (DSIRE), the HUD rent band, and the informational
//  "how property-tax appeals work" note (legal-gated: information only).
//

import SwiftUI

// swiftlint:disable line_length

struct PlaceMoneyDetailContent: View {
    let intel: PlaceIntelligence
    let vm: PlaceDetailViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let bill = vm.section(.billBenchmark, in: intel) {
                PlaceDetailSectionLabel(text: "Bill benchmark")
                if let data = bill.billBenchmark, bill.status == .ready || bill.status == .stale {
                    BillBenchmarkCard(data: data)
                } else {
                    vm.fallbackCard(bill)
                }
                PlaceSourceNote(name: "Your utility · peer comparison", asOf: nil)
            }

            if let incentives = vm.section(.incentives, in: intel) {
                PlaceDetailSectionLabel(text: "Incentives")
                if let data = incentives.incentives, !data.programs.isEmpty {
                    VStack(spacing: 8) {
                        ForEach(data.programs) { p in IncentiveRow(program: p) }
                    }
                    Text("Eligibility is an estimate — verify with each provider.")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.top, 8)
                } else {
                    vm.fallbackCard(incentives)
                }
                PlaceSourceNote(name: "DSIRE database", asOf: nil)
            }

            if let rent = vm.section(.rentBand, in: intel) {
                PlaceDetailSectionLabel(text: "Rent band")
                if let data = rent.rentBand, rent.status == .ready || rent.status == .stale {
                    RentBandCard(data: data)
                } else {
                    vm.fallbackCard(rent)
                }
                PlaceSourceNote(name: "HUD Fair Market Rents", asOf: nil)
            }

            PlaceDetailSectionLabel(text: "Property tax")
            PlaceDetailCard {
                VStack(alignment: .leading, spacing: 8) {
                    Text("How appeals work")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(
                        "If your assessment is above market, that's the usual basis for an appeal. Check your county's deadline, gather comparable sales, and file a petition with the assessor."
                    )
                    .font(.system(size: 13.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    Text("Informational only — not legal or tax advice.")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.warning)
                }
            }
        }
    }
}

// MARK: - Bill benchmark track

private struct BillBenchmarkCard: View {
    let data: PlaceBillBenchmarkData

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    if let amount = data.yourAmount {
                        Text("\(PlacePresentation.money(amount) ?? "—") / mo")
                            .font(.system(size: 26, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                    } else {
                        Text("Typical \(PlacePresentation.money(data.bandLow) ?? "")–\(PlacePresentation.money(data.bandHigh) ?? "")")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                    }
                    Spacer(minLength: 0)
                    PlaceChip(model: comparisonChip)
                }
                track
                Text(data.summary)
                    .font(.system(size: 13.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }

    private var comparisonChip: PlaceChipModel {
        let pct = Int(abs(data.comparisonPct).rounded())
        switch data.comparison {
        case .higher: return PlaceChipModel(tone: .warning, text: "\(pct)% above", icon: .trendingUp)
        case .lower: return PlaceChipModel(tone: .success, text: "\(pct)% below", icon: .trendingDown)
        default: return PlaceChipModel(tone: .neutral, text: "Typical")
        }
    }

    private var track: some View {
        VStack(spacing: 4) {
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.Color.appSurfaceSunken).frame(height: 8)
                    Capsule().fill(Theme.Color.homeBg)
                        .frame(width: proxy.size.width * 0.4, height: 8)
                        .offset(x: proxy.size.width * 0.3)
                    if let pos = position {
                        Circle().fill(Theme.Color.primary600)
                            .frame(width: 14, height: 14)
                            .overlay(Circle().strokeBorder(Theme.Color.appSurface, lineWidth: 2))
                            .offset(x: proxy.size.width * pos - 7)
                    }
                }
                .frame(height: 14)
            }
            .frame(height: 14)
            HStack {
                Text("Lower")
                Spacer()
                Text("Typical")
                Spacer()
                Text("Higher")
            }
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(Theme.Color.appTextMuted)
        }
    }

    private var position: Double? {
        guard let amount = data.yourAmount else { return nil }
        let span = max(data.bandHigh - data.bandLow, 1)
        let lo = data.bandLow - span * 0.75
        let hi = data.bandHigh + span * 0.75
        return min(max((amount - lo) / (hi - lo), 0.04), 0.96)
    }
}

private struct IncentiveRow: View {
    let program: PlaceIncentive

    var body: some View {
        PlaceDetailCard(padding: 14) {
            HStack(alignment: .top, spacing: 11) {
                PlaceIconTile(icon: .badgePercent, tone: .home, size: 32)
                VStack(alignment: .leading, spacing: 3) {
                    HStack {
                        Text(program.name)
                            .font(.system(size: 14.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        Spacer(minLength: 0)
                        PlaceChip(model: PlaceChipModel(tone: .success, text: "You may be eligible"))
                    }
                    Text(program.summary)
                        .font(.system(size: 12.5))
                        .lineSpacing(2)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
        }
    }
}

private struct RentBandCard: View {
    let data: PlaceRentBandData

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("\(data.bedrooms)BR fair-market band")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextMuted)
                Text("\(PlacePresentation.money(data.bandLow) ?? "")–\(PlacePresentation.money(data.bandHigh) ?? "")")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                GeometryReader { proxy in
                    let span = max(data.marketHigh - data.marketLow, 1)
                    let start = (data.bandLow - data.marketLow) / span
                    let width = (data.bandHigh - data.bandLow) / span
                    ZStack(alignment: .leading) {
                        Capsule().fill(Theme.Color.appSurfaceSunken).frame(height: 8)
                        Capsule().fill(Theme.Color.homeBg)
                            .frame(width: max(proxy.size.width * width, 8), height: 8)
                            .offset(x: proxy.size.width * start)
                    }
                }
                .frame(height: 8)
                if !data.summary.isEmpty {
                    Text(data.summary)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
        }
    }
}
