//
//  GroupedListContent.swift
//  Pantopus
//
//  Render models for the shared GroupedList archetype — every
//  settings-style surface in the app uses this shape. Two levels:
//  `groups[]` with optional overline + helper caption + `rows[]`. Each
//  row carries a single `RowControl` that drives the right-side
//  affordance (chevron, toggle, radio, chip+chevron, slider).
//

import Foundation

/// The right-side control on one row. Drives both layout and the
/// callback the data source hears back from.
public enum RowControl: Sendable, Hashable {
    /// Plain navigation row — just a chevron on the right.
    case chevron
    /// Binary preference toggle.
    case toggle(isOn: Bool)
    /// Radio selection within the group; one row per option, the
    /// `isSelected` row carries `true`.
    case radio(isSelected: Bool)
    /// Status / value chip (e.g. "Verified", "Stripe connected").
    /// `includesChevron` adds the chevron after the chip when the row
    /// is also navigable.
    case chipStatus(label: String, tone: ChipTone, includesChevron: Bool)
    /// Stops-based slider. `stops` is the ordered label list, `index`
    /// is the active index.
    case slider(stops: [String], index: Int)
    /// A14.5 Notifications — three Push / Email / SMS channel chips
    /// tiled into the trailing slot (`ChannelTriad`). `locked` forces a
    /// chip "on, untoggleable" — Emergency alerts keep push locked on.
    case channelTriad(p: Bool, e: Bool, s: Bool, locked: Set<ChannelGlyph>)
    /// A14.5 Notifications — a horizontally scrolling strip of
    /// single-select value chips rendered under the row label (e.g. the
    /// briefing send-time options). `selected` is the active option's
    /// raw value, which is also what gets sent to the backend.
    case chips(options: [String], selected: String)

    public enum ChipTone: Sendable, Hashable { case success, info, neutral, warning }

    /// Controls that own the taps inside their own sub-elements — the
    /// shell must not put a row-level tap gesture (or a combined
    /// accessibility element) over them.
    public var ownsInnerTaps: Bool {
        switch self {
        case .channelTriad, .chips: true
        default: false
        }
    }
}

/// One row in a group.
public struct GroupedListRow: Identifiable, Sendable, Hashable {
    public let id: String
    public let label: String
    /// Optional secondary line under the label (e.g. "3 people",
    /// "Push, email, SMS").
    public let subtext: String?
    public let control: RowControl
    /// A14.7 — optional leading icon disc (primary-tinted) before the
    /// label. Used by the Privacy "Your data" action rows. `nil` for
    /// plain settings rows.
    public let leadingIcon: PantopusIcon?
    /// Optional parity identifier for controls whose product contract uses
    /// a stable unprefixed name.
    public let accessibilityIdentifier: String?
    /// Red destructive text + force this row into its own card. The
    /// shell pulls it out of the group and renders a dedicated card.
    public let destructive: Bool

    public init(
        id: String,
        label: String,
        subtext: String? = nil,
        control: RowControl,
        leadingIcon: PantopusIcon? = nil,
        accessibilityIdentifier: String? = nil,
        destructive: Bool = false
    ) {
        self.id = id
        self.label = label
        self.subtext = subtext
        self.control = control
        self.leadingIcon = leadingIcon
        self.accessibilityIdentifier = accessibilityIdentifier
        self.destructive = destructive
    }
}

/// One group — a card of rows with optional overline + helper.
public struct GroupedListGroup: Identifiable, Sendable, Hashable {
    public let id: String
    /// 11pt uppercase tracked label rendered above the card. `nil`
    /// hides the overline (used for the standalone destructive card).
    public let overline: String?
    /// 11.5pt fg3 caption below the card. Used for context like
    /// "Sent to maria@…" or "Carrier rates may apply".
    public let helper: String?
    /// A14.5 — render a P/E/S column-header band (`ChannelHeader`) as
    /// the first element inside the card, above the first row. `false`
    /// for every non-channel surface.
    public let showsChannelHeader: Bool
    /// A14.7 — when set, the card renders a `LocationFuzzSlider` (lead-in
    /// + stepped slider + `FuzzMap` preview) instead of `rows`. The
    /// overline + helper render as usual around it.
    public let fuzz: GroupedListFuzz?
    public let rows: [GroupedListRow]

    public init(
        id: String,
        overline: String? = nil,
        helper: String? = nil,
        showsChannelHeader: Bool = false,
        fuzz: GroupedListFuzz? = nil,
        rows: [GroupedListRow]
    ) {
        self.id = id
        self.overline = overline
        self.helper = helper
        self.showsChannelHeader = showsChannelHeader
        self.fuzz = fuzz
        self.rows = rows
    }
}

/// A14.5 — a banner pinned above the groups inside the scroll. The
/// paused-notifications state swaps its Master card for one of these.
/// Generic + value-typed so other surfaces can reuse it; `PauseBanner`
/// is the view that renders it.
public struct GroupedListBanner: Sendable, Hashable {
    /// Which banner treatment to render. `.pause` is the warm-amber
    /// `PauseBanner` (A14.5, with an action pill); `.stealth` is the dark
    /// `StealthBanner` (A14.7, no action).
    public enum Style: Sendable, Hashable { case pause, stealth }

    public let icon: PantopusIcon
    public let title: String
    public let subtitle: String?
    /// Trailing neutral pill label (e.g. "Resume"). Empty for `.stealth`.
    public let actionLabel: String
    public let style: Style

    public init(
        icon: PantopusIcon,
        title: String,
        subtitle: String? = nil,
        actionLabel: String = "",
        style: Style = .pause
    ) {
        self.icon = icon
        self.title = title
        self.subtitle = subtitle
        self.actionLabel = actionLabel
        self.style = style
    }
}

/// A14.7 — drives the Privacy "Map location fuzz" card: a lead-in line,
/// the stepped `LocationFuzzSlider`, and the `FuzzMap` preview. Carried
/// on `GroupedListGroup.fuzz`.
public struct GroupedListFuzz: Sendable, Hashable {
    public let leadIn: String
    public let stop: FuzzStop

    public init(leadIn: String, stop: FuzzStop) {
        self.leadIn = leadIn
        self.stop = stop
    }
}

/// Render state for the shell.
public enum GroupedListState: Sendable {
    case loading
    case loaded([GroupedListGroup])
    case error(message: String)
}

/// Contract every grouped-list feature implements. View-models
/// conform; views are pure.
@MainActor
public protocol GroupedListDataSource: AnyObject, Observable {
    /// Top-bar title.
    var title: String { get }
    /// Footer caption (e.g. "maria@pantopus · ID 8174"). `nil` hides
    /// the footer.
    var footerCaption: String? { get }
    /// Observed state.
    var state: GroupedListState { get }
    /// A14.5 — optional banner pinned above the groups inside the scroll
    /// (the paused-notifications state surfaces one here in place of its
    /// Master card). `nil` on every other surface.
    var banner: GroupedListBanner? { get }
    /// A14.5 — dims every group card to 0.5 opacity (paused state) while
    /// leaving the banner at full strength.
    var contentDimmed: Bool { get }

    /// Triggered on first appear + retry-after-error.
    func load() async
    /// Tap on a `.chevron` or `.chipStatus(includesChevron: true)` row.
    func tapRow(_ rowId: String) async
    /// Tap on a `.toggle` row. The shell flips the value
    /// optimistically; the data source is responsible for the persist
    /// + rollback.
    func toggleRow(_ rowId: String, isOn: Bool) async
    /// Tap on a `.radio` row. The shell highlights it optimistically
    /// before this returns.
    func selectRadio(_ rowId: String) async
    /// Drag on a `.slider` row. `index` is the stop index after the
    /// user's release.
    func setSlider(_ rowId: String, index: Int) async
    /// A14.5 — tap on one chip of a `.channelTriad` row. `isOn` is the
    /// value after the flip. Locked chips never call this.
    func toggleChannel(_ rowId: String, channel: ChannelGlyph, isOn: Bool) async
    /// A14.5 — tap on one option of a `.chips` row. `value` is the raw
    /// option string (already the wire value).
    func selectChip(_ rowId: String, value: String) async
    /// A14.5 — tap on the banner's trailing action pill (e.g. Resume).
    func tapBanner() async
    /// A14.7 — release the Privacy location-fuzz slider on `stop`.
    func setFuzz(_ rowId: String, stop: FuzzStop) async
}

/// Defaults so surfaces that predate A14.5/A14.7 (and those without a
/// banner, channel matrix, or fuzz slider) conform without boilerplate.
public extension GroupedListDataSource {
    var banner: GroupedListBanner? {
        nil
    }

    var contentDimmed: Bool {
        false
    }

    func toggleChannel(_: String, channel _: ChannelGlyph, isOn _: Bool) async {}
    func selectChip(_: String, value _: String) async {}
    func tapBanner() async {}
    func setFuzz(_: String, stop _: FuzzStop) async {}
}

/// Convenience helpers feature view-models reach for in their
/// optimistic mutation paths.
public extension GroupedListGroup {
    /// Find a row by id within this group.
    func row(id: String) -> GroupedListRow? {
        rows.first { $0.id == id }
    }
}
