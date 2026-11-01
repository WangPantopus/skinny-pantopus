//
//  PlaceHomeCard.swift
//  Pantopus
//
//  The home at the top of Your Place (the November 2026 redesign): where
//  the person stands here in words, the address, the home's known facts
//  from its record with the record's date and source, and the household's
//  tools under them. Unknown facts are left out, never guessed; a record the
//  viewer can't see yet says why, with the same verify or claim step as the
//  sections. Parity twin of Android `PlaceHomeCard`.
//

import SwiftUI

struct PlaceHomeCard: View {
    let intel: PlaceIntelligence
    /// A claim on this Home is in review: its public view, no household tools.
    let claimInReview: Bool
    let shortcuts: [PlaceHomeShortcut]
    /// Verify (or claim) for a record behind a lock; nil when this viewer can't.
    let onUnlock: (() -> Void)?
    /// Before verification: the verify step's sentence and button (the same sheet).
    let showsVerify: Bool
    let onOpenTools: () -> Void
    let onShortcut: (PlaceHomeShortcut) -> Void
    @Environment(\.dynamicTypeSize) private var typeSize

    private var yourHome: PlaceSectionEnvelope? {
        intel.groups.flatMap(\.sections).first { $0.id == .yourHome }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            standing
                .padding(.bottom, 10)
            if showsVerify, let onUnlock {
                verifyLine(onUnlock)
                    .padding(.bottom, 12)
            }
            Text(intel.place.line1.isEmpty ? intel.place.label : intel.place.line1)
                .font(.system(size: 22, weight: .semibold))
                .kerning(-0.4)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            if !cityLine.isEmpty {
                Text(cityLine)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.top, 2)
            }
            record
                .padding(.top, 14)
            if !claimInReview {
                PlaceRowDivider().padding(.top, 14)
                tools.padding(.top, 10)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("place.homeCard")
    }

    private var cityLine: String {
        [intel.place.city, intel.place.state].filter { !$0.isEmpty }.joined(separator: ", ")
    }

    // MARK: Where the person stands

    /// "Verified home", "Claimed · verify to see more", "Private setup · only you".
    private var standing: some View {
        let words = Self.standingWords(intel, claimInReview: claimInReview)
        return HStack(spacing: 5) {
            Icon(words.icon, size: 13, strokeWidth: 2.25, color: words.verified ? Theme.Color.home : Theme.Color.appTextSecondary)
            Text(words.text)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(words.verified ? Theme.Color.home : Theme.Color.appTextSecondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("place.homeCard.standing")
    }

    struct Standing {
        let text: String
        let icon: PantopusIcon
        let verified: Bool
    }

    static func standingWords(_ intel: PlaceIntelligence, claimInReview: Bool) -> Standing {
        if claimInReview { return Standing(text: "Claim in review · public view", icon: .clock, verified: false) }
        if intel.viewer?.role == "nonresident" { return Standing(text: "Guest access · public facts", icon: .users, verified: false) }
        switch intel.tier {
        case .t4: return Standing(text: "Verified home", icon: .shieldCheck, verified: true)
        case .t3: return Standing(text: "Claimed · verify to see more", icon: .home, verified: false)
        default: return Standing(text: "Private setup · only you", icon: .lock, verified: false)
        }
    }

    /// "Verify your address to message neighbors and get your badge." and its button.
    private func verifyLine(_ verify: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Verify your address to message neighbors and get your badge.")
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
            PlaceTextButton(title: "Verify address", minHeight: 44, action: verify)
                .accessibilityIdentifier("place.verifyBanner")
        }
        .accessibilityElement(children: .contain)
    }

    // MARK: The record

    @ViewBuilder
    private var record: some View {
        if let env = yourHome {
            if let data = env.yourHome, env.access != .locked, env.status == .ready || env.status == .stale {
                facts(data, env: env)
            } else if env.access == .locked {
                lockedLine(env)
            } else {
                Text(env.unavailableReason ?? "This home's record isn't available for this address yet.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func facts(_ data: PlaceYourHomeData, env: PlaceSectionEnvelope) -> some View {
        let items = Self.facts(data)
        // Up to three facts side by side; four as two rows of two, so none wraps mid-value.
        let columns = typeSize.isAccessibilitySize ? 1 : (items.count == 4 ? 2 : min(max(items.count, 1), 3))
        return VStack(alignment: .leading, spacing: 10) {
            if !items.isEmpty {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10, alignment: .leading), count: columns), spacing: 10) {
                    ForEach(items, id: \.label) { fact in
                        VStack(alignment: .leading, spacing: 1) {
                            Text(fact.value)
                                .font(.system(size: 18, weight: .medium))
                                .monospacedDigit()
                                .foregroundStyle(Theme.Color.appText)
                            Text(fact.label)
                                .font(.system(size: 11.5))
                                .foregroundStyle(Theme.Color.appTextMuted)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
            // "County public records · Record Oct 2026": where the facts came from, and when.
            Text([env.source, PlacePresentation.fmtMonthYear(env.asOf).map { "Record \($0)" }].compactMap { $0 }.joined(separator: " · "))
                .font(Theme.Font.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// Up to four known facts; anything the record doesn't say is left out.
    static func facts(_ data: PlaceYourHomeData) -> [(label: String, value: String)] {
        var out: [(label: String, value: String)] = []
        if let year = data.yearBuilt { out.append(("Year built", String(year))) }
        if let sqft = data.sqft { out.append(("Square feet", PlacePresentation.grouped(sqft))) }
        let bed = data.bedrooms.map { "\($0) bd" }
        let bath = data.bathrooms.map { $0 == $0.rounded() ? "\(Int($0)) ba" : String(format: "%.1f ba", $0) }
        let rooms = [bed, bath].compactMap { $0 }
        if !rooms.isEmpty { out.append(("Beds and baths", rooms.joined(separator: " · "))) }
        if let lot = data.lotSqft { out.append(("Lot size", "\(PlacePresentation.grouped(lot)) sq ft")) }
        return Array(out.prefix(4))
    }

    private func lockedLine(_ env: PlaceSectionEnvelope) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Icon(.lock, size: 13, strokeWidth: 2.25, color: Theme.Color.appTextMuted)
                Text(PlacePresentation.lockReason(env))
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            // The verify line above already offers the same step.
            if let onUnlock, !showsVerify {
                PlaceTextButton(title: PlacePresentation.lockCta(env.band, verifiesFirst: intel.verifiesFirst), minHeight: 44) {
                    onUnlock()
                }
            }
        }
        .accessibilityElement(children: .contain)
    }

    // MARK: Tools

    /// One shortcut is a row, several a strip; "All tools" opens Home tools.
    @ViewBuilder
    private var tools: some View {
        switch shortcuts.count {
        case 0:
            toolRow(
                icon: .house,
                title: "Home tools",
                subtitle: "Tasks and tools for your household.",
                identifier: "place.homeTools",
                action: onOpenTools
            )
        case 1:
            let only = shortcuts[0]
            VStack(alignment: .leading, spacing: 0) {
                toolRow(icon: only.icon, title: only.title, subtitle: nil, identifier: "place.homeTools.\(only.rawValue)") {
                    onShortcut(only)
                }
                allTools
            }
        default:
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    ForEach(shortcuts, id: \.self) { shortcut in
                        Button { onShortcut(shortcut) } label: {
                            VStack(spacing: 5) {
                                Icon(shortcut.icon, size: 17, strokeWidth: 2, color: Theme.Color.appTextStrong)
                                Text(shortcut.title)
                                    .font(.system(size: 11.5, weight: .medium))
                                    .foregroundStyle(Theme.Color.appTextStrong)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.8)
                            }
                            .frame(maxWidth: .infinity, minHeight: 52)
                            .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Theme.Color.appBg))
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("place.homeTools.\(shortcut.rawValue)")
                    }
                }
                allTools
            }
        }
    }

    private var allTools: some View {
        PlaceInlineAction(title: "All tools", identifier: "place.homeTools", action: onOpenTools)
            .accessibilityHint("Opens Home tools.")
    }

    private func toolRow(
        icon: PantopusIcon,
        title: String,
        subtitle: String?,
        identifier: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 11) {
                Icon(icon, size: 18, strokeWidth: 2, color: Theme.Color.appTextStrong)
                    .frame(width: 32, height: 32)
                    .background(RoundedRectangle(cornerRadius: 9, style: .continuous).fill(Theme.Color.appBg))
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    if let subtitle {
                        Text(subtitle)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                PlaceChevron()
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier(identifier)
    }
}
