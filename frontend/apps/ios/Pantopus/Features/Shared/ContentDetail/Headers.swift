//
//  Headers.swift
//  Pantopus
//
//  Header slots for the Content Detail shell. `HomeHeroHeader` is the
//  concrete one in this file; the business and wallet headers now ship as
//  concrete views under `Headers/` (see the MARK at the foot of this file).
//

import SwiftUI

// MARK: - Home hero

/// A single stat cell inside `HomeHeroHeader`.
public struct HomeHeroStat: Sendable, Identifiable {
    public let id: String
    public let value: String
    public let label: String

    public init(id: String = UUID().uuidString, value: String, label: String) {
        self.id = id
        self.value = value
        self.label = label
    }
}

/// Flat verified-home card with overline, bold address, and a 3-stat row.
public struct HomeHeroHeader: View {
    private let address: String
    private let verified: Bool
    private let stats: [HomeHeroStat]

    public init(address: String, verified: Bool, stats: [HomeHeroStat]) {
        self.address = address
        self.verified = verified
        self.stats = stats
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s2) {
                Icon(.shieldCheck, size: 14, color: Theme.Color.home)
                Text(verified ? "VERIFIED HOME" : "UNVERIFIED HOME")
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.home)
            }
            Text(address)
                .pantopusTextStyle(.h2)
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(3)
                .accessibilityAddTraits(.isHeader)

            HStack(spacing: Spacing.s0) {
                ForEach(stats) { stat in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(stat.value)
                            .pantopusTextStyle(.h3)
                            .foregroundStyle(Theme.Color.appText)
                        Text(stat.label.uppercased())
                            .pantopusTextStyle(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.trailing, stat.id == stats.last?.id ? 0 : Spacing.s3)
                    .overlay(alignment: .trailing) {
                        if stat.id != stats.last?.id {
                            Rectangle()
                                .fill(Theme.Color.home.opacity(0.2))
                                .frame(width: 1)
                                .padding(.trailing, Spacing.s2)
                        }
                    }
                }
            }
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.homeBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous)
                .stroke(Theme.Color.home.opacity(0.18), lineWidth: 1)
        )
        .padding(.horizontal, Spacing.s4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(verified ? "Verified home" : "Unverified home"), \(address)")
    }
}

// MARK: - Concrete headers (moved out of this file)

//
// `PostAuthorHeaderStub` and `ProfileHeaderStub` were removed in P17 —
// their concrete implementations now live in
// `ContentDetail/Headers/PostAuthorHeader.swift` and
// `ContentDetail/Headers/ProfileHeader.swift`.
//
// `BusinessHeaderStub` and `WalletHeroStub` were likewise replaced by the
// concrete `BusinessHeader` and `WalletHeader` views under
// `ContentDetail/Headers/`, removing the last header NotYetAvailable
// placeholders.
