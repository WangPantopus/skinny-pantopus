//
//  ViewAsContent.swift
//  Pantopus
//
//  B5.2 (A18.5) — render-only models for the "View as" identity preview.
//  The screen renders YOUR profile as a chosen `ViewerAudience` would see
//  it, redacting whatever that audience can't. The visible/redacted matrix
//  is sample-data driven (see `ViewAsSampleData`), mirroring the A14.7
//  privacy model — real per-field resolution from the backend is out of
//  scope for this pass.
//
//  Slot vocabulary follows `docs/designs/A18/view-as-frames.jsx`:
//    PreviewBannerVA → `ViewAsBanner`, ProfileHeadVA → `ViewAsHead`,
//    VBadge → `ViewAsBadge`, FieldVA → `ViewAsField`, the shared-context /
//    restricted strip → `ViewAsContextNote`, PrivacyFooterVA → `footerText`.
//

import SwiftUI

// MARK: - Tone

/// Banner / context-note tint. `info` (sky) reads "this is what they see";
/// `restricted` (amber) reads "most details are hidden".
public enum ViewAsTone: String, Sendable, Hashable {
    case info
    case restricted
}

// MARK: - Avatar + identity

/// How the avatar disc is tinted. `masked` is the de-identified grey wash
/// the public sees; `personal` / `home` paint the identity-pillar gradient.
public enum ViewAsAvatarTone: String, Sendable, Hashable {
    case personal
    case home
    case masked

    /// Two-stop gradient drawn behind the initials. All stops are tokens.
    var gradient: [Color] {
        switch self {
        case .personal: [Theme.Color.primary400, Theme.Color.primary700]
        case .home: [Theme.Color.home, Theme.Color.success]
        case .masked: [Theme.Color.appTextMuted, Theme.Color.appTextSecondary]
        }
    }
}

/// The identity pill rendered under the name (design `idMap`).
public enum ViewAsIdentityPill: String, Sendable, Hashable {
    case personal
    case home

    var label: String {
        switch self {
        case .personal: "Personal"
        case .home: "Home"
        }
    }

    var foreground: Color {
        switch self {
        case .personal: Theme.Color.personal
        case .home: Theme.Color.home
        }
    }

    var background: Color {
        switch self {
        case .personal: Theme.Color.personalBg
        case .home: Theme.Color.homeBg
        }
    }
}

// MARK: - Field disclosure

/// What the previewed viewer is allowed to see for one field. Mirrors the
/// A14.7 granularity ladder: a precise value, a coarsened ("approximate")
/// value that still reads, or a fully-withheld field that renders behind a
/// `RedactionScrim`.
public enum ViewAsFieldDisclosure: Sendable, Hashable {
    case visible(String)
    case coarse(String)
    case hidden

    public var isHidden: Bool {
        if case .hidden = self {
            return true
        }
        return false
    }

    /// The string shown when the field is (coarsely or fully) visible.
    public var shownValue: String? {
        switch self {
        case let .visible(value): value
        case let .coarse(value): value
        case .hidden: nil
        }
    }
}

/// One labelled row in the preview render.
public struct ViewAsField: Sendable, Hashable, Identifiable {
    public let id: String
    public let icon: PantopusIcon
    public let label: String
    public let disclosure: ViewAsFieldDisclosure

    public init(id: String, icon: PantopusIcon, label: String, disclosure: ViewAsFieldDisclosure) {
        self.id = id
        self.icon = icon
        self.label = label
        self.disclosure = disclosure
    }
}

// MARK: - Verification badge

/// A verification pill (`VBadge`). `isOn` shows the trust signal in green;
/// off renders a greyed lock chip ("ID verified" the public can't confirm).
public struct ViewAsBadge: Sendable, Hashable, Identifiable {
    public let id: String
    public let icon: PantopusIcon
    public let label: String
    public let isOn: Bool

    public init(id: String, icon: PantopusIcon, label: String, isOn: Bool) {
        self.id = id
        self.icon = icon
        self.label = label
        self.isOn = isOn
    }
}

// MARK: - Banner + context note

/// "Viewing as {x}" banner stamped above the render, with a Live badge.
public struct ViewAsBanner: Sendable, Hashable {
    public let icon: PantopusIcon
    public let viewerLabel: String
    public let subtitle: String
    public let tone: ViewAsTone

    public init(icon: PantopusIcon, viewerLabel: String, subtitle: String, tone: ViewAsTone) {
        self.icon = icon
        self.viewerLabel = viewerLabel
        self.subtitle = subtitle
        self.tone = tone
    }
}

/// The shared-context (info) / restricted (amber) strip below the fields.
public struct ViewAsContextNote: Sendable, Hashable {
    public let icon: PantopusIcon
    public let text: String
    public let tone: ViewAsTone

    public init(icon: PantopusIcon, text: String, tone: ViewAsTone) {
        self.icon = icon
        self.text = text
        self.tone = tone
    }
}

// MARK: - Profile head

/// Avatar + name + handle + identity pill inside the render.
public struct ViewAsHead: Sendable, Hashable {
    public let name: String
    public let handle: String?
    public let initials: String
    public let avatarTone: ViewAsAvatarTone
    public let identity: ViewAsIdentityPill
    public let verified: Bool

    public init(
        name: String,
        handle: String?,
        initials: String,
        avatarTone: ViewAsAvatarTone,
        identity: ViewAsIdentityPill,
        verified: Bool
    ) {
        self.name = name
        self.handle = handle
        self.initials = initials
        self.avatarTone = avatarTone
        self.identity = identity
        self.verified = verified
    }
}

// MARK: - Render

/// The fully-resolved profile render for one previewed viewer. Switching
/// the picker swaps the whole `ViewAsRender`, re-resolving banner tone,
/// badges and field redaction in one shot.
public struct ViewAsRender: Sendable, Hashable, Identifiable {
    public let viewer: ViewerAudience
    public let banner: ViewAsBanner
    public let head: ViewAsHead
    public let badges: [ViewAsBadge]
    public let fields: [ViewAsField]
    public let note: ViewAsContextNote
    /// Privacy-footer copy preceding the bold "Manage privacy" link.
    public let footerText: String

    public var id: String {
        viewer.id
    }

    public init(
        viewer: ViewerAudience,
        banner: ViewAsBanner,
        head: ViewAsHead,
        badges: [ViewAsBadge],
        fields: [ViewAsField],
        note: ViewAsContextNote,
        footerText: String
    ) {
        self.viewer = viewer
        self.banner = banner
        self.head = head
        self.badges = badges
        self.fields = fields
        self.note = note
        self.footerText = footerText
    }
}

// MARK: - State

/// Top-level render state. The screen ships a loading (shimmer) frame and
/// the resolved preview; there's no empty/error path because the data is
/// local sample content, not a fetch.
public enum ViewAsState: Sendable {
    case loading
    case loaded(ViewAsLoaded)
}

public struct ViewAsLoaded: Sendable, Hashable {
    public let selected: ViewerAudience
    public let render: ViewAsRender

    public init(selected: ViewerAudience, render: ViewAsRender) {
        self.selected = selected
        self.render = render
    }
}
