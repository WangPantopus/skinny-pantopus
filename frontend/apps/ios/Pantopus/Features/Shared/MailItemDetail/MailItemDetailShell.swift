//
//  MailItemDetailShell.swift
//  Pantopus
//
//  T6.5a (P19) — A17 Mailbox item detail archetype shell. Sibling
//  archetype to `ContentDetailShell`, specialized for mail item detail
//  screens. P20–P23 will compose every variant (Generic, Booklet,
//  Certified, Community, Ceremonial) on top of this.
//
//  Anatomy (top → bottom):
//    1. Top nav bar           (required — `MailTopBarConfig`)
//    2. Hero card slot        (generic `View`)
//    3. AI elf strip          (optional — `AIElfStripContent`)
//    4. Key facts slot        (generic `View`)
//    5. Body slot             (generic `View`)
//    6. Attachments row       (optional — `AttachmentsRowContent`)
//    7. Sender slot           (generic `View`)
//    8. Action buttons slot   (generic `View` — pinned at the bottom)
//
//  The shell owns:
//    - top bar layout + back chevron + eyebrow trust dot + overflow menu
//    - vertical spacing + horizontal padding for the scroll body
//    - AI elf strip rendering (sky gradient + sparkles disc + bullets)
//    - attachments list rendering (PDF / image / video / link tiles)
//    - sticky action buttons shelf above the system tab bar
//
//  Every screen-specific design — the hero gradient by trust level, the
//  key-facts panel, the body card, the sender card, the variant-specific
//  action affordances — lives in the **variant feature folder**. Per the
//  P19 brief, the shell only absorbs additive extensions when a slot is
//  used by ≥ 2 variants; for now the AI elf strip and attachments row
//  meet that bar (used by all 4 detail variants per the design files).
//

import SwiftUI

// swiftlint:disable file_length multiple_closures_with_trailing_closure

/// Archetype shell. Generic over five View slots so concrete screens can
/// drop in arbitrary hero / key-facts / body / sender / actions designs
/// without leaking that view's type into the shell. Default `Header`
/// types are `EmptyView` so callers can omit any slot they don't need.
@MainActor
public struct MailItemDetailShell<
    Hero: View,
    KeyFacts: View,
    Body: View,
    Sender: View,
    Actions: View
>: View {
    private let topBar: MailTopBarConfig
    private let heroContent: Hero
    private let aiElf: AIElfStripContent?
    private let keyFactsContent: KeyFacts
    private let bodyContent: Body
    private let attachments: AttachmentsRowContent?
    private let senderContent: Sender
    private let actionsContent: Actions

    public init(
        topBar: MailTopBarConfig,
        aiElf: AIElfStripContent? = nil,
        attachments: AttachmentsRowContent? = nil,
        @ViewBuilder hero: () -> Hero,
        @ViewBuilder keyFacts: () -> KeyFacts = { EmptyView() },
        @ViewBuilder body: () -> Body = { EmptyView() },
        @ViewBuilder sender: () -> Sender = { EmptyView() },
        @ViewBuilder actions: () -> Actions = { EmptyView() }
    ) {
        self.topBar = topBar
        self.aiElf = aiElf
        self.attachments = attachments
        heroContent = hero()
        keyFactsContent = keyFacts()
        bodyContent = body()
        senderContent = sender()
        actionsContent = actions()
    }

    public var body: some View {
        ZStack(alignment: .bottom) {
            VStack(spacing: Spacing.s0) {
                MailItemDetailTopBar(config: topBar)
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.s3) {
                        heroContent
                            .accessibilityIdentifier("mailItemDetail_hero")
                        if let aiElf {
                            AIElfStripView(content: aiElf)
                                .accessibilityIdentifier("mailItemDetail_aiElf")
                        }
                        keyFactsSection
                        bodySection
                        if let attachments {
                            AttachmentsRowView(content: attachments)
                                .accessibilityIdentifier("mailItemDetail_attachments")
                        }
                        senderSection
                        Spacer(minLength: actionsBottomInset)
                    }
                    .padding(.horizontal, Spacing.s4)
                    .padding(.top, Spacing.s3)
                    .padding(.bottom, Spacing.s10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .background(Theme.Color.appBg)
            }
            actionsShelf
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("mailItemDetailShell")
    }

    /// SwiftUI's @ViewBuilder doesn't have a clean way to ask "is this
    /// view EmptyView?" so we ship the slot unconditionally — EmptyView
    /// renders nothing, costs nothing.
    private var keyFactsSection: some View {
        keyFactsContent
            .accessibilityIdentifier("mailItemDetail_keyFacts")
    }

    private var bodySection: some View {
        bodyContent
            .accessibilityIdentifier("mailItemDetail_body")
    }

    private var senderSection: some View {
        senderContent
            .accessibilityIdentifier("mailItemDetail_sender")
    }

    private var actionsShelf: some View {
        actionsContent
            .accessibilityIdentifier("mailItemDetail_actions")
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s4)
            .padding(.top, Spacing.s3)
            .frame(maxWidth: .infinity)
            .background(actionsShelfBackground)
    }

    /// When the actions slot is `EmptyView` (`Actions == EmptyView`) the
    /// shelf-background overlay would leave a stray rectangle at the
    /// bottom — `Actions.self == EmptyView.self` is the cheapest gate.
    @ViewBuilder private var actionsShelfBackground: some View {
        if Actions.self == EmptyView.self {
            EmptyView()
        } else {
            Theme.Color.appSurface
                .overlay(alignment: .top) {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                }
                .ignoresSafeArea(edges: .bottom)
        }
    }

    /// Leave room below the last card so the sticky actions shelf
    /// doesn't cover content. Zero when there's no shelf.
    private var actionsBottomInset: CGFloat {
        Actions.self == EmptyView.self ? Spacing.s4 : Spacing.s16
    }
}

/// Convenience init for the common minimal case (hero only — no key
/// facts, body, sender, or actions yet). Lets P19 acceptance test
/// "only required slots present" call the shell with one slot.
public extension MailItemDetailShell
    where KeyFacts == EmptyView,
    Body == EmptyView,
    Sender == EmptyView,
    Actions == EmptyView {
    init(
        topBar: MailTopBarConfig,
        aiElf: AIElfStripContent? = nil,
        attachments: AttachmentsRowContent? = nil,
        @ViewBuilder hero: () -> Hero
    ) {
        self.init(
            topBar: topBar,
            aiElf: aiElf,
            attachments: attachments,
            hero: hero,
            keyFacts: { EmptyView() },
            body: { EmptyView() },
            sender: { EmptyView() },
            actions: { EmptyView() }
        )
    }
}

// MARK: - Top bar

/// 44pt nav bar — back chevron (with optional "Mailbox" label) + eyebrow
/// trust dot + overflow menu. Mirrors `mail-detail.jsx:7-39`.
public struct MailItemDetailTopBar: View {
    public let config: MailTopBarConfig

    public init(config: MailTopBarConfig) {
        self.config = config
    }

    public var body: some View {
        HStack(spacing: Spacing.s2) {
            backButton
            Spacer()
            eyebrow
            Spacer()
            trailingCluster
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 44)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .accessibilityIdentifier("mailItemDetail_topBar")
    }

    @ViewBuilder private var backButton: some View {
        if let onBack = config.onBack {
            Button(action: { onBack() }) {
                HStack(spacing: Spacing.s0) {
                    Icon(.chevronLeft, size: 22, color: Theme.Color.primary600)
                    Text("Mailbox")
                        .font(.system(size: 15, weight: .regular))
                        .foregroundStyle(Theme.Color.primary600)
                }
                .padding(.horizontal, Spacing.s1)
                .frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back to Mailbox")
            .accessibilityIdentifier("mailItemDetail_back")
        } else {
            Spacer().frame(width: 44, height: 44)
        }
    }

    @ViewBuilder private var eyebrow: some View {
        if let label = config.eyebrow {
            HStack(spacing: Spacing.s1) {
                Circle()
                    .fill(config.trust.dotColor)
                    .frame(width: 8, height: 8)
                Text(label.uppercased())
                    .font(.system(size: 12, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("mailItemDetail_eyebrow")
        }
    }

    private var trailingCluster: some View {
        HStack(spacing: 2) {
            if let trailing = config.trailingAction {
                Button(action: { trailing.handler() }) {
                    Icon(
                        trailing.icon,
                        size: 18,
                        color: trailing.isActive ? Theme.Color.primary600 : Theme.Color.appTextStrong
                    )
                    .frame(width: 34, height: 34)
                    .background(
                        Circle().fill(
                            trailing.isActive ? Theme.Color.primary100 : Theme.Color.appSurfaceSunken
                        )
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(trailing.accessibilityLabel)
                .accessibilityIdentifier("mailItemDetail_trailingAction")
            }
            if !config.overflowItems.isEmpty {
                Menu {
                    ForEach(config.overflowItems) { item in
                        Button(role: item.isDestructive ? .destructive : nil) {
                            item.handler()
                        } label: {
                            Label(item.label, systemImage: item.icon.sfSymbolName)
                        }
                    }
                } label: {
                    Icon(.moreHorizontal, size: 18, color: Theme.Color.appTextStrong)
                        .frame(width: 34, height: 34)
                        .background(Circle().fill(Theme.Color.appSurfaceSunken))
                }
                .accessibilityLabel("More actions")
                .accessibilityIdentifier("mailItemDetail_overflow")
            }
        }
    }
}

// MARK: - AI elf strip renderer

/// Sky-gradient extracted-info card. Renders `AIElfStripContent` per the
/// `ElfStrip` block in `mail-detail.jsx:137-198`.
public struct AIElfStripView: View {
    public let content: AIElfStripContent

    public init(content: AIElfStripContent) {
        self.content = content
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .center, spacing: Spacing.s2) {
                Icon(.sparkles, size: 13, color: Theme.Color.appTextInverse)
                    .frame(width: 24, height: 24)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                Text(content.headline)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.primary800)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if let badge = content.trailingBadge {
                    Text(badge)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Theme.Color.primary700)
                        .padding(.horizontal, Spacing.s2)
                        .padding(.vertical, 2)
                        .background(Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.pill)
                                .stroke(Theme.Color.primary100, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
                        .accessibilityIdentifier("mailItemDetail_aiElfBadge")
                }
                if let onRedo = content.onRedo {
                    Button(action: { onRedo() }) {
                        HStack(spacing: 3) {
                            Icon(.arrowsRepeat, size: 11, color: Theme.Color.primary700)
                            Text("Redo")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Theme.Color.primary700)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("mailItemDetail_aiElfRedo")
                }
            }
            Text(content.summary)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.primary900)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
            if !content.bullets.isEmpty {
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    ForEach(content.bullets) { bullet in
                        AIElfBulletRow(bullet: bullet)
                    }
                }
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .background(
            LinearGradient(
                colors: [Theme.Color.primary50, Theme.Color.primary100],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl)
                .stroke(Theme.Color.primary100, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
    }
}

private struct AIElfBulletRow: View {
    let bullet: AIElfBullet

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(bullet.icon, size: 10, color: Theme.Color.primary700)
                .frame(width: 16, height: 16)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.xs)
                        .stroke(Theme.Color.primary100, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.xs))
                .padding(.top, 1)
            (
                Text(bullet.label).font(.system(size: 12, weight: .bold))
                    .foregroundColor(Theme.Color.appText)
                    + Text(bullet.text.map { " — \($0)" } ?? "")
                    .pantopusTextStyle(.caption)
                    .foregroundColor(Theme.Color.appTextStrong)
            )
            .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Attachments row renderer

/// Section-card render for `AttachmentsRowContent`. Per `mail-detail.jsx:289`,
/// each row is a 36×44 type-color tile + name + meta + 32pt download button.
public struct AttachmentsRowView: View {
    public let content: AttachmentsRowContent

    public init(content: AttachmentsRowContent) {
        self.content = content
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            HStack(spacing: Spacing.s1) {
                Text(content.title.uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text("· \(content.items.count)")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextMuted)
                Spacer()
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s2)
            .accessibilityAddTraits(.isHeader)
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            ForEach(Array(content.items.enumerated()), id: \.element.id) { index, item in
                AttachmentRow(item: item)
                if index < content.items.count - 1 {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                        .padding(.leading, 60)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
    }
}

private struct AttachmentRow: View {
    let item: AttachmentItem

    var body: some View {
        Button(action: { item.onTap() }) {
            HStack(alignment: .center, spacing: Spacing.s3) {
                tile
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(2)
                    if let meta = item.meta {
                        Text(meta)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: Spacing.s0)
                Icon(.download, size: 14, color: Theme.Color.appTextStrong)
                    .frame(width: 32, height: 32)
                    .background(Circle().fill(Theme.Color.appSurfaceSunken))
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("mailItemDetail_attachment_\(item.id)")
    }

    @ViewBuilder private var tile: some View {
        let tokens = AttachmentTileTokens.tokens(for: item.kind)
        Text(tokens.label)
            .font(.system(size: 9, weight: .bold))
            .tracking(0.4)
            .foregroundStyle(tokens.foreground)
            .frame(width: 36, height: 44)
            .background(tokens.background)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.sm)
                    .stroke(tokens.border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
    }
}

/// Per-kind tile colors. Lifted from the design defaults — PDF tile is
/// red-50 / red-700 / red-200; image tile is sky; video is rose; link is
/// neutral. Each pair sits on the documented per-feature palette
/// exception so the shell file is the only place these hex literals
/// appear.
private enum AttachmentTileTokens {
    struct Tokens {
        let label: String
        let background: Color
        let foreground: Color
        let border: Color
    }

    static func tokens(for kind: AttachmentKind) -> Tokens {
        switch kind {
        case .pdf:
            // CSS fee2e2 / b91c1c / fecaca
            Tokens(
                label: "PDF",
                background: Color(red: 0xFE / 255.0, green: 0xE2 / 255.0, blue: 0xE2 / 255.0),
                foreground: Color(red: 0xB9 / 255.0, green: 0x1C / 255.0, blue: 0x1C / 255.0),
                border: Color(red: 0xFE / 255.0, green: 0xCA / 255.0, blue: 0xCA / 255.0)
            )
        case .image:
            // CSS dbeafe / 1d4ed8 / bfdbfe
            Tokens(
                label: "IMG",
                background: Color(red: 0xDB / 255.0, green: 0xEA / 255.0, blue: 0xFE / 255.0),
                foreground: Color(red: 0x1D / 255.0, green: 0x4E / 255.0, blue: 0xD8 / 255.0),
                border: Color(red: 0xBF / 255.0, green: 0xDB / 255.0, blue: 0xFE / 255.0)
            )
        case .video:
            // CSS fce7f3 / be185d / fbcfe8
            Tokens(
                label: "VID",
                background: Color(red: 0xFC / 255.0, green: 0xE7 / 255.0, blue: 0xF3 / 255.0),
                foreground: Color(red: 0xBE / 255.0, green: 0x18 / 255.0, blue: 0x5D / 255.0),
                border: Color(red: 0xFB / 255.0, green: 0xCF / 255.0, blue: 0xE8 / 255.0)
            )
        case .audio:
            // CSS ede9fe / 6d28d9 / ddd6fe
            Tokens(
                label: "AUD",
                background: Color(red: 0xED / 255.0, green: 0xE9 / 255.0, blue: 0xFE / 255.0),
                foreground: Color(red: 0x6D / 255.0, green: 0x28 / 255.0, blue: 0xD9 / 255.0),
                border: Color(red: 0xDD / 255.0, green: 0xD6 / 255.0, blue: 0xFE / 255.0)
            )
        case .link:
            // CSS f3f4f6 / 374151 / e5e7eb
            Tokens(
                label: "URL",
                background: Color(red: 0xF3 / 255.0, green: 0xF4 / 255.0, blue: 0xF6 / 255.0),
                foreground: Color(red: 0x37 / 255.0, green: 0x41 / 255.0, blue: 0x51 / 255.0),
                border: Color(red: 0xE5 / 255.0, green: 0xE7 / 255.0, blue: 0xEB / 255.0)
            )
        case .other:
            Tokens(
                label: "FILE",
                background: Color(red: 0xF3 / 255.0, green: 0xF4 / 255.0, blue: 0xF6 / 255.0),
                foreground: Color(red: 0x37 / 255.0, green: 0x41 / 255.0, blue: 0x51 / 255.0),
                border: Color(red: 0xE5 / 255.0, green: 0xE7 / 255.0, blue: 0xEB / 255.0)
            )
        }
    }
}
