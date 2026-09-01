//
//  MailItemDetailState.swift
//  Pantopus
//
//  T6.5a (P19) — Typed slot payloads for the A17 Mailbox item detail
//  archetype shell. The shell at `MailItemDetailShell.swift` accepts
//  these as constructor inputs; variants (Generic, Booklet, Certified,
//  Community, Ceremonial) build the payloads and hand them in.
//
//  Slots in render order:
//    1. Top nav bar          (required — `MailTopBarConfig`)
//    2. Hero card            (generic View slot)
//    3. AI elf strip         (optional — `AIElfStripContent`)
//    4. Key facts panel      (generic View slot)
//    5. Body card            (generic View slot)
//    6. Attachments row      (optional — `AttachmentsRowContent`)
//    7. Sender card          (generic View slot)
//    8. Action buttons       (sticky bottom — generic View slot)
//
//  The shell is variant-agnostic. The only mail-domain knowledge it
//  carries is the AI elf strip + the attachments row, both of which
//  ≥ 4 of the 5 variants use (per the design files). Hero / KeyFacts /
//  Body / Sender / Actions are pure View slots so each variant can
//  build its own design without leaking that design into the shell.
//

import SwiftUI

// MARK: - Top bar

/// Trust level for the eyebrow dot on the top bar.
public enum MailDetailTrust: Sendable, Equatable {
    /// Verified sender — emerald dot.
    case verified
    /// Neutral — slate dot.
    case neutral
    /// Warning — amber dot.
    case warning
    /// Celebration / personal-invite — rose dot (A17.9 Party variant).
    case celebration

    /// Eyebrow dot foreground.
    public var dotColor: Color {
        switch self {
        case .verified: Theme.Color.success
        case .neutral: Theme.Color.appTextSecondary
        case .warning: Theme.Color.warning
        case .celebration: Theme.Color.categoryParty
        }
    }
}

/// One row in the overflow menu (Forward / Archive / Mark unread /
/// Delete / Report). Variants add or drop items as the design specs.
public struct MailOverflowItem: Identifiable, Sendable {
    public let id: String
    public let icon: PantopusIcon
    public let label: String
    public let isDestructive: Bool
    public let handler: @Sendable () -> Void

    public init(
        id: String,
        icon: PantopusIcon,
        label: String,
        isDestructive: Bool = false,
        handler: @escaping @Sendable () -> Void
    ) {
        self.id = id
        self.icon = icon
        self.label = label
        self.isDestructive = isDestructive
        self.handler = handler
    }
}

/// Trailing top-bar action that sits left of the overflow menu — used by
/// the design's bookmark / pin / save affordance on certain variants.
public struct MailTopBarTrailingAction: Sendable {
    public let icon: PantopusIcon
    public let accessibilityLabel: String
    public let isActive: Bool
    public let handler: @Sendable () -> Void

    public init(
        icon: PantopusIcon,
        accessibilityLabel: String,
        isActive: Bool = false,
        handler: @escaping @Sendable () -> Void
    ) {
        self.icon = icon
        self.accessibilityLabel = accessibilityLabel
        self.isActive = isActive
        self.handler = handler
    }
}

/// Required configuration for the top nav bar.
public struct MailTopBarConfig: Sendable {
    /// Lucide-style eyebrow label sandwiched between the back button and
    /// the actions cluster (uppercase, letter-spaced). Pass `nil` to
    /// show no eyebrow.
    public let eyebrow: String?
    /// Trust dot color in front of the eyebrow text.
    public let trust: MailDetailTrust
    /// "Back" callback. When `nil` the leading chevron is hidden.
    public let onBack: (@Sendable () -> Void)?
    /// Optional pre-overflow icon button (bookmark / pin / save).
    public let trailingAction: MailTopBarTrailingAction?
    /// Items rendered in the overflow menu. Empty = no menu button.
    public let overflowItems: [MailOverflowItem]

    public init(
        eyebrow: String?,
        trust: MailDetailTrust,
        onBack: (@Sendable () -> Void)? = nil,
        trailingAction: MailTopBarTrailingAction? = nil,
        overflowItems: [MailOverflowItem] = []
    ) {
        self.eyebrow = eyebrow
        self.trust = trust
        self.onBack = onBack
        self.trailingAction = trailingAction
        self.overflowItems = overflowItems
    }
}

// MARK: - AI elf strip

/// One bullet in the AI elf summary. Variants drive the icon + label +
/// inline text. The shell renders the bullet stack vertically.
public struct AIElfBullet: Identifiable, Sendable {
    public let id: String
    public let icon: PantopusIcon
    public let label: String
    public let text: String?

    public init(id: String = UUID().uuidString, icon: PantopusIcon, label: String, text: String? = nil) {
        self.id = id
        self.icon = icon
        self.label = label
        self.text = text
    }
}

/// Sparkles-headed extracted-info strip. Per `mail-detail.jsx:137`,
/// rendered as a sky-tinted gradient card with a sparkles disc + headline +
/// summary paragraph + bullet list, plus an optional trailing badge
/// (e.g. "2 min summary").
public struct AIElfStripContent: Sendable {
    /// Bold sentence at the top of the card. Defaults to
    /// "Pantopus read this for you".
    public let headline: String
    /// 1–3-sentence summary in the design's primary-tinted body color.
    public let summary: String
    /// Bullet list rendered below the summary. May be empty.
    public let bullets: [AIElfBullet]
    /// Optional trailing badge label (e.g. `2 min summary`).
    public let trailingBadge: String?
    /// Optional refresh / redo handler. When `nil` the redo affordance
    /// is hidden.
    public let onRedo: (@Sendable () -> Void)?

    public init(
        headline: String = "Pantopus read this for you",
        summary: String,
        bullets: [AIElfBullet] = [],
        trailingBadge: String? = nil,
        onRedo: (@Sendable () -> Void)? = nil
    ) {
        self.headline = headline
        self.summary = summary
        self.bullets = bullets
        self.trailingBadge = trailingBadge
        self.onRedo = onRedo
    }
}

// MARK: - Attachments

/// File kind drives the 36x44 thumbnail tile color + glyph.
public enum AttachmentKind: Sendable, Equatable {
    case pdf
    case image
    case video
    case link
    case audio
    case other
}

/// One row in the attachments list.
public struct AttachmentItem: Identifiable, Sendable {
    public let id: String
    public let kind: AttachmentKind
    public let name: String
    public let meta: String?
    public let onTap: @Sendable () -> Void

    public init(
        id: String,
        kind: AttachmentKind,
        name: String,
        meta: String? = nil,
        onTap: @escaping @Sendable () -> Void = {}
    ) {
        self.id = id
        self.kind = kind
        self.name = name
        self.meta = meta
        self.onTap = onTap
    }
}

/// Attachments section payload — title strip + list of items.
public struct AttachmentsRowContent: Sendable {
    /// Section title (defaults to "Attachments"). The shell renders an
    /// inline count next to it.
    public let title: String
    public let items: [AttachmentItem]

    public init(title: String = "Attachments", items: [AttachmentItem]) {
        self.title = title
        self.items = items
    }
}
