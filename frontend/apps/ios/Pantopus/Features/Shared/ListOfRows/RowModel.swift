//
//  RowModel.swift
//  Pantopus
//
//  Template-agnostic row payload. Every list-of-rows screen maps its
//  backend DTOs into one of these.
//
//  T5.0 — extended additively for the My posts / My bids / My tasks /
//  Connections / Notifications / Discover hub / Bills / Pets / Offers /
//  Listing offers / Review claims designs. Every existing call site
//  (Notifications v1, MyHomes, MyClaims, Mailbox list/drawers) compiles
//  unchanged because:
//    - existing enum cases are untouched (`.icon`, `.avatar`, `.none` on
//      `RowLeading`; `.statusChip`, `.chevron`, `.kebab`, `.none` on
//      `RowTrailing`; `.statusChip`, `.fileChevron`, `.avatarKebab` on
//      `RowTemplate`),
//    - new `RowModel` fields are optional with `nil` defaults,
//    - `RowSection` retains its original initializer signature and adds
//      new optional `count` / `onSeeAll` / `style` parameters with
//      defaults.
//

import SwiftUI

// swiftlint:disable enum_case_associated_values_count file_length

/// Visual template for a list row.
public enum RowTemplate: Sendable {
    /// Title + optional subtitle + trailing status chip.
    case statusChip
    /// Leading icon + title + trailing chevron — for drill-down lists.
    case fileChevron
    /// Leading avatar + title + trailing kebab (more-horizontal) menu.
    case avatarKebab
}

// MARK: - Leading

/// Two-stop gradient for category / avatar / thumbnail backgrounds.
public struct GradientPair: Sendable, Hashable {
    public let start: Color
    public let end: Color
    public init(start: Color, end: Color) {
        self.start = start
        self.end = end
    }
}

/// Size variants for the avatar-with-verified-badge leading.
public enum AvatarBadgeSize: Sendable, Hashable {
    /// 36pt — used inside grouped sections (Discover hub).
    case small
    /// 40pt — review-claims rows.
    case medium
    /// 44pt — Connections row.
    case large

    public var size: CGFloat {
        switch self {
        case .small: 36
        case .medium: 40
        case .large: 44
        }
    }
}

/// Background fill for `RowLeading.avatarWithBadge`. Either a solid colour
/// or a two-stop gradient — both come from category / identity tokens; no
/// hex literals at call sites.
public enum AvatarBackground: Sendable, Hashable {
    case solid(Color)
    case gradient(GradientPair)
}

/// Thumbnail payload for `RowLeading.thumbnail` — Offers (56pt) and Pets
/// (64pt) both use this shape.
public enum ThumbnailImage: Sendable, Hashable {
    /// Icon over a gradient fill — fallback when no photo is available.
    case icon(PantopusIcon, gradient: GradientPair)
    /// Remote photo; icon-over-gradient renders while it loads or on
    /// failure.
    case url(URL, fallback: PantopusIcon, gradient: GradientPair)
}

/// Size variants for `RowLeading.thumbnail`.
public enum ThumbnailSize: Sendable, Hashable {
    /// 56pt — Offers row.
    case medium
    /// 64pt — Pets row.
    case large

    public var size: CGFloat {
        switch self {
        case .medium: 56
        case .large: 64
        }
    }
}

/// Mini-avatar used inside the bidder stack on My tasks rows. Tone drives
/// background + foreground colour from the design-token palette.
public struct Bidder: Sendable, Hashable, Identifiable {
    public let id: String
    public let initials: String
    public let tone: BidderTone

    public init(id: String, initials: String, tone: BidderTone) {
        self.id = id
        self.initials = initials
        self.tone = tone
    }
}

/// Categorical tones for `Bidder` avatars. The shell maps each tone to a
/// (background, foreground) colour pair — see `BidderStack.swift`.
public enum BidderTone: Sendable, Hashable, CaseIterable {
    case sky, teal, amber, rose, violet, slate
}

/// Optional leading visual.
public enum RowLeading: Sendable {
    /// Existing — icon-only.
    case icon(PantopusIcon, tint: Color = Theme.Color.primary600)
    /// Existing — avatar with identity-pillar ring.
    case avatar(name: String, imageURL: URL?, identity: IdentityPillar, ringProgress: Double)
    /// Existing — render nothing.
    case none

    // MARK: T5 additions

    /// 40pt rounded-square tile with a tinted background + foreground.
    /// Used by Notifications (per type) and Bills (receipt icon).
    case typeIcon(PantopusIcon, background: Color, foreground: Color)

    /// 40pt rounded-square tile with a two-stop gradient background +
    /// white foreground icon. Used by My bids / My tasks category icons.
    case categoryGradientIcon(PantopusIcon, gradient: GradientPair)

    /// Plain circular avatar with optional 16pt verified-check overlay at
    /// the bottom-right. Used by Connections (large) and Review claims
    /// (medium) and Discover hub people rows (small).
    case avatarWithBadge(
        name: String,
        imageURL: URL?,
        background: AvatarBackground,
        size: AvatarBadgeSize,
        verified: Bool = false
    )

    /// Rounded thumbnail (56pt or 64pt) used by Offers and Pets.
    case thumbnail(image: ThumbnailImage, size: ThumbnailSize)

    /// Overlapping mini-avatars + `+N` overflow tile, used by My tasks
    /// bidder summary.
    case bidderStack(bidders: [Bidder], overflow: Int)

    // MARK: T6.0b additions

    /// 44pt rounded-square tile with a two-stop gradient background +
    /// white foreground icon + a small sparkles disc clipped over the
    /// top-right corner. The disc is the scannable "Magic Task understood
    /// this" signal.
    ///
    /// Used by My tasks V2 when the gig was posted via Magic Task
    /// (server-derived from `source_flow === 'magic'`). The shell renders
    /// the tile at 44pt to make room for the disc overlay; the disc is
    /// 18pt with a 1.5pt magic-border ring and a 10pt magic-violet
    /// sparkles glyph.
    case magicArchetypeTile(PantopusIcon, gradient: GradientPair)
}

// MARK: - Bidder stack data

/// Bidder stack payload rendered inline on the chip line — used by My
/// tasks V2 (T5.3.2). Separate from `RowLeading.bidderStack` because
/// the design positions the stack next to the status chip rather than
/// in the leading slot (the leading slot is the 40pt category icon).
public struct BidderStackData: Sendable, Hashable {
    public let bidders: [Bidder]
    public let overflow: Int

    public init(bidders: [Bidder], overflow: Int = 0) {
        self.bidders = bidders
        self.overflow = max(0, overflow)
    }
}

// MARK: - Split stack (T6.0a Bills)

/// One member in a split-payer stack. Geometry is smaller than `Bidder`
/// (18pt vs 22pt) so the visual reads as a property tag, not social
/// proof. Tone palette is shared with `Bidder` so split members and
/// bidders pick from the same six-color set.
public struct SplitMember: Sendable, Hashable, Identifiable {
    public let id: String
    public let initials: String
    public let tone: BidderTone

    public init(id: String, initials: String, tone: BidderTone) {
        self.id = id
        self.initials = initials
        self.tone = tone
    }
}

/// Split-payer stack payload rendered at the RIGHT EDGE of the chip
/// line — used by Bills (T6.0a) when a bill is split between household
/// members. Different geometry + alignment from `BidderStackData`:
///
///   - 18pt overlapping avatars (vs Bidder 22pt)
///   - right-aligned (vs Bidder which sits before the chips)
///   - includes the "Split N ways" caption alongside the avatars
///
/// Kept as a separate struct so the two concerns don't share an enum
/// case the shell would have to disambiguate.
public struct SplitStackData: Sendable, Hashable {
    public let members: [SplitMember]
    public let overflow: Int
    /// Total people in the split, including the viewer. The "Split N
    /// ways" caption uses this count so the math is explicit at the
    /// VM (not the renderer).
    public let totalWays: Int

    public init(members: [SplitMember], overflow: Int = 0, totalWays: Int) {
        self.members = members
        self.overflow = max(0, overflow)
        self.totalWays = max(0, totalWays)
    }
}

// MARK: - Trailing

/// Compact-button variant — used by `RowTrailing.verticalActions` and
/// `RowFooterAction`. Same palette as `CompactButton`.
public enum CompactButtonVariant: Sendable, Hashable {
    case primary
    case ghost
    case destructive
}

/// Tone for `RowTrailing.pillButton` — mirrors the design's `PillButton`
/// primitive palette: `neutral` (white bg · grey border · fg2 label),
/// `primary` (sky fill · white label), `danger` (white bg · red border ·
/// red label).
public enum RowPillTone: Sendable, Hashable {
    case neutral
    case primary
    case danger
}

/// Single action description for `RowTrailing.verticalActions` (Connections
/// pending-request Accept / Ignore stack).
public struct VerticalAction: Sendable {
    public let label: String
    public let variant: CompactButtonVariant
    public let handler: @Sendable () -> Void

    public init(
        label: String,
        variant: CompactButtonVariant,
        handler: @escaping @Sendable () -> Void
    ) {
        self.label = label
        self.variant = variant
        self.handler = handler
    }
}

/// Trailing payload — rendered according to the chosen `RowTemplate`.
public enum RowTrailing: Sendable {
    /// Existing — status chip.
    case statusChip(text: String, variant: StatusChipVariant)
    /// Existing — drill-down chevron.
    case chevron
    /// Existing — more-horizontal kebab menu.
    case kebab
    /// Existing — render nothing.
    case none

    // MARK: T5 additions

    /// Amount on top + status chip stacked below — Bills.
    case amountWithChip(
        amount: String,
        chipText: String,
        chipVariant: StatusChipVariant,
        chipIcon: PantopusIcon? = nil
    )

    /// Single circular icon-button — Connections "message" CTA.
    case circularAction(
        icon: PantopusIcon,
        accessibilityLabel: String,
        background: Color = Theme.Color.primary50,
        foreground: Color = Theme.Color.primary600,
        handler: @Sendable () -> Void
    )

    /// Stacked Accept / Ignore pair (28-30pt compact buttons) —
    /// Connections pending requests.
    case verticalActions(primary: VerticalAction, secondary: VerticalAction)

    /// Price stack — amount on top, optional sublabel below. Used by My
    /// bids (bid amount + budget). The bid-card title sits to the left.
    case priceStack(amount: String, sublabel: String? = nil)

    /// Two small (32pt) icon-only buttons rendered side by side. Used by
    /// Access codes for the copy + kebab pair on each row — every other
    /// existing trailing case is either a single button or non-button
    /// content, so this slot fills the gap without conflating with
    /// `.kebab` (`onSecondary`) or `.circularAction` (single primary).
    /// Both handlers are explicit so the kebab and copy can each have
    /// their own a11y label.
    case iconActions(primary: RowIconAction, secondary: RowIconAction)

    /// A14.4 — single inline labelled pill (the design's `PillButton`
    /// primitive: 6×14 padding · capsule radius · 1px border · 13pt
    /// semibold label · no icon). Used by Blocked users ("Unblock" in
    /// neutral tone). Distinct from `.verticalActions` (a stacked pair of
    /// compact buttons) and `.circularAction` (icon-only): this is a
    /// single text pill carrying its own tap handler.
    case pillButton(label: String, tone: RowPillTone, handler: @Sendable () -> Void)
}

/// Single icon-only action used by `RowTrailing.iconActions`. Renders as a
/// 32pt rounded-square button with a sunken neutral background and a
/// 15pt glyph in the foreground tint.
public struct RowIconAction: Sendable {
    public let icon: PantopusIcon
    public let accessibilityLabel: String
    public let background: Color
    public let foreground: Color
    public let handler: @Sendable () -> Void

    public init(
        icon: PantopusIcon,
        accessibilityLabel: String,
        background: Color = Theme.Color.appSurfaceSunken,
        foreground: Color = Theme.Color.appTextSecondary,
        handler: @escaping @Sendable () -> Void
    ) {
        self.icon = icon
        self.accessibilityLabel = accessibilityLabel
        self.background = background
        self.foreground = foreground
        self.handler = handler
    }
}

// MARK: - Chip

/// A chip rendered inline with the title (e.g. Pets "Dog" pill) or in the
/// chip row beneath the body (e.g. My posts intent chip, Offers
/// counter-pill).
public struct RowChip: Sendable, Hashable {
    public enum Tint: Sendable, Hashable {
        case status(StatusChipVariant)
        case custom(background: Color, foreground: Color)
    }

    public let text: String
    public let icon: PantopusIcon?
    public let tint: Tint

    public init(text: String, icon: PantopusIcon? = nil, tint: Tint) {
        self.text = text
        self.icon = icon
        self.tint = tint
    }
}

// MARK: - Footer

/// One action inside `RowFooter`. The shell renders all actions as
/// `CompactButton.footer` (34pt) in a horizontal stack, distributed by
/// `flex` weight.
public struct RowFooterAction: Sendable {
    public let title: String
    public let icon: PantopusIcon?
    public let variant: CompactButtonVariant
    /// Flex weight inside the footer row. Default 1.
    public let flex: Int
    /// Optional `accessibilityIdentifier` for the rendered button —
    /// Android-parity test tags (e.g. `myBids.counter_<id>.accept`).
    public let identifier: String?
    public let handler: @Sendable () -> Void

    public init(
        title: String,
        icon: PantopusIcon? = nil,
        variant: CompactButtonVariant = .primary,
        flex: Int = 1,
        identifier: String? = nil,
        handler: @escaping @Sendable () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.variant = variant
        self.flex = flex
        self.identifier = identifier
        self.handler = handler
    }
}

/// Optional in-card footer for a row. Renders 1–3 inline compact buttons
/// separated by a hairline above. Used by My bids, My tasks, Offers,
/// Listing offers, Review claims.
public struct RowFooter: Sendable {
    public let actions: [RowFooterAction]

    public init(actions: [RowFooterAction]) {
        self.actions = actions
    }
}

// MARK: - Engagement footer

/// One display-only stat (icon + label) inside a [`RowEngagement`] strip.
/// Used by My posts for `8 replies`, `142 views`, `12 going`, etc. The
/// items are not interactive — they're a compact summary of the row's
/// engagement counters. Taps on the row still route to `RowModel.onTap`.
public struct RowEngagementItem: Sendable, Hashable, Identifiable {
    public let id: String
    public let icon: PantopusIcon
    public let label: String

    public init(id: String, icon: PantopusIcon, label: String) {
        self.id = id
        self.icon = icon
        self.label = label
    }
}

/// Single trailing text-button for the engagement footer (e.g. My posts
/// "Edit" / "Restore" link). Rendered in primary tint at the right of the
/// hairline-separated engagement row.
public struct RowEngagementCTA: Sendable {
    public let icon: PantopusIcon?
    public let label: String
    public let accessibilityLabel: String
    public let handler: @Sendable () -> Void

    public init(
        label: String,
        icon: PantopusIcon? = nil,
        accessibilityLabel: String? = nil,
        handler: @escaping @Sendable () -> Void
    ) {
        self.label = label
        self.icon = icon
        self.accessibilityLabel = accessibilityLabel ?? label
        self.handler = handler
    }
}

/// Hairline-separated engagement footer for a row. Renders display-only
/// items on the left + an optional CTA text-button on the right. Used by
/// My posts — `[8 replies] [142 views] ↳ Edit`.
public struct RowEngagement: Sendable {
    public let items: [RowEngagementItem]
    public let cta: RowEngagementCTA?

    public init(items: [RowEngagementItem], cta: RowEngagementCTA? = nil) {
        self.items = items
        self.cta = cta
    }
}

// MARK: - Destructive row action

/// Optional destructive action attached to a row. The shell surfaces it
/// with the platform idiom on each side so parity holds without forcing
/// one gesture onto both: iOS renders a trailing swipe action **and** a
/// long-press context menu; Android renders a long-press dropdown
/// (`combinedClickable(onLongClick:)`).
///
/// The handler should open a confirmation before destroying anything —
/// the shell never confirms on the screen's behalf.
public struct RowDestructiveAction: Sendable {
    public let label: String
    /// Optional `accessibilityIdentifier` for the rendered control —
    /// mirror the Android `Modifier.testTag(…)` string.
    public let identifier: String?
    public let handler: @Sendable () -> Void

    public init(
        label: String,
        identifier: String? = nil,
        handler: @escaping @Sendable () -> Void
    ) {
        self.label = label
        self.identifier = identifier
        self.handler = handler
    }
}

// MARK: - Body emphasis

/// Render emphasis for the `body` field on a row. Default `.secondary`
/// matches Notifications V2 (small dim text below the title); `.primary`
/// renders the body as the row's headline content — used by My posts
/// where the post's body IS the main thing the user reads.
public enum RowBodyEmphasis: Sendable, Hashable {
    /// 12pt caption, secondary text colour (default — Notifications V2).
    case secondary
    /// 14pt small, primary text colour (My posts).
    case primary
}

// MARK: - Highlight

/// Optional visual highlight wrapping the whole card. Layered with the
/// normal row chrome — does not change geometry.
public enum RowHighlight: Sendable, Hashable {
    /// Notification unread row: `primary25` background, `personalBg` border,
    /// 8pt primary dot beside the title.
    case unread
    /// Listing-offer "LEADING" row: amber border + `LEADING` badge pinned
    /// to the top of the card.
    case leading
    /// My-posts archived row: 0.78 opacity.
    case archived
    /// Terminal / non-actionable row: 0.78 opacity. Used by My bids for
    /// rejected / withdrawn / expired / task-cancelled rows so the user
    /// can scan them at a glance without confusing them for live bids.
    /// Same visual effect as `.archived` but semantically distinct so
    /// other screens (Review claims, completed offers) can opt in
    /// without overloading the "archived" intent.
    case muted
}

// MARK: - RowModel

/// A single row. Call sites construct these from DTOs in their ViewModel.
///
/// **Backwards compat:** the original 8-parameter init is the
/// `convenience` shape. All new T5 fields default to `nil` and the
/// memberwise init is replaced with a labeled one whose parameter order
/// preserves the original prefix.
public struct RowModel: Identifiable, Sendable {
    public let id: String
    public let title: String
    public let subtitle: String?
    public let template: RowTemplate
    public let leading: RowLeading
    public let trailing: RowTrailing
    /// Invoked when the row is tapped.
    public let onTap: @Sendable () -> Void
    /// Invoked when the kebab menu is tapped (if any).
    public let onSecondary: (@Sendable () -> Void)?

    // MARK: T5 additions

    /// Multiline body rendered below the subtitle. Used by Notifications
    /// (2-line clipped) and My posts (2-line clipped).
    public let body: String?

    /// Optional small icon prefix for the subtitle line. Used by
    /// Connections (map-pin in front of locality).
    public let subtitleIcon: PantopusIcon?

    /// Optional small icon prefix for the body line. Used by Connections
    /// (per-row interaction-type icon: message-circle / wrench / megaphone /
    /// user-plus / sparkles).
    public let bodyIcon: PantopusIcon?

    /// Render emphasis for `body`. Default `.secondary` keeps the existing
    /// Notifications V2 / Connections behaviour; `.primary` is used by My
    /// posts where the body is the row's headline content.
    public let bodyEmphasis: RowBodyEmphasis

    /// Chip rendered inline with the title (Pets "Dog" pill).
    public let inlineChip: RowChip?

    /// Chip row below the body (My bids / My tasks status chip; Offers
    /// counter pill). Renders left-to-right.
    public let chips: [RowChip]?

    /// Chip row rendered as a header **above** the title/body, in the same
    /// row as the kebab (when present). Used by My posts — `[intent chip]
    /// [time meta]  …  [kebab]`. Mutually compatible with `chips`: when
    /// both are set, `headerChips` renders above the body and `chips`
    /// below (rare; only My posts uses `headerChips` today).
    public let headerChips: [RowChip]?

    /// Small dim text on the far-right of the chip row (My posts "2h",
    /// Notifications "12m"). When `headerChips` is set, this renders on
    /// the same header row instead of with the chips below the body.
    public let timeMeta: String?

    /// Text appended after the chip row, separated from chips with a "·"
    /// (My bids "3 others bid · 1d left").
    public let metaTail: String?

    /// Italic block quote rendered below the row body (Listing offers
    /// buyer note).
    public let note: String?

    /// Optional visual highlight wrapping the row (unread / leading /
    /// archived).
    public let highlight: RowHighlight?

    /// Optional in-card footer with 1–3 compact buttons.
    public let footer: RowFooter?

    /// Optional hairline-separated engagement strip (display-only items +
    /// optional trailing CTA text-button). Used by My posts.
    public let engagement: RowEngagement?

    /// Optional bidder stack rendered inline on the chip line before
    /// the `chips`. Used by My tasks V2 — 22pt overlapping avatars with
    /// a `+N` overflow tile communicating competition at a glance.
    public let bidderStack: BidderStackData?

    /// Optional split-payer stack rendered at the RIGHT EDGE of the
    /// chip line. Used by Bills (T6.0a) when a bill is split between
    /// household members — 18pt overlapping avatars + "Split N ways"
    /// caption. Separate from `bidderStack` so the renderer can place
    /// each in the correct slot (left for bidder, right for splits).
    public let splitWith: SplitStackData?

    /// T6.0b — small uppercase magic-violet text rendered ABOVE the
    /// title, used by My tasks V2 when the gig was posted via Magic Task
    /// (the AI-derived archetype name — e.g. "MOUNT & INSTALL", "MOVING
    /// HELP", "DOG-WALK"). Renders as 10pt semibold, +0.06em tracking,
    /// `Theme.Color.magic` foreground.
    ///
    /// Truncates with ellipsis at 24 characters so a long archetype
    /// string can't push the title off-screen. Pass `nil` to suppress
    /// the overline entirely — all non-magic rows render with this slot
    /// hidden.
    public let archetypeOverline: String?

    /// Optional destructive row action (Notifications "Delete"). Surfaced
    /// as a trailing swipe + long-press context menu by the shell.
    public let destructiveAction: RowDestructiveAction?

    public init(
        id: String,
        title: String,
        subtitle: String? = nil,
        template: RowTemplate,
        leading: RowLeading = .none,
        trailing: RowTrailing = .none,
        onTap: @escaping @Sendable () -> Void = {},
        onSecondary: (@Sendable () -> Void)? = nil,
        body: String? = nil,
        subtitleIcon: PantopusIcon? = nil,
        bodyIcon: PantopusIcon? = nil,
        bodyEmphasis: RowBodyEmphasis = .secondary,
        inlineChip: RowChip? = nil,
        chips: [RowChip]? = nil,
        headerChips: [RowChip]? = nil,
        timeMeta: String? = nil,
        metaTail: String? = nil,
        note: String? = nil,
        highlight: RowHighlight? = nil,
        footer: RowFooter? = nil,
        engagement: RowEngagement? = nil,
        bidderStack: BidderStackData? = nil,
        splitWith: SplitStackData? = nil,
        archetypeOverline: String? = nil,
        destructiveAction: RowDestructiveAction? = nil
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.template = template
        self.leading = leading
        self.trailing = trailing
        self.onTap = onTap
        self.onSecondary = onSecondary
        self.body = body
        self.subtitleIcon = subtitleIcon
        self.bodyIcon = bodyIcon
        self.bodyEmphasis = bodyEmphasis
        self.inlineChip = inlineChip
        self.chips = chips
        self.headerChips = headerChips
        self.timeMeta = timeMeta
        self.metaTail = metaTail
        self.note = note
        self.highlight = highlight
        self.footer = footer
        self.engagement = engagement
        self.bidderStack = bidderStack
        self.splitWith = splitWith
        self.archetypeOverline = archetypeOverline
        self.destructiveAction = destructiveAction
    }
}

// MARK: - Section

/// Style for a `RowSection`. `flat` is the default and matches T1–T4.1
/// behaviour (rows with surface backgrounds, spaced by `s2`); `card`
/// groups all rows inside a single rounded card with hairline separators
/// between them — used by Discover hub's typed sections (People /
/// Businesses / Gigs / Listings).
public enum SectionStyle: Sendable {
    case flat
    case card
}

/// Optional grouping for the list body.
public struct RowSection: Identifiable, Sendable {
    public let id: String
    public let header: String?
    /// A14.4 — optional 11.5pt secondary caption rendered **below** the
    /// section (under the card for `.card`, under the rows for `.flat`).
    /// Mirrors `GroupedListGroup.helper` so a single-card people list
    /// (Blocked users) can reaffirm the privacy contract beneath the card.
    public let footer: String?
    public let rows: [RowModel]

    // MARK: T5 additions

    /// Counter displayed after the section header (Discover hub
    /// "People (24)").
    public let count: Int?
    /// Trailing CTA on the section header (Discover hub "See all →").
    public let onSeeAll: (@Sendable () -> Void)?
    /// Rendering style — default `.flat` preserves T1–T4.1 behaviour.
    public let style: SectionStyle

    public init(
        id: String = UUID().uuidString,
        header: String? = nil,
        footer: String? = nil,
        rows: [RowModel],
        count: Int? = nil,
        onSeeAll: (@Sendable () -> Void)? = nil,
        style: SectionStyle = .flat
    ) {
        self.id = id
        self.header = header
        self.footer = footer
        self.rows = rows
        self.count = count
        self.onSeeAll = onSeeAll
        self.style = style
    }
}
