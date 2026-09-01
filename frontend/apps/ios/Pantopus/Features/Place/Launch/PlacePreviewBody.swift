//
//  PlacePreviewBody.swift
//  Pantopus
//
//  C0 — the anonymous T0 preview (the funnel's hook). Renders the free
//  Band-A subset live (flood, density bucket, area teaser) with locked
//  descriptors for everything recurring/exact, and a sticky "Create a
//  free account" wall. Ported from place-preview.jsx. A6 region body
//  lives here too. Reuses the Phase-2 archetype cards.
//

import SwiftUI

// swiftlint:disable line_length multiline_function_chains

struct PlacePreviewBody: View {
    let preview: PlacePreview
    var onSignIn: () -> Void
    var onCreateAccount: () -> Void
    var onBack: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    previewHero
                    if let free = preview.free {
                        freeSections(free)
                    }
                    if let locked = preview.locked, !locked.isEmpty {
                        lockedSections(locked)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 120)
            }
        }
        .overlay(alignment: .bottom) { wall }
    }

    private var header: some View {
        HStack(alignment: .top) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 20, strokeWidth: 2.5, color: Theme.Color.appTextStrong)
                    .frame(width: 34, height: 34).background(Theme.Color.appSurface).clipShape(Circle())
                    .shadow(color: .black.opacity(0.06), radius: 1, x: 0, y: 1)
            }
            .buttonStyle(.plain)
            VStack(alignment: .leading, spacing: 2) {
                Text("Your Place")
                    .font(.system(size: 22, weight: .bold))
                    .kerning(-0.4)
                    .foregroundStyle(Theme.Color.appText)
                if let address = preview.place?.address {
                    Text(address)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .lineLimit(1)
                }
            }
            .padding(.leading, 4)
            Spacer(minLength: 0)
            Button("Sign in", action: onSignIn)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.primary600)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    private var previewHero: some View {
        HStack(spacing: 11) {
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Theme.Color.homeBg)
                Icon(.check, size: 22, strokeWidth: 2.5, color: Theme.Color.home)
            }
            .frame(width: 44, height: 44)
            Text("Here's what's public about your address — a free, one-time look.")
                .font(.system(size: 14.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Spacer(minLength: 0)
        }
        .padding(14)
        .placeCard()
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    @ViewBuilder
    private func freeSections(_ free: PlacePreviewFree) -> some View {
        PlaceGroupLabel(text: "Risk & readiness").padding(.top, 18)
        PlaceSectionCard(
            icon: .waves,
            title: "Flood",
            state: free.flood.status == .ready ? .loaded : .unavailable,
            value: free.flood.description ?? free.flood.zone.map { "Zone \($0)" },
            chip: free.flood.zone != nil ? PlaceChipModel(tone: .success, text: free.flood.description ?? "Flood zone") : nil
        )

        PlaceGroupLabel(text: "Your block").padding(.top, 18)
        VStack(spacing: 8) {
            PlaceDensityCard(bucket: free.density.bucket, label: free.density.label, ctaTitle: nil, onTap: nil)
            if free.area.status == .ready {
                PlaceSectionCard(
                    icon: .home,
                    title: "Homes here",
                    state: .loaded,
                    value: free.area.medianYearBuilt.map { "Median built \($0)" } ?? free.area.note,
                    caption: free.area.note
                )
            }
        }
    }

    @ViewBuilder
    private func lockedSections(_ locked: [PlacePreviewLockedSection]) -> some View {
        PlaceGroupLabel(text: "More with a free account").padding(.top, 18)
        VStack(spacing: 8) {
            ForEach(locked) { section in
                PlaceLockedCard(
                    icon: lockedIcon(section),
                    title: section.title,
                    reason: section.reason,
                    cta: section.unlock == .claim ? "Claim home" : "Create account",
                    onTap: onCreateAccount
                )
            }
        }
    }

    private func lockedIcon(_ section: PlacePreviewLockedSection) -> PantopusIcon {
        switch section.group {
        case .today: .cloudSun
        case .yourHome: .home
        case .healthEnvironment: .droplets
        case .moneySignals: .zap
        case .civic: .landmark
        case .riskReadiness: .waves
        default: .mapPin
        }
    }

    private var wall: some View {
        VStack(spacing: 10) {
            Text("Create a free account to save this place and get daily updates")
                .font(.system(size: 14.5, weight: .semibold))
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.Color.appText)
            PrimaryButton(title: "Create account") { onCreateAccount() }
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, Spacing.s6)
        .frame(maxWidth: .infinity)
        .background(.bar)
        .overlay(alignment: .top) { Rectangle().fill(Theme.Color.appBorder).frame(height: 1) }
    }
}

// MARK: - A6 — coming to your region

struct PlaceComingRegionBody: View {
    let message: String
    var onBrowse: () -> Void
    var onBack: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button(action: onBack) {
                    Icon(.chevronLeft, size: 20, strokeWidth: 2.5, color: Theme.Color.appTextStrong)
                        .frame(width: 34, height: 34).background(Theme.Color.appSurface).clipShape(Circle())
                }
                .buttonStyle(.plain)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)

            Spacer(minLength: 0)
            VStack(spacing: 16) {
                ZStack {
                    Circle().fill(Theme.Color.homeBg).frame(width: 80, height: 80)
                    Icon(.mapPin, size: 34, strokeWidth: 2, color: Theme.Color.home)
                }
                Text("Home features are coming to your region.")
                    .font(.system(size: 24, weight: .bold))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.Color.appText)
                Text(message +
                    " Today, home intelligence reads off U.S. sources — county records, FEMA, the Census. Following, fanning, and messaging work in your region right now.")
                    .pantopusTextStyle(.small)
                    .multilineTextAlignment(.center)
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                PrimaryButton(title: "Follow people & places") { onBrowse() }
            }
            .padding(.horizontal, 28)
            Spacer(minLength: 0)
        }
        .background(Theme.Color.appBg)
    }
}
