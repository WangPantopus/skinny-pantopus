//
//  ViewerPicker.swift
//  Pantopus
//
//  B1.3 — identity-preview primitive for A18.5 "View as".
//
//  A horizontally-scrollable selector of *viewer audiences* — the people
//  who might look at your profile — grouped under audience headers
//  (Persona audience · Personal · Home). Tapping a chip emits the chosen
//  `ViewerAudience`; the selected chip recolours to that audience's
//  identity pillar (reusing the shared `IdentityPillar` tint). The
//  design pack renders this as a single white chip-row band under the top
//  bar; we add the inline group headers the audit calls for so the three
//  audiences read as distinct clusters.
//
//  This file also ships `LiveBadge`, the small "LIVE" pill the View-As
//  preview banner stamps next to "Viewing as …" — kept here because it's
//  a one-line sibling of the picker and only A18.5 consumes it.
//
//  The screen itself (and its real privacy resolution) lands in B5.2;
//  this is the reusable chrome only.
//

import SwiftUI

// MARK: - Model

/// Which audience-pillar a viewer sits under. Drives the group header and
/// the selected-chip tint. Persona + Personal both read sky (they're the
/// personal-family identity); Home reads green.
public enum ViewerAudienceGroup: String, Sendable, CaseIterable, Identifiable, Hashable {
    case personaAudience
    case personal
    case home

    public var id: String {
        switch self {
        case .personaAudience: "persona_audience"
        case .personal: "personal"
        case .home: "home"
        }
    }

    /// Header label shown above the cluster.
    public var title: String {
        switch self {
        case .personaAudience: "Persona audience"
        case .personal: "Personal"
        case .home: "Home"
        }
    }

    /// Identity pillar that tints a selected chip in this group.
    public var pillar: IdentityPillar {
        switch self {
        case .personaAudience: .personal
        case .personal: .personal
        case .home: .home
        }
    }
}

/// A single viewer context you can preview your profile as. Membership,
/// order, labels and icons mirror `docs/designs/A18/view-as-frames.jsx`.
public enum ViewerAudience: Sendable, CaseIterable, Identifiable, Hashable {
    case `public`
    case personaAudience
    case neighbor
    case connection
    case gigParticipant
    case household

    /// Stable identifier — mirrored verbatim as the Android `testTag`
    /// suffix so cross-platform UI tests can target the same chip.
    public var id: String {
        switch self {
        case .public: "public"
        case .personaAudience: "persona_audience"
        case .neighbor: "neighbor"
        case .connection: "connection"
        case .gigParticipant: "gig_participant"
        case .household: "household"
        }
    }

    public var label: String {
        switch self {
        case .public: "Public"
        case .personaAudience: "Persona audience"
        case .neighbor: "Neighbor"
        case .connection: "Connection"
        case .gigParticipant: "Gig participant"
        case .household: "Household"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .public: .globe
        case .personaAudience: .megaphone
        case .neighbor: .mapPin
        case .connection: .userCheck
        case .gigParticipant: .briefcase
        case .household: .home
        }
    }

    /// Which header cluster this viewer sits under.
    public var group: ViewerAudienceGroup {
        switch self {
        case .public, .personaAudience, .neighbor: .personaAudience
        case .connection, .gigParticipant: .personal
        case .household: .home
        }
    }

    /// Pillar tint applied when this chip is selected.
    public var pillar: IdentityPillar {
        group.pillar
    }
}

/// One ordered cluster in the picker — a header plus its viewer chips.
public struct ViewerGroup: Identifiable, Sendable, Hashable {
    public let kind: ViewerAudienceGroup
    public let audiences: [ViewerAudience]

    public var id: String {
        kind.id
    }

    public init(kind: ViewerAudienceGroup, audiences: [ViewerAudience]) {
        self.kind = kind
        self.audiences = audiences
    }

    /// Default layout: the six A18.5 viewers under their three headers.
    public static let standard: [ViewerGroup] = [
        ViewerGroup(kind: .personaAudience, audiences: [.public, .personaAudience, .neighbor]),
        ViewerGroup(kind: .personal, audiences: [.connection, .gigParticipant]),
        ViewerGroup(kind: .home, audiences: [.household])
    ]
}

// MARK: - ViewerPicker

/// Horizontally-scrollable audience-chip selector for "View as".
@MainActor
public struct ViewerPicker: View {
    private let selection: ViewerAudience
    private let groups: [ViewerGroup]
    private let title: String?
    private let onSelect: (ViewerAudience) -> Void

    /// - Parameters:
    ///   - selection: The currently-previewed audience (its chip is tinted).
    ///   - groups: Ordered clusters. Defaults to the A18.5 standard set.
    ///   - title: Optional eyebrow above the row (e.g. "Preview your
    ///     profile as"). Hidden when nil.
    ///   - onSelect: Fired with the tapped audience.
    public init(
        selection: ViewerAudience,
        groups: [ViewerGroup] = ViewerGroup.standard,
        title: String? = nil,
        onSelect: @escaping (ViewerAudience) -> Void
    ) {
        self.selection = selection
        self.groups = groups
        self.title = title
        self.onSelect = onSelect
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if let title {
                HStack(spacing: Spacing.s1) {
                    Icon(.eye, size: 13, color: Theme.Color.appTextSecondary)
                    Text(title)
                        .pantopusTextStyle(.overline)
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                .padding(.horizontal, Spacing.s4)
                .accessibilityAddTraits(.isHeader)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s2) {
                    ForEach(Array(groups.enumerated()), id: \.element.id) { index, group in
                        Text(group.kind.title)
                            .pantopusTextStyle(.overline)
                            .foregroundStyle(Theme.Color.appTextMuted)
                            .padding(.leading, index == 0 ? Spacing.s0 : Spacing.s2)
                            .accessibilityHidden(true)

                        ForEach(group.audiences) { audience in
                            ViewerChip(
                                audience: audience,
                                isSelected: audience == selection
                            ) {
                                onSelect(audience)
                            }
                        }
                    }
                }
                .padding(.horizontal, Spacing.s4)
            }
        }
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(height: 1)
        }
        .accessibilityIdentifier("viewerPicker")
    }
}

/// One audience pill. Selected → pillar-tinted fill + inverse text;
/// otherwise surface + hairline border.
@MainActor
private struct ViewerChip: View {
    let audience: ViewerAudience
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s1) {
                Icon(
                    audience.icon,
                    size: 13,
                    strokeWidth: 2.3,
                    color: isSelected ? Theme.Color.appTextInverse : Theme.Color.appTextStrong
                )
                Text(audience.label)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(isSelected ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(height: 34)
            .background(
                Capsule(style: .continuous)
                    .fill(isSelected ? audience.pillar.color : Theme.Color.appSurface)
            )
            .overlay(
                Capsule(style: .continuous)
                    .strokeBorder(
                        isSelected ? audience.pillar.color : Theme.Color.appBorder,
                        lineWidth: 1.5
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("View as \(audience.label)")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("viewerPicker_chip_\(audience.id)")
    }
}

// MARK: - LiveBadge

/// The small "LIVE" pill stamped beside "Viewing as …" on A18.5. A dot +
/// uppercase label in a bordered surface capsule. Static (no pulse) so
/// snapshots stay deterministic.
@MainActor
public struct LiveBadge: View {
    private let label: String
    private let tone: Color

    public init(label: String = "Live", tone: Color = Theme.Color.success) {
        self.label = label
        self.tone = tone
    }

    public var body: some View {
        HStack(spacing: Spacing.s1) {
            Circle()
                .fill(tone)
                .frame(width: 6, height: 6)
            Text(label)
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextStrong)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(
            Capsule(style: .continuous).fill(Theme.Color.appSurface)
        )
        .overlay(
            Capsule(style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityIdentifier("liveBadge")
    }
}

// MARK: - Preview

#Preview("ViewerPicker") {
    struct Harness: View {
        @State private var selection: ViewerAudience = .connection
        var body: some View {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                ViewerPicker(selection: selection, title: "Preview your profile as") {
                    selection = $0
                }
                HStack(spacing: Spacing.s2) {
                    LiveBadge()
                    LiveBadge(label: "Preview", tone: Theme.Color.warning)
                }
                .padding(.horizontal, Spacing.s4)
                Text("Selected: \(selection.label)")
                    .font(.system(size: 13))
                    .padding(.horizontal, Spacing.s4)
            }
            .background(Theme.Color.appBg)
        }
    }
    return Harness()
}
