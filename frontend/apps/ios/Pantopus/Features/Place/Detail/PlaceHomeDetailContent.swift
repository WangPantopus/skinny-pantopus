//
//  PlaceHomeDetailContent.swift
//  Pantopus
//
//  C4 — Your home detail. Property facts (2×2), the value estimate with
//  range + trend sparkline, the tax assessment, and the device-local
//  equity calculator (private to the resident, never sent to the server
//  — the codebase's deliberate privacy stance for equity).
//

import SwiftUI

struct PlaceHomeDetailContent: View {
    let intel: PlaceIntelligence
    let vm: PlaceDetailViewModel

    private var home: PlaceYourHomeData? {
        guard let env = vm.section(.yourHome, in: intel), env.status == .ready || env.status == .stale
        else { return nil }
        return env.yourHome
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let env = vm.section(.yourHome, in: intel) {
                if let data = home {
                    PlaceDetailSectionLabel(text: "Property")
                    FactsCard(data: data)
                    PlaceSourceNote(
                        name: "County public records · estimate model",
                        asOf: PlacePresentation.fmtMonthYear(env.asOf)
                    )

                    PlaceDetailSectionLabel(text: "Value")
                    ValueCard(data: data)
                    if let assessed = data.assessedValue {
                        AssessmentCard(assessed: assessed)
                    }
                    PlaceSourceNote(
                        name: "County public records · estimate model",
                        asOf: PlacePresentation.fmtMonthYear(env.asOf)
                    )

                    PlaceDetailSectionLabel(text: "Equity")
                    EquityCalculator(estimatedValue: data.estimatedValue)
                } else {
                    PlaceDetailSectionLabel(text: "Your home")
                    vm.fallbackCard(env)
                }
            }
        }
    }
}

// MARK: - Facts 2×2

private struct FactsCard: View {
    let data: PlaceYourHomeData

    var body: some View {
        PlaceDetailCard {
            VStack(spacing: 16) {
                HStack(spacing: 16) {
                    PlaceFactCell(icon: .home, label: "Year built", value: data.yearBuilt.map(String.init) ?? "—")
                    PlaceFactCell(
                        icon: .building2,
                        label: "Living area",
                        value: data.sqft.map { "\(PlacePresentation.grouped($0)) sqft" } ?? "—"
                    )
                }
                HStack(spacing: 16) {
                    PlaceFactCell(icon: .users, label: "Bed / bath", value: bedBath)
                    PlaceFactCell(
                        icon: .mapPin,
                        label: "Lot size",
                        value: data.lotSqft.map { "\(PlacePresentation.grouped($0)) sqft" } ?? "—"
                    )
                }
            }
        }
    }

    private var bedBath: String {
        let bd = data.bedrooms.map { "\($0)bd" }
        let ba = data.bathrooms.map { b -> String in
            b == b.rounded() ? "\(Int(b))ba" : String(format: "%.1fba", b)
        }
        let parts = [bd, ba].compactMap { $0 }
        return parts.isEmpty ? "—" : parts.joined(separator: " ")
    }
}

// MARK: - Value card

private struct ValueCard: View {
    let data: PlaceYourHomeData

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .bottom, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(PlacePresentation.money(data.estimatedValue) ?? "—")
                            .font(.system(size: 28, weight: .bold))
                            .kerning(-0.5)
                            .foregroundStyle(Theme.Color.appText)
                        if let lo = data.valueLow, let hi = data.valueHigh,
                           let loS = PlacePresentation.money(lo), let hiS = PlacePresentation.money(hi) {
                            Text("\(loS) – \(hiS)")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(Theme.Color.appTextMuted)
                        }
                    }
                    Spacer(minLength: 0)
                    PlaceSparkline()
                }
                HStack(spacing: 6) {
                    legendDot(solid: true)
                    Text("Your home")
                    legendDot(solid: false)
                    Text("Block median")
                }
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
    }

    private func legendDot(solid: Bool) -> some View {
        Circle()
            .fill(solid ? Theme.Color.home : Theme.Color.appBorder)
            .frame(width: 8, height: 8)
    }
}

private struct AssessmentCard: View {
    let assessed: Double

    var body: some View {
        PlaceDetailCard(padding: 16) {
            HStack(spacing: 11) {
                PlaceIconTile(icon: .landmark, tone: .muted, size: 32)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Assessed value")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextMuted)
                    Text(PlacePresentation.money(assessed) ?? "—")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                }
                Spacer(minLength: 0)
                Text("Tax roll")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
    }
}

// MARK: - Equity calculator (device-local, private)

private struct EquityCalculator: View {
    let estimatedValue: Double?

    private enum Stage { case prompt, form, result }
    @State private var stage: Stage = .prompt
    @State private var loanBalance = ""
    @State private var rate = ""

    private var equity: Double? {
        guard let value = estimatedValue, let loan = Double(loanBalance.filter { $0.isNumber || $0 == "." })
        else { return nil }
        return max(value - loan, 0)
    }

    var body: some View {
        VStack(spacing: 8) {
            switch stage {
            case .prompt:
                Button { stage = .form } label: {
                    PlaceDetailCard(padding: 16) {
                        HStack(spacing: 11) {
                            PlaceIconTile(icon: .zap, tone: .sky, size: 32)
                            Text("Add your mortgage to see your equity")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Theme.Color.appText)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            PlaceChevron()
                        }
                    }
                }
                .buttonStyle(.plain)
            case .form:
                PlaceDetailCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Your mortgage")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        moneyField(title: "Loan balance", text: $loanBalance)
                        moneyField(title: "Interest rate (%)", text: $rate)
                        PrimaryButton(title: "Calculate", isEnabled: equity != nil) { stage = .result }
                    }
                }
            case .result:
                PlaceDetailCard {
                    VStack(spacing: 10) {
                        Text(PlacePresentation.money(equity) ?? "—")
                            .pantopusTextStyle(.h1)
                            .foregroundStyle(Theme.Color.home)
                        Text("Estimated equity")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextMuted)
                        Button("Edit") { stage = .form }
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Color.primary600)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            HStack(spacing: 6) {
                Icon(.lock, size: 12, strokeWidth: 2, color: Theme.Color.appTextMuted)
                Text("Private to you — never shown to neighbors")
            }
            .font(Theme.Font.caption)
            .foregroundStyle(Theme.Color.appTextMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func moneyField(title: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Color.appTextMuted)
            TextField("", text: text)
                .keyboardType(.decimalPad)
                .font(.system(size: 16, weight: .medium))
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
    }
}
