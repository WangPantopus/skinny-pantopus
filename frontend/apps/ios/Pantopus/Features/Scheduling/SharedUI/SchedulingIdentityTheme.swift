//
//  SchedulingIdentityTheme.swift
//  Pantopus
//
//  Foundation (I0b) — bridges a `SchedulingOwner` to the identity pillar accent
//  (Personal sky / Home green / Business violet) by reusing the shared
//  `WizardIdentity` tokens. Every Calendarly surface accents off the active
//  owner without touching hex. Functional controls stay product sky
//  (`Theme.Color.primary600`); only identity chrome uses the pillar accent.
//

import SwiftUI

/// Maps a `SchedulingOwner` to its identity-pillar theming. Consume this rather
/// than switching on the owner in feature code.
public struct SchedulingIdentityTheme: Sendable, Hashable {
    public let owner: SchedulingOwner

    public init(_ owner: SchedulingOwner) {
        self.owner = owner
    }

    /// The shared wizard identity that paints chrome to match the pillar.
    public var identity: WizardIdentity {
        switch owner {
        case .personal: .personal
        case .home: .home
        case .business: .business
        }
    }

    /// Primary pillar accent (Personal sky 0284C7 / Home green 16A34A /
    /// Business violet 7C3AED) — derived from the owner, never hardcoded.
    public var accent: Color {
        identity.accent
    }

    /// Lightest pillar tint — icon tiles, header gradients, selected slot fill.
    /// Alias `accentBg`; `softBg` is the preferred name on new surfaces.
    public var accentBg: Color {
        identity.accentBg
    }

    /// Soft pillar background — the framed-card fill, identity chip pill, and
    /// selected-state row tint. Same value as `accentBg`, named for the role.
    public var softBg: Color {
        identity.accentBg
    }

    /// 1px accent-tinted ring for soft cards / chips — the pillar accent at a
    /// low alpha so a tinted card reads as "this pillar" without a hard border.
    public var ring: Color {
        accent.opacity(0.2)
    }

    /// Tinted shadow under the pillar's primary CTA.
    public var ctaShadow: PantopusShadow {
        identity.ctaShadow
    }

    /// FIXED operational primary blue (0284C7) for host-side operational
    /// actions — Approve, the primary dock on bookings management, and other
    /// transactional CTAs that must NOT take the pillar accent. Same blue as the
    /// Personal pillar by design, but exposed as a stable, owner-independent
    /// token so a Home/Business host's Approve button stays blue, not green/
    /// violet. Consume `SchedulingIdentityTheme.operationalPrimary` directly.
    public static let operationalPrimary: Color = Theme.Color.primary600

    /// Tinted shadow for an operational (fixed-blue) primary CTA.
    public static let operationalPrimaryShadow: PantopusShadow = .primary

    /// Pillar label.
    public var title: String {
        switch owner {
        case .personal: "Personal"
        case .home: "Home"
        case .business: "Business"
        }
    }

    /// Pillar glyph. Personal = `user`, Home = `house`, Business = `briefcase`
    /// — the design's identity-pill glyph across the editors, event-types,
    /// onboarding and one-off-link surfaces. (The A1 Hub tile overrides to
    /// `store` locally, per `scheduling-hub-frames`.)
    public var icon: PantopusIcon {
        switch owner {
        case .personal: .user
        case .home: .house
        case .business: .briefcase
        }
    }
}

public extension SchedulingOwner {
    /// Convenience accessor for the owner's identity theming.
    var theme: SchedulingIdentityTheme {
        SchedulingIdentityTheme(self)
    }
}

#if DEBUG
#Preview {
    HStack(spacing: Spacing.s4) {
        ForEach([SchedulingOwner.personal, .home(homeId: "h"), .business(id: "b")], id: \.self) { owner in
            let theme = SchedulingIdentityTheme(owner)
            VStack(spacing: Spacing.s2) {
                ZStack {
                    Circle().fill(theme.accentBg).frame(width: 48, height: 48)
                    Icon(theme.icon, size: 22, color: theme.accent)
                }
                Text(theme.title).pantopusTextStyle(.small).foregroundStyle(theme.accent)
            }
        }
    }
    .padding()
    .background(Theme.Color.appBg)
}
#endif
