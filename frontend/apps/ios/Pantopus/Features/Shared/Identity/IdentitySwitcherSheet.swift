//
//  IdentitySwitcherSheet.swift
//  Pantopus
//
//  Bottom-sheet identity switcher used by Profiles & Privacy
//  ("Identity Center"). Reuses the IdentityOption color tokens from
//  the Me tab so any future surface that needs the same switcher
//  has one source of truth. The pill-row variant ships separately
//  at `IdentitySwitcherPillRow.swift`; this sheet is the richer
//  presentation with full card summaries.
//

import SwiftUI

/// One card inside the switcher sheet.
public struct IdentitySwitcherCard: Sendable, Hashable, Identifiable {
    public let id: String
    public let kind: IdentityKind
    public let overline: String
    public let name: String
    public let stats: String?
    public let isActive: Bool

    public init(
        id: String,
        kind: IdentityKind,
        overline: String,
        name: String,
        stats: String? = nil,
        isActive: Bool = false
    ) {
        self.id = id
        self.kind = kind
        self.overline = overline
        self.name = name
        self.stats = stats
        self.isActive = isActive
    }
}

/// Presentation-modal-friendly sheet body. Host wraps it in
/// `.sheet(isPresented:)` and supplies `.presentationDetents([.medium])`
/// (or the design's `.fraction(0.55)`).
public struct IdentitySwitcherSheet: View {
    private let cards: [IdentitySwitcherCard]
    private let onSelect: @MainActor (IdentitySwitcherCard) -> Void
    private let onClose: @MainActor () -> Void

    public init(
        cards: [IdentitySwitcherCard],
        onSelect: @escaping @MainActor (IdentitySwitcherCard) -> Void,
        onClose: @escaping @MainActor () -> Void = {}
    ) {
        self.cards = cards
        self.onSelect = onSelect
        self.onClose = onClose
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            handle
            Text("Identity switcher")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s1)
                .padding(.bottom, Spacing.s1)
                .accessibilityAddTraits(.isHeader)
            Text("Pick the face you want active in feeds, composer, and chat.")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, 14)
            ScrollView {
                VStack(spacing: 10) {
                    ForEach(cards) { card in
                        Button {
                            onSelect(card)
                        } label: {
                            cardBody(card)
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("identitySwitcherCard_\(card.kind.rawValue)")
                        .accessibilityAddTraits(card.isActive ? [.isButton, .isSelected] : .isButton)
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, Spacing.s6)
            }
        }
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("identitySwitcherSheet")
    }

    private var handle: some View {
        Capsule()
            .fill(Theme.Color.appBorder)
            .frame(width: 40, height: 4)
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s3)
            .frame(maxWidth: .infinity)
            .accessibilityHidden(true)
    }

    private func cardBody(_ card: IdentitySwitcherCard) -> some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            ZStack {
                Circle()
                    .fill(card.kind.accentBg)
                    .frame(width: 44, height: 44)
                Icon(card.kind.icon, size: 22, strokeWidth: 2, color: card.kind.accent)
            }
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(card.overline.uppercased())
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(card.kind.accent)
                        .kerning(0.8)
                    if card.isActive {
                        Text("Active".uppercased())
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 1)
                            .background(card.kind.accent)
                            .clipShape(Capsule())
                    }
                }
                Text(card.name)
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                if let stats = card.stats {
                    Text(stats)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: Spacing.s0)
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextSecondary)
        }
        .padding(14)
        .background(card.isActive ? card.kind.accentBg : Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(card.isActive ? card.kind.accent : Theme.Color.appBorder, lineWidth: card.isActive ? 2 : 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

#Preview {
    IdentitySwitcherSheet(
        cards: [
            IdentitySwitcherCard(
                id: "l",
                kind: .local,
                overline: "Local Profile",
                name: "Maria K.",
                stats: "47 posts · 23 connections",
                isActive: true
            ),
            IdentitySwitcherCard(id: "p", kind: .personal, overline: "Personal", name: "maria.k@email.com", stats: "Account · verified"),
            IdentitySwitcherCard(
                id: "pp",
                kind: .publicProfile,
                overline: "Public profile",
                name: "Maria the Mason",
                stats: "1,247 followers · weekly"
            )
        ]
    ) { _ in }
}
