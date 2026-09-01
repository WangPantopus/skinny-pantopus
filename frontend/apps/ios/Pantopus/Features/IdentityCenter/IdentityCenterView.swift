//
//  IdentityCenterView.swift
//  Pantopus
//
//  T3.2 Profiles & Privacy. Bespoke `identity_present` header
//  (4 cards) sits above grouped lists for Profile links / Privacy
//  rows / Disclosure items. The identity-switcher bottom sheet
//  surfaces via the trailing "Switch" button.
//

// swiftlint:disable type_body_length

import SwiftUI

public struct IdentityCenterView: View {
    @State private var viewModel: IdentityCenterViewModel
    @State private var switcherVisible = false
    private let onBack: @MainActor () -> Void
    private let onOpenIdentity: @MainActor (IdentityCardContent) -> Void
    private let onOpenRow: @MainActor (IdentityRowContent) -> Void

    init(
        viewModel: IdentityCenterViewModel = IdentityCenterViewModel(),
        onBack: @escaping @MainActor () -> Void = {},
        onOpenIdentity: @escaping @MainActor (IdentityCardContent) -> Void = { _ in },
        onOpenRow: @escaping @MainActor (IdentityRowContent) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onOpenIdentity = onOpenIdentity
        self.onOpenRow = onOpenRow
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            content
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.load() }
        .accessibilityIdentifier("identityCenter")
        .sheet(isPresented: $switcherVisible) {
            if case let .loaded(loaded) = viewModel.state {
                IdentitySwitcherSheet(
                    cards: loaded.identities.map { Self.switcherCard($0) },
                    onSelect: { _ in switcherVisible = false },
                    onClose: { switcherVisible = false }
                )
                .presentationDetents([.medium, .large])
            }
        }
    }

    private var topBar: some View {
        HStack {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("identityCenterBackButton")
            Spacer()
            Text("Profiles & Privacy")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            Button {
                switcherVisible = true
            } label: {
                Icon(.menu, size: 20, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open identity switcher")
            .accessibilityIdentifier("identityCenterSwitcherButton")
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 52)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading: loadingFrame
        case let .loaded(loaded): loadedFrame(loaded)
        case let .error(message): errorFrame(message: message)
        }
    }

    private var loadingFrame: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                ForEach(0..<4, id: \.self) { _ in
                    Shimmer(height: 110, cornerRadius: Radii.xl)
                        .padding(.horizontal, Spacing.s4)
                }
            }
            .padding(.vertical, Spacing.s4)
        }
        .accessibilityIdentifier("identityCenterLoading")
    }

    private func loadedFrame(_ loaded: IdentityCenterLoaded) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                identityCards(loaded.identities)
                sectionOverline("Profile links")
                if loaded.bridges.isEmpty {
                    emptyBridgesCard
                        .padding(.horizontal, Spacing.s3)
                } else {
                    bridgesCard(loaded.bridges)
                        .padding(.horizontal, Spacing.s3)
                }
                if loaded.setupRemainingCount > 0 {
                    firstRunHintCard(remaining: loaded.setupRemainingCount)
                        .padding(.horizontal, Spacing.s3)
                        .padding(.top, Spacing.s2)
                }
                sectionOverline("Privacy")
                rowsCard(loaded.privacyRows, idPrefix: "privacy")
                    .padding(.horizontal, Spacing.s3)
                sectionOverline("Identities")
                rowsCard(loaded.disclosureRows, idPrefix: "disclosure")
                    .padding(.horizontal, Spacing.s3)
                Spacer(minLength: Spacing.s6)
            }
        }
        .accessibilityIdentifier("identityCenterContent")
    }

    private func identityCards(_ cards: [IdentityCardContent]) -> some View {
        VStack(spacing: 10) {
            ForEach(cards) { card in
                Button {
                    onOpenIdentity(card)
                } label: {
                    identityCardBody(card)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("identityCard_\(card.kind.rawValue)")
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.top, 14)
    }

    private func identityCardBody(_ card: IdentityCardContent) -> some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                Circle()
                    .fill(card.kind.accentBg)
                    .frame(width: 44, height: 44)
                Icon(card.kind.icon, size: 22, strokeWidth: 2, color: card.kind.accent)
            }
            VStack(alignment: .leading, spacing: Spacing.s1) {
                HStack(spacing: 6) {
                    Text(card.overline.uppercased())
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(card.kind.accent)
                        .kerning(0.8)
                    if case let .setupNeeded(cta) = card.status {
                        Text(cta.uppercased())
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 1)
                            .background(card.kind.accent)
                            .clipShape(Capsule())
                    }
                    if let chip = card.chip {
                        Text(chip.label)
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(tone(chip.tone).fg)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 1)
                            .background(tone(chip.tone).bg)
                            .clipShape(Capsule())
                    }
                }
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(card.name)
                        .font(.system(size: 15.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    if let handle = card.handle {
                        Text(handle)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                    }
                }
                if let stats = card.stats {
                    Text(stats)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(2)
                }
                if let summary = card.summary {
                    Text(summary)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .lineLimit(2)
                        .padding(.top, 2)
                }
            }
            Spacer(minLength: Spacing.s0)
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextSecondary)
        }
        .padding(14)
        .background(
            LinearGradient(colors: [card.kind.accentBgSoft, Theme.Color.appSurface], startPoint: .top, endPoint: .bottom)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }

    private func bridgesCard(_ rows: [IdentityBridgeRow]) -> some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                HStack(alignment: .top, spacing: Spacing.s3) {
                    VStack(alignment: .leading, spacing: Spacing.s1) {
                        Text(row.label)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(Theme.Color.appText)
                        if let subtext = row.subtext {
                            Text(subtext)
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                    }
                    Spacer(minLength: Spacing.s0)
                    Toggle("", isOn: Binding(
                        get: { row.isOn },
                        set: { newValue in
                            Task { await viewModel.setBridge(row.id, isOn: newValue) }
                        }
                    ))
                    .labelsHidden()
                    .tint(Theme.Color.primary600)
                    .accessibilityIdentifier("identityCenterBridge_\(row.id)")
                }
                .padding(Spacing.s4)
                if index < rows.count - 1 {
                    Rectangle()
                        .fill(Theme.Color.appBorder.opacity(0.6))
                        .frame(height: 1)
                        .padding(.leading, Spacing.s4)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private var emptyBridgesCard: some View {
        HStack(spacing: Spacing.s3) {
            Icon(.link, size: 18, color: Theme.Color.appTextMuted)
                .frame(width: 24, height: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text("Nothing to link yet")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextMuted)
                Text("Set up Persona or Professional to connect profile links.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .lineLimit(2)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurfaceSunken)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("identityCenterEmptyBridges")
    }

    private func firstRunHintCard(remaining: Int) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(.info, size: 14, strokeWidth: 2.2, color: Theme.Color.primary600)
            Text(remaining == 1 ? "One more profile to go" : "\(remaining) more profiles to go")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Color.primary700)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.primary50)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.primary200, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("identityCenterFirstRunHint")
    }

    private func rowsCard(_ rows: [IdentityRowContent], idPrefix: String) -> some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                Button {
                    onOpenRow(row)
                } label: {
                    HStack(spacing: Spacing.s3) {
                        Icon(row.icon, size: 18, color: Theme.Color.primary600)
                            .frame(width: 24, height: 24)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(row.label)
                                .font(.system(size: 15, weight: .medium))
                                .foregroundStyle(Theme.Color.appText)
                            if let subtext = row.subtext {
                                Text(subtext)
                                    .pantopusTextStyle(.caption)
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                            }
                        }
                        Spacer(minLength: Spacing.s0)
                        if let trailing = row.trailing {
                            Text(trailing)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        Icon(.chevronRight, size: 16, color: Theme.Color.appTextSecondary)
                    }
                    .padding(.horizontal, Spacing.s4)
                    .padding(.vertical, 14)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("\(idPrefix)Row_\(row.id)")
                if index < rows.count - 1 {
                    Rectangle()
                        .fill(Theme.Color.appBorder.opacity(0.6))
                        .frame(height: 1)
                        .padding(.leading, Spacing.s4)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private func sectionOverline(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .kerning(0.9)
            .padding(.horizontal, Spacing.s4)
            .padding(.top, 18)
            .padding(.bottom, Spacing.s2)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func errorFrame(message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load Profiles & Privacy")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await viewModel.load() }
            } label: {
                Text("Try again")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, 22)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("identityCenterRetry")
            Spacer()
        }
        .padding(Spacing.s5)
        .accessibilityIdentifier("identityCenterError")
    }

    // MARK: - Helpers

    private static func switcherCard(_ card: IdentityCardContent) -> IdentitySwitcherCard {
        IdentitySwitcherCard(
            id: card.id,
            kind: card.kind,
            overline: card.overline,
            name: card.name,
            stats: card.stats,
            isActive: card.kind == .local
        )
    }

    private func tone(_ tone: ContentDetailPill.Tone) -> (bg: Color, fg: Color) {
        switch tone {
        case .info: (Theme.Color.primary50, Theme.Color.primary700)
        case .success: (Theme.Color.successBg, Theme.Color.success)
        case .warning: (Theme.Color.warningBg, Theme.Color.warning)
        case .business: (Theme.Color.businessBg, Theme.Color.business)
        case .neutral: (Theme.Color.appSurfaceSunken, Theme.Color.appTextStrong)
        case .error: (Theme.Color.errorBg, Theme.Color.error)
        }
    }
}

#Preview {
    IdentityCenterView()
}
