//
//  ListOfRowsState.swift
//  Pantopus
//
//  Shell ViewModel contract for the List-of-Rows archetype. Concrete
//  screens conform to `ListOfRowsDataSource`; the shell view observes
//  that source and renders loading / empty / error / loaded from one
//  place.
//
//  T5.0 — extended additively with optional `searchBar`, `chipStrip`,
//  and `banner` chrome slots (all default `nil`), plus a `FABAction`
//  variant enum that defaults to `.canonicalCreate` (the existing 56pt
//  geometry). Every previously-conforming data source compiles
//  unchanged because the new protocol requirements all have default
//  implementations returning `nil`.
//

import SwiftUI

// swiftlint:disable file_length

/// Lifecycle state for the List-of-Rows shell.
public enum ListOfRowsState: Sendable {
    case loading
    case loaded(sections: [RowSection], hasMore: Bool)
    case empty(EmptyContent)
    case error(message: String)

    /// Empty-state configuration. Mirrors the P5 `EmptyState` props.
    public struct EmptyContent: Sendable {
        public let icon: PantopusIcon
        public let headline: String
        public let subcopy: String
        public let ctaTitle: String?
        public let onCTA: (@Sendable () -> Void)?
        /// Hero-circle background. `nil` keeps the `EmptyState` default
        /// (personal-identity sky). A14.4 passes a neutral sunken tint so
        /// the Blocked-users empty hero reads as a quiet grey disc.
        public let tint: Color?
        /// Icon stroke colour. `nil` keeps the `EmptyState` default
        /// (`primary600`). A14.4 pairs the grey disc with a secondary-text
        /// glyph.
        public let accent: Color?

        public init(
            icon: PantopusIcon,
            headline: String,
            subcopy: String,
            ctaTitle: String? = nil,
            onCTA: (@Sendable () -> Void)? = nil,
            tint: Color? = nil,
            accent: Color? = nil
        ) {
            self.icon = icon
            self.headline = headline
            self.subcopy = subcopy
            self.ctaTitle = ctaTitle
            self.onCTA = onCTA
            self.tint = tint
            self.accent = accent
        }
    }
}

/// Tab strip entry rendered above the list body.
public struct ListOfRowsTab: Identifiable, Hashable, Sendable {
    public let id: String
    public let label: String
    public let count: Int?

    public init(id: String, label: String, count: Int? = nil) {
        self.id = id
        self.label = label
        self.count = count
    }
}

// MARK: - T5 chrome slots

/// Optional search bar rendered between the top bar and the tab strip.
/// Used by Connections and Discover businesses.
public struct SearchBarConfig: Sendable {
    public let placeholder: String
    public let text: String
    public let onChange: @Sendable (String) -> Void
    public let onSubmit: (@Sendable () -> Void)?

    public init(
        placeholder: String,
        text: String,
        onChange: @escaping @Sendable (String) -> Void,
        onSubmit: (@Sendable () -> Void)? = nil
    ) {
        self.placeholder = placeholder
        self.text = text
        self.onChange = onChange
        self.onSubmit = onSubmit
    }
}

/// Horizontally scrollable chip-filter strip used as an alternative to
/// `ListOfRowsTab[]` for filtering. Used by Discover hub and Discover
/// businesses.
public struct ChipStripConfig: Sendable {
    public struct Chip: Sendable, Identifiable, Hashable {
        public let id: String
        public let label: String
        public let icon: PantopusIcon?

        public init(id: String, label: String, icon: PantopusIcon? = nil) {
            self.id = id
            self.label = label
            self.icon = icon
        }
    }

    public let chips: [Chip]
    public let selectedId: String
    public let onSelect: @Sendable (String) -> Void

    public init(
        chips: [Chip],
        selectedId: String,
        onSelect: @escaping @Sendable (String) -> Void
    ) {
        self.chips = chips
        self.selectedId = selectedId
        self.onSelect = onSelect
    }
}

/// Optional trailing CTA on a `BannerConfig`. T6.0a added this for the
/// Bills banner's "Pay all" button. When `cta` is set, the banner
/// renders the CTA as a tinted pill on the trailing edge and disables
/// the whole-card `onTap` (the CTA's `handler` is the focused action).
/// When `cta` is nil, banner-wide tap behavior is unchanged from T5.0.
public struct BannerCTA: Sendable {
    public let label: String
    public let icon: PantopusIcon?
    public let accessibilityLabel: String
    /// Tint for the CTA pill. Defaults to the active screen's identity
    /// tone (resolved by the shell) — pass an explicit tint to force a
    /// home / business / personal pill regardless of context.
    public let tint: BannerCTATint
    public let handler: @Sendable () -> Void

    public init(
        label: String,
        icon: PantopusIcon? = nil,
        accessibilityLabel: String? = nil,
        tint: BannerCTATint = .primary,
        handler: @escaping @Sendable () -> Void
    ) {
        self.label = label
        self.icon = icon
        self.accessibilityLabel = accessibilityLabel ?? label
        self.tint = tint
        self.handler = handler
    }
}

/// Tint options for the banner's trailing CTA pill. Resolved at render
/// time to the matching token pair (background + foreground).
public enum BannerCTATint: Sendable, Hashable {
    case primary // sky
    case home // green
    case business // violet
    case warning // amber (overdue surfaces)
}

/// Primary-tinted summary banner rendered above the first row in the
/// scroll area. Used by My bids, My tasks, Offers, Review claims, Bills.
public struct BannerConfig: Sendable {
    public let icon: PantopusIcon
    public let title: String
    public let subtitle: String?
    public let onTap: (@Sendable () -> Void)?
    /// T6.0a — optional trailing CTA pill (Bills "Pay all").
    /// When set, takes precedence over `onTap` for the user's focused
    /// action; `onTap` still fires for whole-card taps outside the CTA.
    public let cta: BannerCTA?
    /// T6.0a — optional override for the banner's background + border
    /// tint. Default `.primary` (sky) matches T5 behavior. Bills uses
    /// `.home` (soft green) per the home-pillar identity.
    public let tint: BannerCTATint

    public init(
        icon: PantopusIcon,
        title: String,
        subtitle: String? = nil,
        onTap: (@Sendable () -> Void)? = nil,
        cta: BannerCTA? = nil,
        tint: BannerCTATint = .primary
    ) {
        self.icon = icon
        self.title = title
        self.subtitle = subtitle
        self.onTap = onTap
        self.cta = cta
        self.tint = tint
    }
}

/// Rich listing-context header rendered above the first row on Listing
/// offers. Differs from `BannerConfig` in that the leading slot is a
/// 64pt gradient thumbnail and the trailing slot is an ask price; the
/// strip below the card carries the offer count + sort label.
///
/// Listing offers is the only screen using this slot today. Kept
/// optional + additive — every other data source inherits `nil` from
/// the default extension below.
public struct ListingContextConfig: Sendable {
    /// 64pt rounded thumbnail (icon-on-gradient — the listing's category
    /// drives the colour pair).
    public let thumbnail: ThumbnailImage
    /// Listing title (1 line, ellipsised).
    public let title: String
    /// Pre-formatted ask price (e.g. "$250").
    public let askPrice: String
    /// Inline meta items rendered with a "·" separator below the title
    /// (e.g. ["2.4k views", "18 watching", "Listed 4 days ago"]).
    public let meta: [ListingContextMeta]
    /// Status pill rendered at the bottom-right of the header card.
    public let statusChip: ListingContextStatus
    /// Count rendered in the sort strip below the header
    /// (e.g. "5 offers"). `nil` hides the strip.
    public let offerCount: Int?
    /// Sort selector label (e.g. "Highest offer").
    public let sortLabel: String?
    /// Options for the sort menu rendered on the sort strip. When
    /// non-empty the strip renders a `Menu`; when empty it falls back to
    /// `onSort` (a plain button) or a static label.
    public let sortOptions: [ListingContextSortOption]
    /// Triggered when the user taps the sort selector — opens a sort
    /// sheet, etc. `nil` makes the selector a non-interactive label.
    /// Ignored when `sortOptions` is non-empty (the menu drives sorting).
    public let onSort: (@Sendable () -> Void)?
    /// P3.3 — Triggered when the seller taps the pencil chip next to
    /// the asking price. Owner-only — the projection sets it to `nil`
    /// for buyers so the chip stays hidden.
    public let onEditPrice: (@Sendable () -> Void)?

    public init(
        thumbnail: ThumbnailImage,
        title: String,
        askPrice: String,
        meta: [ListingContextMeta],
        statusChip: ListingContextStatus,
        offerCount: Int? = nil,
        sortLabel: String? = nil,
        sortOptions: [ListingContextSortOption] = [],
        onSort: (@Sendable () -> Void)? = nil,
        onEditPrice: (@Sendable () -> Void)? = nil
    ) {
        self.thumbnail = thumbnail
        self.title = title
        self.askPrice = askPrice
        self.meta = meta
        self.statusChip = statusChip
        self.offerCount = offerCount
        self.sortLabel = sortLabel
        self.sortOptions = sortOptions
        self.onSort = onSort
        self.onEditPrice = onEditPrice
    }
}

/// One option in the listing-context sort menu (e.g. "Highest offer").
/// The owning view-model supplies the label, the current selection, and
/// the `select` handler that re-sorts the list in place.
public struct ListingContextSortOption: Identifiable, Sendable {
    public let id: String
    public let label: String
    public let isSelected: Bool
    public let select: @Sendable () -> Void

    public init(
        id: String,
        label: String,
        isSelected: Bool,
        select: @escaping @Sendable () -> Void
    ) {
        self.id = id
        self.label = label
        self.isSelected = isSelected
        self.select = select
    }
}

/// One meta item in the `ListingContextConfig` header (e.g. "2.4k views").
public struct ListingContextMeta: Sendable, Hashable {
    public let icon: PantopusIcon?
    public let text: String

    public init(icon: PantopusIcon? = nil, text: String) {
        self.icon = icon
        self.text = text
    }
}

/// Status pill payload for `ListingContextConfig`.
public struct ListingContextStatus: Sendable, Hashable {
    public let label: String
    public let icon: PantopusIcon?
    public let variant: StatusChipVariant

    public init(
        label: String,
        icon: PantopusIcon? = nil,
        variant: StatusChipVariant = .success
    ) {
        self.label = label
        self.icon = icon
        self.variant = variant
    }
}

// MARK: - Data source

/// Protocol any List-of-Rows ViewModel conforms to. Marked `@MainActor` so
/// SwiftUI bindings stay on the UI thread.
@MainActor
public protocol ListOfRowsDataSource: AnyObject, Observable {
    /// Title rendered in the 44pt top bar.
    var title: String { get }
    /// Optional trailing top-bar action (icon + handler). Nil = no button.
    var topBarAction: TopBarAction? { get }
    /// Optional tab strip. Empty = no tabs.
    var tabs: [ListOfRowsTab] { get }
    /// Id of the currently-selected tab. Ignored when `tabs` is empty.
    var selectedTab: String { get set }
    /// Optional FAB. Nil = no FAB.
    var fab: FABAction? { get }
    /// Observed UI state.
    var state: ListOfRowsState { get }

    /// Triggered on first appear and on pull-to-refresh.
    func load() async
    /// Triggered when the user pulls to refresh.
    func refresh() async
    /// Triggered when the list scrolls near the bottom.
    func loadMoreIfNeeded() async
}

/// T5 additive protocol surface — every existing conformer gets `nil`
/// from these defaults.
public extension ListOfRowsDataSource {
    /// Optional search bar above the tabs.
    var searchBar: SearchBarConfig? {
        nil
    }

    /// Optional chip-filter strip (mutually exclusive with `tabs`).
    var chipStrip: ChipStripConfig? {
        nil
    }

    /// Optional summary banner above the first row.
    var banner: BannerConfig? {
        nil
    }

    /// Optional listing-context header above the first row. Listing
    /// offers is the only screen using this today; every other data
    /// source inherits `nil`.
    var listingContext: ListingContextConfig? {
        nil
    }

    /// T6.4a — optional small subtitle rendered beneath the navigation
    /// title (e.g. Access codes screen shows "412 Birch Ln · Maria's
    /// household" under "Access codes"). When `nil`, the shell renders
    /// a single-line title — preserving every existing call site.
    var topBarSubtitle: String? {
        nil
    }

    /// A14.4 — optional monospaced caption rendered after the last
    /// section (the design's `MonoFooter`, e.g. "Maria Lewin · ID 8174").
    /// When `nil`, nothing renders — preserving every existing call site.
    var monoFooter: String? {
        nil
    }
}

/// Top-bar trailing action payload.
///
/// T5.0 additive: `label` and `isEnabled` are new optional fields with
/// backwards-compatible defaults. Existing call sites pass
/// `(icon:, accessibilityLabel:, handler:)` and render as an icon-only
/// button. Notifications V2 passes a text `label` instead — the shell
/// renders the text in primary tint and respects `isEnabled` for the
/// disabled state in the design's empty-unread frame.
public struct TopBarAction: Sendable {
    public let icon: PantopusIcon
    public let label: String?
    public let accessibilityLabel: String
    public let isEnabled: Bool
    /// Optional count badge rendered over the icon's top-trailing corner
    /// (e.g. number of active filters). `nil` or `0` hides the badge.
    /// Only honoured by the icon variant.
    public let badgeCount: Int?
    public let handler: @Sendable () -> Void

    public init(
        icon: PantopusIcon,
        accessibilityLabel: String,
        badgeCount: Int? = nil,
        handler: @escaping @Sendable () -> Void
    ) {
        self.icon = icon
        label = nil
        self.accessibilityLabel = accessibilityLabel
        isEnabled = true
        self.badgeCount = badgeCount
        self.handler = handler
    }

    /// Text-button variant — renders `label` instead of the icon. Used by
    /// Notifications "Mark all read".
    public init(
        label: String,
        accessibilityLabel: String,
        isEnabled: Bool = true,
        icon: PantopusIcon = .check,
        handler: @escaping @Sendable () -> Void
    ) {
        self.icon = icon
        self.label = label
        self.accessibilityLabel = accessibilityLabel
        self.isEnabled = isEnabled
        badgeCount = nil
        self.handler = handler
    }
}

/// Identity tint for a FAB. Resolved at render time to a (background,
/// shadow) pair. Defaults to `.sky` so every existing FAB call site —
/// which doesn't pass a tint — keeps the T5 sky-blue render.
///
/// T6.0a added home + business tints so home-pillar screens (Bills,
/// Maintenance, Calendar, etc.) and business-pillar screens
/// (My businesses) can swap the FAB color to match their identity
/// without forking the FAB variant taxonomy.
public enum FabTint: Sendable, Hashable {
    case sky // primary600 — default
    case home // home green
    case business // business violet
}

/// Floating-action-button payload.
///
/// T5.0 adds a `Variant` enum:
///   - `.canonicalCreate` (56pt) — primary create action of the screen
///     (My tasks V2 "Post a task"). **Default** for backwards compat —
///     every existing `FABAction(icon:, accessibilityLabel:, handler:)`
///     call site renders 56pt exactly as before.
///   - `.secondaryCreate` (52pt) — non-canonical create action (My posts,
///     Connections, Bills, Pets).
///   - `.extendedNav(label:)` (48pt pill with label) — navigation FAB
///     that signals "go elsewhere", not "create" (My bids "Browse
///     tasks").
///
/// T6.0a adds an optional `tint: FabTint` field (default `.sky`) for
/// the home / business identity tints. Existing call sites compile
/// unchanged because the parameter defaults.
///
/// T6.0b adds:
///   - `.magicCreate` (60pt) — gradient `primary600 → primary700`,
///     plus glyph + 18pt sparkles disc clipped over the top-right.
///     Used by My tasks V2 (sparkles+plus) and Mailbox-A17 root
///     (scan-line variant for magic ingest). The variant is additive;
///     no existing call site changes.
public struct FABAction: Sendable {
    public enum Variant: Sendable {
        case canonicalCreate
        case secondaryCreate
        case extendedNav(label: String)
        case magicCreate
    }

    public let icon: PantopusIcon
    public let accessibilityLabel: String
    public let variant: Variant
    public let tint: FabTint
    public let handler: @Sendable () -> Void

    /// Full init — pick a variant explicitly.
    public init(
        icon: PantopusIcon = .plusCircle,
        accessibilityLabel: String,
        variant: Variant,
        tint: FabTint = .sky,
        handler: @escaping @Sendable () -> Void
    ) {
        self.icon = icon
        self.accessibilityLabel = accessibilityLabel
        self.variant = variant
        self.tint = tint
        self.handler = handler
    }

    /// Backwards-compatible convenience matching the T1–T4.1 signature.
    /// Defaults to `.canonicalCreate` (56pt) + `.sky` tint — the
    /// historical geometry / color.
    public init(
        icon: PantopusIcon = .plusCircle,
        accessibilityLabel: String,
        handler: @escaping @Sendable () -> Void
    ) {
        self.init(
            icon: icon,
            accessibilityLabel: accessibilityLabel,
            variant: .canonicalCreate,
            tint: .sky,
            handler: handler
        )
    }
}
